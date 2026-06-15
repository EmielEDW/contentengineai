import type { ImageProvider, ProviderContext, ProviderResult, ImageOutput } from "../types";

/**
 * fal.ai image provider (aggregator). One key, many models — pick the model via
 * `req.model` (e.g. "fal-ai/imagen4/preview", "fal-ai/nano-banana"). Uses the
 * synchronous run endpoint here; switch to the queue endpoint for large batches.
 */
export class FalImage implements ImageProvider {
  id = "fal";
  modality = "image" as const;
  capabilities = { textInImage: true, maxResolution: "2048x2048", refImages: true };

  async generate(
    req: { prompt: string; refImages?: string[]; aspectRatio: string; n?: number; model?: string },
    ctx: ProviderContext
  ): Promise<ProviderResult<ImageOutput>> {
    if (!ctx.key.secret) {
      return { ok: false, error: { code: "no_key", message: "No fal.ai key resolved", retryable: false } };
    }
    const model = req.model ?? "fal-ai/imagen4/preview";
    try {
      const res = await fetch(`https://fal.run/${model}`, {
        method: "POST",
        headers: { Authorization: `Key ${ctx.key.secret}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: req.prompt,
          image_size: aspectToFalSize(req.aspectRatio),
          num_images: req.n ?? 1,
          ...(req.refImages?.length ? { image_urls: req.refImages } : {}),
        }),
      });
      if (!res.ok) {
        return { ok: false, error: { code: `http_${res.status}`, message: await res.text(), retryable: res.status === 429 || res.status >= 500 } };
      }
      const body = (await res.json()) as { images?: { url: string }[] };
      const urls = (body.images ?? []).map((i) => i.url);
      return { ok: true, data: { urls } };
    } catch (e) {
      return { ok: false, error: { code: "network", message: (e as Error).message, retryable: true, raw: e } };
    }
  }
}

function aspectToFalSize(aspect: string): string {
  switch (aspect) {
    case "16:9":
      return "landscape_16_9";
    case "9:16":
      return "portrait_16_9";
    case "1:1":
      return "square_hd";
    default:
      return "landscape_16_9";
  }
}
