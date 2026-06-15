/**
 * Media fan-out — generates one image per scene-prompt beat. Runs as its OWN
 * function (invoked from the pipeline) so the 70-120 per-beat steps never count
 * against the main pipeline's step ceiling, and media retries stay isolated from
 * the gate state machine. Partial failures are surfaced as a 'partial' status with
 * a "retry these N" list rather than failing the whole batch.
 */
import { inngest } from "../client";
import { getImage } from "@/lib/providers/registry";
import { resolveProviderId, resolvePlatformKey } from "@/lib/providers/resolve";
import * as repo from "@/lib/pipeline/repo";
import type { ScenePromptsT } from "@/lib/schemas/states";

export const mediaFanout = inngest.createFunction(
  {
    id: "media-fanout",
    // Per-org fairness + don't hammer the provider; tune per provider rate limits.
    concurrency: [{ key: "event.data.orgId", limit: 2 }],
  },
  { event: "media/fanout.requested" },
  async ({ event, step }) => {
    const { videoId, orgId } = event.data;

    const video = await step.run("load-video", () => repo.getVideo(videoId));
    const channel = await step.run("load-channel", () => repo.getChannel(video.channel_id));
    const scenesAsset = await step.run("load-scenes", () => repo.getCurrentAsset(videoId, "scene_prompt"));
    const scenes = (scenesAsset?.content as ScenePromptsT | undefined)?.scenes ?? [];

    const imageProviderId = resolveProviderId("image", {
      videoConfig: video.provider_config,
      channelProviders: channel.brand_memory?.providers,
    });
    const key = resolvePlatformKey(imageProviderId);
    const image = getImage(imageProviderId);

    const results = await Promise.all(
      scenes.map((scene) =>
        step.run(`image-${scene.beat_id}`, async () => {
          const res = await image.generate(
            { prompt: scene.image_prompt, aspectRatio: "16:9", n: 1 },
            { orgId, channelId: video.channel_id, projectId: videoId, key }
          );
          if (!res.ok || !res.data?.urls.length) {
            return { beatId: scene.beat_id, ok: false };
          }
          // TODO(Phase 3): download res.data.urls[0] -> Supabase Storage,
          // then insert a media_files row (source='generated') linked to the asset.
          if (res.costCents) {
            await repo.recordUsage({
              orgId,
              videoId,
              providerId: imageProviderId,
              modality: "image",
              costCents: res.costCents,
              keySource: key.source,
              note: `scene_${scene.beat_id}`,
            });
          }
          return { beatId: scene.beat_id, ok: true };
        })
      )
    );

    const failed = results.filter((r) => !r.ok).map((r) => r.beatId);
    // Do NOT mutate videos.current_state here — the pipeline owns the cursor and
    // inspects this return value to decide whether to block on partial failure.
    return { generated: results.length - failed.length, failed };
  }
);
