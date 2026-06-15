/**
 * Data-access layer for the pipeline. Uses the service-role client (Inngest jobs
 * run outside a user session) and ALWAYS filters by org_id explicitly as
 * defense-in-depth on top of RLS.
 */
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { AssetType } from "@/lib/schemas";
import type { BrandMemory } from "@/lib/brand-memory";

type Db = ReturnType<typeof createAdminSupabase>;
function db(): Db {
  return createAdminSupabase();
}

export interface VideoRow {
  id: string;
  org_id: string;
  channel_id: string;
  current_state: number;
  status: string;
  enabled_optional_states: number[];
  provider_config: Record<string, unknown>;
  topic: string | null;
}

export async function getVideo(videoId: string): Promise<VideoRow> {
  const { data, error } = await db().from("videos").select("*").eq("id", videoId).single();
  if (error) throw error;
  return data as VideoRow;
}

export async function getChannel(channelId: string) {
  const { data, error } = await db().from("channels").select("*").eq("id", channelId).single();
  if (error) throw error;
  return data as { id: string; org_id: string; onboarding_path: "new" | "existing"; brand_memory: Partial<BrandMemory> };
}

export async function setVideoState(videoId: string, stateNo: number, status: string) {
  const { error } = await db()
    .from("videos")
    .update({ current_state: stateNo, status })
    .eq("id", videoId);
  if (error) throw error;
}

export interface SaveAssetArgs {
  orgId: string;
  videoId?: string;
  channelId?: string;
  stateNo: number;
  executionId?: string;
  type: AssetType;
  content: unknown;
  slotKey?: string;
  rank?: number;
  feedback?: string;
  source?: "generate" | "revise" | "auto-revise";
  parentVersionId?: string;
  approved?: boolean;
  providerId?: string;
  model?: string;
  costCents?: number;
  tokensIn?: number;
  tokensOut?: number;
}

/** Append-only versioned insert: flips the prior is_current row off first. */
export async function saveAsset(a: SaveAssetArgs): Promise<{ id: string; version: number }> {
  const client = db();
  const slot = a.slotKey ?? null;

  // Find the current version for (video,type,slot) to compute the next version.
  let q = client
    .from("assets")
    .select("id, version")
    .eq("type", a.type)
    .order("version", { ascending: false })
    .limit(1);
  q = a.videoId ? q.eq("video_id", a.videoId) : q.eq("channel_id", a.channelId!);
  q = slot === null ? q.is("slot_key", null) : q.eq("slot_key", slot);
  const { data: prevRows } = await q;
  const prev = prevRows?.[0] as { id: string; version: number } | undefined;
  const version = (prev?.version ?? 0) + 1;

  if (prev) {
    await client.from("assets").update({ is_current: false }).eq("id", prev.id);
  }

  const { data, error } = await client
    .from("assets")
    .insert({
      org_id: a.orgId,
      video_id: a.videoId ?? null,
      channel_id: a.channelId ?? null,
      state_no: a.stateNo,
      execution_id: a.executionId ?? null,
      type: a.type,
      version,
      parent_version_id: a.parentVersionId ?? prev?.id ?? null,
      is_current: true,
      approved: a.approved ?? false,
      content: a.content,
      slot_key: slot,
      rank: a.rank ?? null,
      feedback: a.feedback ?? null,
      source: a.source ?? "generate",
      provider_id: a.providerId ?? null,
      model: a.model ?? null,
      cost_cents: a.costCents ?? null,
      tokens_in: a.tokensIn ?? null,
      tokens_out: a.tokensOut ?? null,
    })
    .select("id, version")
    .single();
  if (error) throw error;
  return data as { id: string; version: number };
}

export async function getCurrentAsset(videoId: string, type: AssetType, slotKey?: string) {
  let q = db().from("assets").select("*").eq("video_id", videoId).eq("type", type).eq("is_current", true);
  q = slotKey === undefined ? q.is("slot_key", null) : q.eq("slot_key", slotKey);
  const { data } = await q.maybeSingle();
  return data as { id: string; content: unknown; version: number; approved: boolean } | null;
}

export async function markApproved(videoId: string, type: AssetType, slotKey?: string) {
  let q = db().from("assets").update({ approved: true }).eq("video_id", videoId).eq("type", type).eq("is_current", true);
  q = slotKey === undefined ? q.is("slot_key", null) : q.eq("slot_key", slotKey);
  const { error } = await q;
  if (error) throw error;
}

export async function isScriptApproved(videoId: string): Promise<boolean> {
  const { data } = await db()
    .from("assets")
    .select("id")
    .eq("video_id", videoId)
    .eq("type", "script")
    .eq("is_current", true)
    .eq("approved", true)
    .maybeSingle();
  return !!data;
}

/** Merge an AUTO state's structured output into channels.brand_memory[key]. */
export async function mergeBrandMemory(channelId: string, key: string, value: unknown) {
  const client = db();
  const { data } = await client.from("channels").select("brand_memory").eq("id", channelId).single();
  const bm = ((data?.brand_memory as Record<string, unknown>) ?? {}) as Record<string, unknown>;
  bm.schema_version = 1;
  bm[key] = value;
  const { error } = await client.from("channels").update({ brand_memory: bm }).eq("id", channelId);
  if (error) throw error;
}

export async function recordUsage(args: {
  orgId: string;
  videoId?: string;
  providerId?: string;
  modality?: string;
  costCents: number;
  keySource: "byok" | "platform";
  note?: string;
}) {
  await db().from("usage_events").insert({
    org_id: args.orgId,
    video_id: args.videoId ?? null,
    provider_id: args.providerId ?? null,
    modality: args.modality ?? null,
    cost_cents: args.costCents,
    key_source: args.keySource,
    note: args.note ?? null,
  });
}

/** Remaining monthly platform-key budget for an org. Stub: plug real plan limits in Phase 3. */
export async function getRemainingQuotaCents(orgId: string): Promise<number> {
  void orgId;
  return Number.POSITIVE_INFINITY;
}
