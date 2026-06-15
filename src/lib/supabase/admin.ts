import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Service-role Supabase client. BYPASSES RLS — use ONLY in trusted server contexts
 * (Inngest jobs, webhooks). Every query here MUST still filter by org_id explicitly
 * (defense-in-depth). Never import this into client code.
 */
export function createAdminSupabase() {
  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv().SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
