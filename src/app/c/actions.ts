"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";

export async function createChannelAction(formData: FormData) {
  const { supabase, orgId, user } = await requireSession();

  const path = String(formData.get("onboarding_path") ?? "new") === "existing" ? "existing" : "new";
  const name = String(formData.get("name") ?? "").trim() || null;
  const handle = String(formData.get("handle") ?? "").trim() || null;
  const niche = String(formData.get("niche") ?? "").trim() || null;
  const reference = String(formData.get("reference_channel") ?? "").trim() || null;

  const { data, error } = await supabase
    .from("channels")
    .insert({
      org_id: orgId,
      onboarding_path: path,
      name,
      handle,
      niche,
      reference_channel: reference,
      status: "onboarding",
      brand_memory: { schema_version: 1 },
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) redirect(`/c/new?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/dashboard");
  redirect(`/c/${(data as { id: string }).id}`);
}

export async function createVideoAction(formData: FormData) {
  const { supabase, orgId, user } = await requireSession();
  const channelId = String(formData.get("channel_id") ?? "");
  const topic = String(formData.get("topic") ?? "").trim() || null;
  if (!channelId) redirect("/dashboard");

  const { data, error } = await supabase
    .from("videos")
    .insert({
      org_id: orgId,
      channel_id: channelId,
      topic,
      title: topic,
      current_state: 1,
      status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) redirect(`/c/${channelId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/c/${channelId}`);
  redirect(`/c/${channelId}?video=${(data as { id: string }).id}`);
}
