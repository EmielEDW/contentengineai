import type { VoiceProvider, ProviderContext, ProviderResult, VoiceDesign, AudioOutput } from "../types";

/**
 * ElevenLabs voice provider (direct, for deep Voice Design control).
 *
 * Voice DESIGN (synthetic from a text prompt) is unrestricted. Voice CLONE (from
 * an audio sample) must be gated behind an own-voice consent attestation upstream
 * — this provider does not expose cloning. (See compliance plan §7.)
 */
export class ElevenLabsVoice implements VoiceProvider {
  id = "elevenlabs";
  modality = "voice" as const;

  async designVoice(
    req: { description: string; guidanceScale: number; loudness: number; previewText: string },
    ctx: ProviderContext
  ): Promise<ProviderResult<VoiceDesign>> {
    if (!ctx.key.secret) {
      return { ok: false, error: { code: "no_key", message: "No ElevenLabs key resolved", retryable: false } };
    }
    try {
      const res = await fetch("https://api.elevenlabs.io/v1/text-to-voice/design", {
        method: "POST",
        headers: { "xi-api-key": ctx.key.secret, "Content-Type": "application/json" },
        body: JSON.stringify({
          voice_description: req.description,
          guidance_scale: req.guidanceScale,
          loudness: req.loudness,
          text: req.previewText,
        }),
      });
      if (!res.ok) {
        return { ok: false, error: { code: `http_${res.status}`, message: await res.text(), retryable: res.status === 429 || res.status >= 500 } };
      }
      const body = (await res.json()) as { previews?: { generated_voice_id: string; audio_base_64?: string }[] };
      const first = body.previews?.[0];
      if (!first) return { ok: false, error: { code: "empty", message: "No voice preview returned", retryable: true } };
      return { ok: true, data: { voiceId: first.generated_voice_id } };
    } catch (e) {
      return { ok: false, error: { code: "network", message: (e as Error).message, retryable: true, raw: e } };
    }
  }

  async synthesize(
    req: { voiceId: string; text: string; modelId?: string },
    ctx: ProviderContext
  ): Promise<ProviderResult<AudioOutput>> {
    if (!ctx.key.secret) {
      return { ok: false, error: { code: "no_key", message: "No ElevenLabs key resolved", retryable: false } };
    }
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${req.voiceId}`, {
        method: "POST",
        headers: { "xi-api-key": ctx.key.secret, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text: req.text, model_id: req.modelId ?? "eleven_multilingual_v2" }),
      });
      if (!res.ok) {
        return { ok: false, error: { code: `http_${res.status}`, message: await res.text(), retryable: res.status === 429 || res.status >= 500 } };
      }
      // Caller streams this to Supabase Storage and stores the resulting signed URL.
      const buf = Buffer.from(await res.arrayBuffer());
      const dataUrl = `data:audio/mpeg;base64,${buf.toString("base64")}`;
      return { ok: true, data: { url: dataUrl } };
    } catch (e) {
      return { ok: false, error: { code: "network", message: (e as Error).message, retryable: true, raw: e } };
    }
  }
}
