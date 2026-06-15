"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

function enc(s: string) {
  return encodeURIComponent(s);
}

export async function signInAction(formData: FormData) {
  if (!isSupabaseConfigured()) redirect("/login?error=Backend+not+configured+yet");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard") || "/dashboard";

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${enc(error.message)}`);
  redirect(next);
}

export async function signUpAction(formData: FormData) {
  if (!isSupabaseConfigured()) redirect("/login?error=Backend+not+configured+yet");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) redirect(`/login?error=${enc(error.message)}`);

  // If email confirmation is enabled, there's no session yet.
  if (!data.session) {
    redirect("/login?message=Check+your+email+to+confirm,+then+sign+in.");
  }
  redirect("/dashboard");
}
