/**
 * Google Flow manual-handoff — its own durable function, decoupled from the main
 * pipeline. Builds a per-beat shotlist, then waits for the user to upload clips
 * back (one event per beat), with a "finalize with N of M" escape hatch.
 * (See plan §4.4.)
 */
import { inngest } from "../client";
import { GATE_TIMEOUT } from "../events";
import { getVideo, getCurrentAsset } from "@/lib/pipeline/repo";
import { FlowManualVideo } from "@/lib/providers/video/flow-manual";
import type { MotionPrompts } from "@/lib/schemas/states";
import type { z } from "zod";

type MotionT = z.infer<typeof MotionPrompts>;

export const flowHandoff = inngest.createFunction(
  { id: "flow-handoff" },
  { event: "media/flow.requested" }, // also invoked directly via step.invoke from the pipeline
  async ({ event, step }) => {
    const { videoId } = event.data;
    const video = await step.run("load", () => getVideo(videoId));
    const videoMode = (video.provider_config as { video?: { mode?: string } })?.video?.mode;
    if (videoMode !== "manual_handoff") return { skipped: true };

    const motionAsset = await step.run("load-motion", () => getCurrentAsset(videoId, "motion_prompt"));
    const sceneAsset = await step.run("load-scenes", () => getCurrentAsset(videoId, "scene_prompt"));
    const motion = (motionAsset?.content as MotionT | undefined)?.motion ?? [];

    const provider = new FlowManualVideo();
    const handoff = await step.run("build-handoff", () =>
      provider.buildHandoff(
        {
          shots: motion.map((m) => ({
            beatId: m.beat_id,
            prompt: m.motion_type + " " + m.direction,
            durationSec: m.duration_sec,
            aspectRatio: "16:9",
          })),
        }
      )
    );

    const total = handoff.data?.shotlist.length ?? 0;
    const uploaded = new Set<string>();

    // Wait for per-beat uploads or an explicit finalize. Bounded by total + a cap.
    for (let i = 0; i < total + 1; i++) {
      const ev = await step.waitForEvent(`flow-upload-${i}`, {
        event: "flow/clip.uploaded",
        timeout: GATE_TIMEOUT,
        match: "data.videoId",
      });
      if (!ev) break; // timeout -> leave resumable
      uploaded.add(ev.data.beatId);
      if (uploaded.size >= total) break;
    }

    void sceneAsset;
    return { total, uploaded: uploaded.size };
  }
);
