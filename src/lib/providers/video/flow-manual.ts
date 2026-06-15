import type { VideoProvider, ProviderResult, VideoJob, VideoHandoff } from "../types";

/**
 * Google Flow has NO public API. This is a first-class manual-handoff provider:
 * instead of starting a job, it builds a shotlist the user renders in Flow and
 * uploads back. The flowHandoff Inngest function tracks per-beat status and lets
 * the user finalise with N-of-M clips. (See plan §4.4.)
 */
export class FlowManualVideo implements VideoProvider {
  id = "flow";
  modality = "video" as const;
  mode = "manual" as const;

  async generate(): Promise<ProviderResult<VideoJob>> {
    return {
      ok: false,
      error: {
        code: "manual_only",
        message: "Flow is manual-handoff only; use buildHandoff() to produce a shotlist.",
        retryable: false,
      },
    };
  }

  async buildHandoff(
    req: { shots: Array<{ beatId: string; prompt: string; durationSec: number; aspectRatio: string }> }
  ): Promise<ProviderResult<VideoHandoff>> {
    return {
      ok: true,
      data: {
        mode: "manual",
        instructions:
          "Google Flow has no API. For each shot: copy the prompt into Flow, render the clip, " +
          "then upload it back named beat_<NN>.mp4. You can finalise with a subset and add the rest later.",
        shotlist: req.shots,
      },
    };
  }
}
