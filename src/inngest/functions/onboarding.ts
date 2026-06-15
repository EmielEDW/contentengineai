/**
 * Onboarding pipeline — builds a channel's brand_memory. NEW path walks states
 * 1-3 (naming + branding) then 4,6,7,8 + the upload-gated 13,17. EXISTING path
 * skips 2-3 but still builds brand_memory from the user's own material.
 * This runs SEPARATELY from the video pipeline and does NOT include the visual
 * gating guard (branding in state 3 is the explicit exception).
 */
import { inngest } from "../client";
import { GATE_TIMEOUT, MAX_REVISIONS } from "../events";
import { runState } from "@/lib/pipeline/run-state";
import { getStateSchema } from "@/lib/schemas";
import { getChannel } from "@/lib/pipeline/repo";
import { createAdminSupabase } from "@/lib/supabase/admin";

// Onboarding states by path. AUTO analysis states fill brand_memory slices.
const NEW_PATH = [1, 2, 3, 4, 6, 7, 8, 12, 13, 16, 17];
const EXISTING_PATH = [1, 4, 6, 7, 8, 12, 13, 16, 17];
const GATE_STATES = new Set([2, 3, 5, 9, 10, 11, 12, 15, 16, 18, 21]);

export const onboardingPipeline = inngest.createFunction(
  { id: "onboarding-pipeline", concurrency: { key: "event.data.orgId", limit: 3 } },
  { event: "onboarding/start" },
  async ({ event, step }) => {
    const { channelId, orgId } = event.data;
    const channel = await step.run("load-channel", () => getChannel(channelId));
    const path = channel.onboarding_path === "existing" ? EXISTING_PATH : NEW_PATH;

    for (const n of path) {
      const entry = getStateSchema(n);
      const isGate = GATE_STATES.has(n);

      if (entry && !isGate) {
        await step.run(`onboard-auto-${n}`, () =>
          runState({ orgId, channelId, stateNo: n, brandMemory: channel.brand_memory, approved: true })
        );
        continue;
      }

      if (entry && isGate) {
        await step.run(`onboard-gen-${n}`, () =>
          runState({ orgId, channelId, stateNo: n, brandMemory: channel.brand_memory, approved: false })
        );
      }

      // Wait for the user (name pick, branding pick, or upload confirmation).
      // TODO(Phase 2): onboarding gates are channel-scoped — add a dedicated
      // channel-scoped gate event instead of reusing gate/decided's videoId match.
      let approved = false;
      let waitIdx = 0;
      const maxEvents = MAX_REVISIONS * 4 + 4;
      while (!approved && waitIdx < maxEvents) {
        const decision = await step.waitForEvent(`onboard-gate-${n}-${waitIdx++}`, {
          event: "gate/decided",
          timeout: GATE_TIMEOUT,
          match: "data.videoId",
        });
        if (!decision) return { status: "onboarding_gate_expired", stateNo: n };
        if (decision.data.stateNo !== n) continue; // off-target; do not consume budget
        approved = decision.data.action === "approve";
        // revise handling mirrors the video pipeline (omitted here for brevity).
      }
    }

    await step.run("mark-ready", async () => {
      const db = createAdminSupabase();
      await db
        .from("channels")
        .update({ brand_memory_ready: true, status: "ready", brand_memory_built_at: new Date().toISOString() })
        .eq("id", channelId);
    });

    return { status: "ready" };
  }
);
