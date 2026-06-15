import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

/** The current authenticated user + their active org, or null if not signed in. */
export async function getSession() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  return {
    supabase,
    user,
    orgId: (membership?.org_id as string | undefined) ?? null,
    role: (membership?.role as string | undefined) ?? null,
  };
}

/** Require a signed-in user with an org, or redirect to /login. */
export async function requireSession() {
  const session = await getSession();
  if (!session || !session.orgId) redirect("/login");
  // narrow orgId to string for callers (redirect() returns never above)
  return { supabase: session.supabase, user: session.user, orgId: session.orgId, role: session.role };
}
