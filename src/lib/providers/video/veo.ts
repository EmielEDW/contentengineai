import type { VideoProvider, ProviderContext, ProviderResult, VideoJob } from "../types";

/**
 * Google Veo via the Gemini API (the real, programmatic path — distinct from the
 * consumer "Flow" app). Video generation is long-running: this kicks off an
 * operation and returns its name as a jobId; a poller resolves it to a file URL.
 *
 * Validate model id ("veo-3.0-fast-generate-001" etc.) + operation shape against
 * the live Gemini API docs at implementation time (Phase 4).
 */
export class VeoVideo implements VideoProvider {
  id = "veo";
  modality = "video" as const;
  mode = "api" as const;

  async generate(
    req: { prompt: string; refImage?: string; durationSec: number; aspectRatio: string; model?: string },
    ctx: ProviderContext
  ): Promise<ProviderResult<VideoJob>> {
    if (!ctx.key.secret) {
      return { ok: false, error: { code: "no_key", message: "No Gemini API key resolved for Veo", retryable: false } };
    }
    const model = req.model ?? "veo-3.0-fast-generate-001";
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning?key=${ctx.key.secret}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instances: [{ prompt: req.prompt, ...(req.refImage ? { image: { imageUri: req.refImage } } : {}) }],
            parameters: { aspectRatio: req.aspectRatio, durationSeconds: req.durationSec },
          }),
        }
      );
      if (!res.ok) {
        return { ok: false, error: { code: `http_${res.status}`, message: await res.text(), retryable: res.status === 429 || res.status >= 500 } };
      }
      const body = (await res.json()) as { name?: string };
      if (!body.name) return { ok: false, error: { code: "no_operation", message: "No operation name returned", retryable: true } };
      return { ok: true, jobId: body.name, data: { jobId: body.name } };
    } catch (e) {
      return { ok: false, error: { code: "network", message: (e as Error).message, retryable: true, raw: e } };
    }
  }
}
