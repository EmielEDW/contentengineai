/**
 * Provider + key resolution.
 *
 * Resolution order (most specific wins):
 *   1. per-project override  (videos.provider_config[modality].provider_id)
 *   2. per-channel default   (channels.brand_memory.providers[modality])
 *   3. platform default      (DEFAULT_PROVIDER)
 *   4. hard fallback         (FALLBACK_CHAIN)
 *
 * Key resolution: a tenant BYO key (api_keys -> Vault) wins when present and valid;
 * otherwise the platform key from env, if the plan allows it.
 */
import { serverEnv } from "@/lib/env";
import type { Modality, ResolvedKey } from "./types";
import { DEFAULT_PROVIDER, FALLBACK_CHAIN, getProviderMeta } from "./registry";

export interface ProviderConfigEntry {
  provider_id?: string;
  model?: string;
  voice_id?: string;
  mode?: "api" | "manual_handoff";
  api_key_id?: string | null;
}
export type ProviderConfig = Partial<Record<Modality, ProviderConfigEntry>>;

export interface ChannelProviders {
  llm?: string;
  image?: string;
  voice?: string;
  video?: string;
}

export function resolveProviderId(
  modality: Modality,
  opts: { videoConfig?: ProviderConfig; channelProviders?: ChannelProviders }
): string {
  const fromVideo = opts.videoConfig?.[modality]?.provider_id;
  if (fromVideo) return fromVideo;
  const fromChannel = opts.channelProviders?.[modality as keyof ChannelProviders];
  if (fromChannel) return fromChannel;
  const def = DEFAULT_PROVIDER[modality];
  if (getProviderMeta(modality, def)) return def;
  const chain = FALLBACK_CHAIN[modality];
  if (chain && chain.length) return chain[0]!;
  throw new Error(`No provider resolvable for modality ${modality}`);
}

/**
 * Resolve the secret for a provider. In production this reads a tenant BYO key
 * from Supabase Vault (via api_keys.secret_id) using a service-role client;
 * falls back to the platform env key. Here we read env directly and leave a TODO
 * for the Vault BYO lookup (Phase 3).
 */
export function resolvePlatformKey(providerId: string): ResolvedKey {
  const env = serverEnv();
  const map: Record<string, string | undefined> = {
    anthropic: env.ANTHROPIC_API_KEY,
    gemini: env.GEMINI_API_KEY,
    fal: env.FAL_KEY,
    elevenlabs: env.ELEVENLABS_API_KEY,
  };
  return { providerId, source: "platform", secret: map[providerId] ?? null };
}

// TODO(Phase 3): resolveByokKey(orgId, providerId, modality) ->
//   read api_keys -> vault.decrypted_secrets with the service-role client.
