/**
 * Provider registry + per-modality fallback chains (anti-lock-in).
 *
 * fal.ai is the fast default for image/video, but at least one DIRECT provider
 * per modality is registered behind the SAME interface, so a fal outage is
 * survivable and "pluggable" is real. Adding a fal-hosted model = one entry.
 */
import type {
  AnyProvider,
  ImageProvider,
  LlmProvider,
  Modality,
  ProviderMeta,
  VideoProvider,
  VoiceProvider,
} from "./types";

import { AnthropicLlm } from "./llm/anthropic";
import { GeminiLlm } from "./llm/gemini";
import { FalImage } from "./image/fal";
import { GeminiImage } from "./image/gemini";
import { ElevenLabsVoice } from "./voice/elevenlabs";
import { VeoVideo } from "./video/veo";
import { FlowManualVideo } from "./video/flow-manual";

interface RegistryEntry {
  meta: ProviderMeta;
  instance: AnyProvider;
}

const ENTRIES: RegistryEntry[] = [
  {
    meta: { id: "gemini", modality: "llm", displayName: "Google Gemini", keyStrategy: "platform|byok", hasPublicApi: true, unit: "1k_tokens" },
    instance: new GeminiLlm(),
  },
  {
    meta: { id: "anthropic", modality: "llm", displayName: "Anthropic Claude", keyStrategy: "platform|byok", hasPublicApi: true, unit: "1k_tokens" },
    instance: new AnthropicLlm(),
  },
  {
    meta: { id: "fal", modality: "image", displayName: "fal.ai (aggregator)", keyStrategy: "platform|byok", hasPublicApi: true, unit: "image", approxCostPerUnitCents: 4 },
    instance: new FalImage(),
  },
  {
    meta: { id: "gemini", modality: "image", displayName: "Google Imagen (direct)", keyStrategy: "platform|byok", hasPublicApi: true, unit: "image", approxCostPerUnitCents: 2 },
    instance: new GeminiImage(),
  },
  {
    meta: { id: "elevenlabs", modality: "voice", displayName: "ElevenLabs", keyStrategy: "platform|byok", hasPublicApi: true, unit: "1k_chars", approxCostPerUnitCents: 30 },
    instance: new ElevenLabsVoice(),
  },
  {
    meta: { id: "veo", modality: "video", displayName: "Google Veo (Gemini API)", mode: "api", keyStrategy: "platform|byok", hasPublicApi: true, unit: "second", approxCostPerUnitCents: 15 },
    instance: new VeoVideo(),
  },
  {
    meta: { id: "flow", modality: "video", displayName: "Google Flow (manual)", mode: "manual", keyStrategy: "none", hasPublicApi: false },
    instance: new FlowManualVideo(),
  },
];

/** Default provider id per modality when nothing more specific is selected. */
export const DEFAULT_PROVIDER: Record<Modality, string> = {
  llm: "gemini",
  image: "gemini", // cheap direct default; fal available as alternative/fallback
  voice: "elevenlabs",
  video: "veo",
  youtube: "youtube",
  design: "fal",
};

/** Fallback order per modality — route around an outage of the primary. */
export const FALLBACK_CHAIN: Partial<Record<Modality, string[]>> = {
  image: ["gemini", "fal"],
  video: ["veo"], // manual flow is never an auto-fallback (no machine alternative)
};

const byKey = new Map(ENTRIES.map((e) => [`${e.meta.modality}:${e.meta.id}`, e]));

export function getProviderMeta(modality: Modality, id: string): ProviderMeta | undefined {
  return byKey.get(`${modality}:${id}`)?.meta;
}

export function listProviders(modality: Modality): ProviderMeta[] {
  return ENTRIES.filter((e) => e.meta.modality === modality).map((e) => e.meta);
}

export function getLlm(id: string): LlmProvider {
  return requireInstance("llm", id) as LlmProvider;
}
export function getImage(id: string): ImageProvider {
  return requireInstance("image", id) as ImageProvider;
}
export function getVoice(id: string): VoiceProvider {
  return requireInstance("voice", id) as VoiceProvider;
}
export function getVideo(id: string): VideoProvider {
  return requireInstance("video", id) as VideoProvider;
}

function requireInstance(modality: Modality, id: string): AnyProvider {
  const e = byKey.get(`${modality}:${id}`);
  if (!e) throw new Error(`No ${modality} provider registered: ${id}`);
  return e.instance;
}
