/**
 * Pluggable provider layer — one narrow interface per modality. Interfaces speak
 * in domain terms (prompt, reference frames, duration, aspect ratio); each
 * provider translates to its own request shape. All generation is async-first.
 */

export type Modality = "llm" | "image" | "voice" | "video" | "youtube" | "design";

export interface ProviderError {
  code: string;
  message: string;
  retryable: boolean;
  raw?: unknown;
}

export interface ProviderResult<T> {
  ok: boolean;
  data?: T;
  /** For long-running async jobs (video, batch image): poll/webhook updates the asset. */
  jobId?: string;
  costCents?: number;
  error?: ProviderError;
}

/** Resolved key handed to a provider call — never the raw secret outside the server. */
export interface ResolvedKey {
  providerId: string;
  /** 'platform' = our key; 'byok' = the tenant's own key. */
  source: "platform" | "byok";
  /** Plaintext secret, fetched server-side from Vault/env immediately before the call. */
  secret: string | null;
}

export interface ProviderContext {
  orgId: string;
  channelId: string;
  projectId: string;
  key: ResolvedKey;
}

// ── LLM ──────────────────────────────────────────────────────────────────────
export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
export interface LlmOutput {
  text: string;
  /** Parsed JSON when a jsonSchema was supplied. */
  json?: unknown;
  tokensIn?: number;
  tokensOut?: number;
}
export interface LlmProvider {
  id: string;
  modality: "llm";
  capabilities: { vision: boolean; maxContextTokens: number; json: boolean };
  complete(
    req: {
      system?: string;
      messages: LlmMessage[];
      jsonSchema?: object;
      jsonSchemaName?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
    },
    ctx: ProviderContext
  ): Promise<ProviderResult<LlmOutput>>;
}

// ── Image ────────────────────────────────────────────────────────────────────
export interface ImageOutput {
  /** Remote URLs of generated images (download + store in Supabase Storage). */
  urls: string[];
}
export interface ImageProvider {
  id: string;
  modality: "image";
  capabilities: { textInImage: boolean; maxResolution: string; refImages: boolean };
  generate(
    req: { prompt: string; refImages?: string[]; aspectRatio: string; n?: number; model?: string },
    ctx: ProviderContext
  ): Promise<ProviderResult<ImageOutput>>;
}

// ── Voice ────────────────────────────────────────────────────────────────────
export interface VoiceDesign {
  voiceId: string;
  previewUrl?: string;
}
export interface AudioOutput {
  url: string;
  durationMs?: number;
}
export interface VoiceProvider {
  id: string;
  modality: "voice";
  designVoice(
    req: { description: string; guidanceScale: number; loudness: number; previewText: string },
    ctx: ProviderContext
  ): Promise<ProviderResult<VoiceDesign>>;
  synthesize(
    req: { voiceId: string; text: string; modelId?: string },
    ctx: ProviderContext
  ): Promise<ProviderResult<AudioOutput>>;
}

// ── Video ────────────────────────────────────────────────────────────────────
export interface VideoJob {
  /** API mode: a provider job id to poll. Manual mode: omitted. */
  jobId?: string;
  url?: string;
}
/** Returned by manual-handoff providers (e.g. Google Flow) instead of a job. */
export interface VideoHandoff {
  mode: "manual";
  instructions: string;
  /** Per-beat shotlist for the user to render externally and upload back. */
  shotlist: Array<{ beatId: string; prompt: string; durationSec: number; aspectRatio: string }>;
}
export interface VideoProvider {
  id: string;
  modality: "video";
  mode: "api" | "manual";
  generate(
    req: { prompt: string; refImage?: string; durationSec: number; aspectRatio: string; model?: string },
    ctx: ProviderContext
  ): Promise<ProviderResult<VideoJob>>;
  /** Manual providers build a handoff package for a whole batch of beats. */
  buildHandoff?(
    req: { shots: Array<{ beatId: string; prompt: string; durationSec: number; aspectRatio: string }> },
    ctx: ProviderContext
  ): Promise<ProviderResult<VideoHandoff>>;
}

export type AnyProvider =
  | LlmProvider
  | ImageProvider
  | VoiceProvider
  | VideoProvider;

export interface ProviderMeta {
  id: string;
  modality: Modality;
  displayName: string;
  mode?: "api" | "manual";
  /** Used for the cost-estimate gate before media fan-out. */
  approxCostPerUnitCents?: number;
  unit?: "image" | "second" | "1k_chars" | "1k_tokens";
  keyStrategy: "platform" | "byok" | "platform|byok" | "none";
  hasPublicApi: boolean;
}
