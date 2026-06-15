/**
 * Maps a state's model class (cheap/mid/strong) to a concrete model id per LLM
 * provider. Per-state model routing keeps AUTO analysis cheap and reserves the
 * strong model for script generation (10) and the audit (11). Overridable per
 * tenant via provider_config.
 */
import type { ModelClass } from "./prompts/states";

export const MODEL_BY_CLASS: Record<string, Record<ModelClass, string>> = {
  anthropic: {
    cheap: "claude-haiku-4-5-20251001",
    mid: "claude-sonnet-4-6",
    strong: "claude-opus-4-8",
  },
  gemini: {
    cheap: "gemini-2.5-flash",
    mid: "gemini-3-pro",
    strong: "gemini-3-pro",
  },
};

export function modelFor(providerId: string, cls: ModelClass): string | undefined {
  return MODEL_BY_CLASS[providerId]?.[cls];
}
