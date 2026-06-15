"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { runState } from "@/lib/pipeline/run-state";
import { getStateSchema } from "@/lib/schemas";
import * as repo from "@/lib/pipeline/repo";

interface OwnedVideo {
  id: string;
  channel_id: string;
  topic: string | null;
  current_state: number;
  provider_config: Record<string, unknown>;
}

async function loadOwned(videoId: string) {
  const { supabase, orgId } = await requireSession();
  const { data: video } = await supabase
    .from("videos")
    .select("id, channel_id, topic, current_state, provider_config")
    .eq("id", videoId)
    .maybeSingle();
  if (!video) redirect("/dashboard");
  const { data: channel } = await supabase
    .from("channels")
    .select("brand_memory")
    .eq("id", (video as OwnedVideo).channel_id)
    .maybeSingle();
  return { orgId, video: video as OwnedVideo, brandMemory: (channel?.brand_memory ?? {}) as Record<string, unknown> };
}

function fail(channelId: string, videoId: string, msg: string): never {
  redirect(`/c/${channelId}?video=${videoId}&error=${encodeURIComponent(msg)}`);
}
function done(channelId: string, videoId: string): never {
  revalidatePath(`/c/${channelId}`);
  redirect(`/c/${channelId}?video=${videoId}`);
}

/** State 9 — generate 5 hooks from the topic. */
export async function startGenerationAction(formData: FormData) {
  const videoId = String(formData.get("video_id") ?? "");
  const { orgId, video, brandMemory } = await loadOwned(videoId);
  try {
    await runState({
      orgId,
      videoId,
      channelId: video.channel_id,
      stateNo: 9,
      brandMemory,
      stateInputs: { topic: video.topic },
      providerConfig: video.provider_config,
    });
    await repo.setVideoState(videoId, 9, "awaiting_curation");
  } catch (e) {
    fail(video.channel_id, videoId, (e as Error).message);
  }
  done(video.channel_id, videoId);
}

/** Approve a hook → generate the script (10) → run the audit (11). */
export async function approveHookAction(formData: FormData) {
  const videoId = String(formData.get("video_id") ?? "");
  const hookIndex = Number(formData.get("hook_index") ?? 0);
  const { orgId, video, brandMemory } = await loadOwned(videoId);
  try {
    const hooks = await repo.getCurrentAsset(videoId, "hook");
    const options = (hooks?.content as { options?: { text: string }[] } | undefined)?.options ?? [];
    const chosen = options[hookIndex]?.text ?? options[0]?.text ?? "";
    await repo.markApproved(videoId, "hook");

    const script = await runState({
      orgId,
      videoId,
      channelId: video.channel_id,
      stateNo: 10,
      brandMemory,
      stateInputs: { approved_hook: chosen, topic: video.topic },
      providerConfig: video.provider_config,
    });
    await runState({
      orgId,
      videoId,
      channelId: video.channel_id,
      stateNo: 11,
      brandMemory,
      stateInputs: { approved_script: script.output },
      providerConfig: video.provider_config,
      approved: true,
    });
    await repo.setVideoState(videoId, 11, "awaiting_curation");
  } catch (e) {
    fail(video.channel_id, videoId, (e as Error).message);
  }
  done(video.channel_id, videoId);
}

/** Approve the script → generate the SEO package (19) and finish (MVP). */
export async function approveScriptAction(formData: FormData) {
  const videoId = String(formData.get("video_id") ?? "");
  const { orgId, video, brandMemory } = await loadOwned(videoId);
  try {
    const script = await repo.getCurrentAsset(videoId, "script");
    await repo.markApproved(videoId, "script");
    await runState({
      orgId,
      videoId,
      channelId: video.channel_id,
      stateNo: 19,
      brandMemory,
      stateInputs: { approved_script: script?.content, topic: video.topic },
      providerConfig: video.provider_config,
      approved: true,
    });
    await repo.setVideoState(videoId, 19, "completed");
  } catch (e) {
    fail(video.channel_id, videoId, (e as Error).message);
  }
  done(video.channel_id, videoId);
}

/** Revise the current output of a state with free-text feedback (revision memory). */
export async function reviseAction(formData: FormData) {
  const videoId = String(formData.get("video_id") ?? "");
  const stateNo = Number(formData.get("state_no") ?? 0);
  const feedback = String(formData.get("feedback") ?? "").trim();
  const { orgId, video, brandMemory } = await loadOwned(videoId);
  const entry = getStateSchema(stateNo);
  if (!entry) fail(video.channel_id, videoId, `Cannot revise state ${stateNo}`);
  try {
    const prior = await repo.getCurrentAsset(videoId, entry!.assetType);
    await runState({
      orgId,
      videoId,
      channelId: video.channel_id,
      stateNo,
      brandMemory,
      stateInputs: { topic: video.topic },
      providerConfig: video.provider_config,
      revision: { priorOutput: prior?.content, feedback, parentVersionId: prior?.id },
    });
    await repo.setVideoState(videoId, stateNo, "awaiting_curation");
  } catch (e) {
    fail(video.channel_id, videoId, (e as Error).message);
  }
  done(video.channel_id, videoId);
}
