import type { ImageProvider, ProviderContext, ProviderResult, ImageOutput } from "../types";

/**
 * Direct Google Imagen provider via the Gemini API (anti-lock-in: a non-fal path
 * for image generation behind the same interface). Returns base64 images which the
 * caller persists to Supabase Storage and replaces with signed URLs.
 *
 * NOTE: the exact model id / endpoint shape should be validated against the live
 * Gemini API docs at implementation time (Phase 3).
 */
export class GeminiImage implements ImageProvider {
  id = "gemini";
  modality = "image" as const;
  capabilities = { textInImage: true, maxResolution: "2048x2048", refImages: false };

  async generate(
    req: { prompt: string; aspectRatio: string; n?: number; model?: string },
    ctx: ProviderContext
  ): Promise<ProviderResult<ImageOutput>> {
    if (!ctx.key.secret) {
      return { ok: false, error: { code: "no_key", message: "No Gemini API key resolved", retryable: false } };
    }
    const model = req.model ?? "imagen-4.0-fast-generate-001";
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${ctx.key.secret}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instances: [{ prompt: req.prompt }],
            parameters: { sampleCount: req.n ?? 1, aspectRatio: req.aspectRatio },
          }),
        }
      );
      if (!res.ok) {
        return { ok: false, error: { code: `http_${res.status}`, message: await res.text(), retryable: res.status === 429 || res.status >= 500 } };
      }
      const body = (await res.json()) as { predictions?: { bytesBase64Encoded?: string }[] };
      // The orchestrator persists these to Storage; we surface data URLs here.
      const urls = (body.predictions ?? [])
        .map((p) => (p.bytesBase64Encoded ? `data:image/png;base64,${p.bytesBase64Encoded}` : null))
        .filter((u): u is string => !!u);
      return { ok: true, data: { urls } };
    } catch (e) {
      return { ok: false, error: { code: "network", message: (e as Error).message, retryable: true, raw: e } };
    }
  }
}
