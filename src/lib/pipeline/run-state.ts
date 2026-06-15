/**
 * runState — the generic "one LLM state" executor:
 *   build messages -> resolve LLM provider+key -> force JSON schema -> validate ->
 *   persist a versioned asset -> (for onboarding AUTO states) merge brand_memory.
 *
 * Used by both the video pipeline and the onboarding pipeline. GATE vs AUTO and
 * advancing the cursor is decided by the caller (the Inngest function), not here.
 */
import { buildMessages } from "@/lib/prompts/registry";
import { getStateSchema, jsonSchemaFor } from "@/lib/schemas";
import { getLlm } from "@/lib/providers/registry";
import { resolveProviderId, resolvePlatformKey, type ProviderConfig, type ChannelProviders } from "@/lib/providers/resolve";
import { modelFor } from "@/lib/models";
import type { BrandMemory } from "@/lib/brand-memory";
import * as repo from "./repo";

export interface RunStateArgs {
  orgId: string;
  videoId?: string;
  channelId?: string;
  stateNo: number;
  brandMemory?: Partial<BrandMemory>;
  stateInputs?: Record<string, unknown>;
  providerConfig?: ProviderConfig;
  channelProviders?: ChannelProviders;
  revision?: { priorOutput: unknown; feedback: string; parentVersionId?: string };
  approved?: boolean; // AUTO states may auto-approve
}

export interface RunStateResult {
  assetId: string;
  version: number;
  output: unknown;
}

export async function runState(args: RunStateArgs): Promise<RunStateResult> {
  const entry = getStateSchema(args.stateNo);
  if (!entry) throw new Error(`State ${args.stateNo} is not an LLM-structured state`);

  const built = buildMessages({
    stateNo: args.stateNo,
    brandMemory: args.brandMemory,
    stateInputs: args.stateInputs,
    revision: args.revision ? { priorOutput: args.revision.priorOutput, feedback: args.revision.feedback } : undefined,
  });

  const providerId = resolveProviderId("llm", {
    videoConfig: args.providerConfig,
    channelProviders: args.channelProviders,
  });
  const key = resolvePlatformKey(providerId); // TODO(Phase 3): prefer BYOK from Vault
  const llm = getLlm(providerId);
  const model = modelFor(providerId, built.modelClass);

  const schemaName = `state_${args.stateNo}`;
  const jsonSchema = jsonSchemaFor(args.stateNo, schemaName) as object;
  const baseMessages = built.messages;

  // Generate + validate, with one corrective retry if the JSON doesn't match the
  // schema (models occasionally deviate; we re-ask with the validation error).
  let output: unknown;
  let result: Awaited<ReturnType<typeof llm.complete>> | undefined;
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const messages =
      attempt === 0
        ? baseMessages
        : [
            ...baseMessages,
            {
              role: "user" as const,
              content: `Your previous output failed validation: ${lastError}. Return corrected JSON that matches the schema EXACTLY (same keys, correct types, required array lengths). Output JSON only.`,
            },
          ];
    result = await llm.complete(
      { system: built.system, messages, jsonSchema, jsonSchemaName: schemaName, model, temperature: built.modelClass === "strong" ? 0.7 : 0.5 },
      { orgId: args.orgId, channelId: args.channelId ?? "", projectId: args.videoId ?? "", key }
    );
    if (!result.ok || !result.data) {
      const err = result.error;
      const e = new Error(`State ${args.stateNo} LLM call failed: ${err?.message ?? "unknown"}`);
      (e as Error & { retryable?: boolean }).retryable = err?.retryable ?? true;
      throw e;
    }
    const parsed = entry.schema.safeParse(result.data.json);
    if (parsed.success) {
      output = parsed.data;
      break;
    }
    lastError = parsed.error.message.slice(0, 500);
  }
  if (output === undefined || !result?.data) {
    throw new Error(`State ${args.stateNo} output failed schema validation after retry: ${lastError}`);
  }

  const saved = await repo.saveAsset({
    orgId: args.orgId,
    videoId: args.videoId,
    channelId: args.channelId,
    stateNo: args.stateNo,
    type: entry.assetType,
    content: output,
    approved: args.approved ?? false,
    source: args.revision ? "revise" : "generate",
    parentVersionId: args.revision?.parentVersionId,
    feedback: args.revision?.feedback,
    providerId,
    model,
    costCents: result.costCents,
    tokensIn: result.data.tokensIn,
    tokensOut: result.data.tokensOut,
  });

  if (result.costCents) {
    await repo.recordUsage({
      orgId: args.orgId,
      videoId: args.videoId,
      providerId,
      modality: "llm",
      costCents: result.costCents,
      keySource: key.source,
      note: `state_${args.stateNo}`,
    });
  }

  // Onboarding AUTO states feed brand_memory.
  if (entry.brandMemoryKey && args.channelId) {
    await repo.mergeBrandMemory(args.channelId, entry.brandMemoryKey, output);
  }

  return { assetId: saved.id, version: saved.version, output };
}
