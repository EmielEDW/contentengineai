import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabasePublicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Server-side Supabase client bound to the user's session cookies. RLS applies,
 * so every query is automatically scoped to the orgs the user belongs to.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();
  const env = requireSupabasePublicEnv();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component where cookies are read-only — ignore.
          }
        },
      },
    }
  );
}
