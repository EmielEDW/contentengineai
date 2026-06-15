/**
 * The per-video 22-state FSM. Config-driven from STATES. AUTO structured states
 * run via runState and auto-advance; GATE states pause on waitForEvent (bounded
 * revise loop); a cost-estimate gate fires once before the first media fan-out;
 * media generation is delegated to a SEPARATE function (mediaFanout) so this
 * function stays well under the Inngest per-run step ceiling.
 */
import { NonRetriableError } from "inngest";
import { inngest } from "../client";
import { GATE_TIMEOUT, MAX_REVISIONS } from "../events";
import { STATES, isStateActive, isBlockedByVisualGate, type AdvanceContext } from "@/lib/pipeline/states";
import { getStateSchema } from "@/lib/schemas";
import { runState } from "@/lib/pipeline/run-state";
import * as repo from "@/lib/pipeline/repo";
import { mediaFanout } from "./media-fanout";
import { flowHandoff } from "./flow-handoff";

const FIRST_VISUAL_STATE = 14;
const MAX_GATE_EVENTS = MAX_REVISIONS * 4 + 4; // hard cap on total events processed per gate

export const videoPipeline = inngest.createFunction(
  { id: "video-pipeline", concurrency: { key: "event.data.orgId", limit: 3 } },
  { event: "pipeline/start" },
  async ({ event, step }) => {
    const { videoId, orgId } = event.data;

    const video = await step.run("load-video", () => repo.getVideo(videoId));
    const channel = await step.run("load-channel", () => repo.getChannel(video.channel_id));
    const ctx: AdvanceContext = {
      onboardingPath: channel.onboarding_path,
      enabledOptionalStates: video.enabled_optional_states ?? [],
    };

    for (const def of STATES) {
      const n = def.no;
      if (n < video.current_state) continue;
      if (!isStateActive(n, ctx)) continue;

      // ── Visual gating: block generating-visual states until script approved ──
      const scriptApproved = await step.run(`check-script-approved-${n}`, () => repo.isScriptApproved(videoId));
      if (isBlockedByVisualGate(n, scriptApproved)) {
        await step.run(`block-${n}`, () => repo.setVideoState(videoId, n, "blocked"));
        return { status: "blocked_by_visual_gate", stateNo: n };
      }

      // ── Cost gate: exactly once, on the first media-generating state (14). ──
      // Gating on `n === FIRST_VISUAL_STATE` (not `>=`) makes it idempotent across
      // resumed runs: a run resuming at state 15/16 never re-fires the gate.
      if (n === FIRST_VISUAL_STATE) {
        await step.run("cost-gate-mark", () => repo.setVideoState(videoId, FIRST_VISUAL_STATE, "awaiting_curation"));
        const approval = await step.waitForEvent("await-cost-gate", {
          event: "gate/cost.approved",
          timeout: GATE_TIMEOUT,
          match: "data.videoId",
        });
        if (!approval || !approval.data.approved) {
          return { status: "cost_gate_pending" };
        }
        await step.run("quota-check", async () => {
          const remaining = await repo.getRemainingQuotaCents(orgId);
          if (remaining <= 0) throw new NonRetriableError(`Org ${orgId} has no remaining quota`);
        });
      }

      const schemaEntry = getStateSchema(n);

      if (def.kind === "auto") {
        if (schemaEntry) {
          const inputs = await step.run(`inputs-${n}`, () => gatherInputs(n, videoId));
          await step.run(`auto-${n}`, () =>
            runState({
              orgId,
              videoId,
              channelId: video.channel_id,
              stateNo: n,
              brandMemory: channel.brand_memory,
              stateInputs: inputs,
              providerConfig: video.provider_config,
              approved: true, // AUTO auto-approves
            })
          );
          // State 14 produced scene prompts -> hand off media generation.
          // Branch on the selected video provider mode: manual (Flow) vs API.
          if (n === 14) {
            const videoMode = (video.provider_config as { video?: { mode?: string } })?.video?.mode;
            if (videoMode === "manual_handoff") {
              await step.invoke("run-flow-handoff", { function: flowHandoff, data: { videoId, orgId } });
            } else {
              const fanout = (await step.invoke("run-media-fanout", {
                function: mediaFanout,
                data: { videoId, orgId },
              })) as { failed?: string[] } | null;
              if (fanout?.failed?.length) {
                await step.run("media-partial-block", () => repo.setVideoState(videoId, 14, "blocked"));
                return { status: "media_partial_failure", failed: fanout.failed };
              }
            }
          }
        } else {
          // Non-LLM AUTO states: 1 (parse), 4 (transcripts), 22 (export bundle).
          await step.run(`auto-noop-${n}`, () => handleNonLlmAuto(n, videoId));
        }
        await step.run(`advance-${n}`, () => repo.setVideoState(videoId, Math.min(n + 1, 22), "running"));
        continue;
      }

      // ── GATE state ──
      if (def.needsUpload || !schemaEntry) {
        // Upload gates (12,16) and pure-gate states: just wait for user confirmation.
        await step.run(`gate-mark-${n}`, () => repo.setVideoState(videoId, n, "awaiting_curation"));
      } else {
        const inputs = await step.run(`gate-inputs-${n}`, () => gatherInputs(n, videoId));
        await step.run(`gate-gen-${n}`, () =>
          runState({
            orgId,
            videoId,
            channelId: video.channel_id,
            stateNo: n,
            brandMemory: channel.brand_memory,
            stateInputs: inputs,
            providerConfig: video.provider_config,
            approved: false,
          })
        );
        await step.run(`gate-await-mark-${n}`, () => repo.setVideoState(videoId, n, "awaiting_curation"));
      }

      // Bounded approve/revise loop. Only ACTUAL revisions count toward the bound;
      // off-target events (a different state's gate) are ignored without consuming
      // the revision budget. A hard cap on total events processed prevents an event
      // flood from running the function into the Inngest step ceiling.
      let approved = false;
      let revisions = 0;
      let waitIdx = 0;
      while (!approved && revisions <= MAX_REVISIONS && waitIdx < MAX_GATE_EVENTS) {
        const decision = await step.waitForEvent(`await-gate-${n}-${waitIdx++}`, {
          event: "gate/decided",
          timeout: GATE_TIMEOUT,
          match: "data.videoId",
        });
        if (!decision) {
          await step.run(`gate-expire-${n}-${waitIdx}`, () => repo.setVideoState(videoId, n, "blocked"));
          return { status: "gate_expired", stateNo: n };
        }
        if (decision.data.stateNo !== n) continue; // not our gate; do not consume budget
        if (decision.data.action === "approve") {
          await step.run(`gate-approve-${n}`, () => approveGate(n, videoId, decision.data.selectedAssetId));
          approved = true;
        } else {
          revisions++;
          if (revisions > MAX_REVISIONS) break;
          await step.run(`gate-revise-${n}-${revisions}`, () =>
            reviseGate(n, videoId, orgId, video, channel, decision.data.feedback ?? "")
          );
        }
      }
      if (!approved) {
        await step.run(`gate-maxrev-${n}`, () => repo.setVideoState(videoId, n, "blocked"));
        return { status: "max_revisions", stateNo: n };
      }
      await step.run(`gate-advance-${n}`, () => repo.setVideoState(videoId, Math.min(n + 1, 22), "running"));
    }

    await step.run("complete", () => repo.setVideoState(videoId, 22, "completed"));
    return { status: "completed" };
  }
);

// ── helpers (run inside step.run for checkpointing) ──────────────────────────

async function gatherInputs(stateNo: number, videoId: string): Promise<Record<string, unknown>> {
  // Pass the minimal approved upstream outputs each state consumes.
  switch (stateNo) {
    case 10: {
      const hook = await repo.getCurrentAsset(videoId, "hook");
      return { approved_hook: hook?.content ?? null };
    }
    case 11:
    case 14: {
      const script = await repo.getCurrentAsset(videoId, "script");
      return { approved_script: script?.content ?? null };
    }
    default:
      return {};
  }
}

async function handleNonLlmAuto(stateNo: number, videoId: string) {
  // 1 parse / 4 transcripts / 22 export: wire real implementations in later phases.
  // For now they are no-ops that simply let the cursor advance.
  void stateNo;
  void videoId;
}

async function approveGate(stateNo: number, videoId: string, selectedAssetId?: string) {
  const entry = getStateSchema(stateNo);
  if (entry) await repo.markApproved(videoId, entry.assetType);
  void selectedAssetId; // for ranked outputs, mark the chosen option (Phase 2 detail)
}

async function reviseGate(
  stateNo: number,
  videoId: string,
  orgId: string,
  video: repo.VideoRow,
  channel: Awaited<ReturnType<typeof repo.getChannel>>,
  feedback: string
) {
  const entry = getStateSchema(stateNo);
  if (!entry) return;
  const prior = await repo.getCurrentAsset(videoId, entry.assetType);
  await runState({
    orgId,
    videoId,
    channelId: video.channel_id,
    stateNo,
    brandMemory: channel.brand_memory,
    providerConfig: video.provider_config,
    revision: { priorOutput: prior?.content, feedback, parentVersionId: prior?.id },
  });
  await repo.setVideoState(videoId, stateNo, "awaiting_curation");
}
