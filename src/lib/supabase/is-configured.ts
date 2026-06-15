/**
 * Whether Supabase env is present. Used to degrade gracefully: before the backend
 * is configured (e.g. a fresh Vercel deploy), the site still renders the UI and a
 * "backend not configured" notice instead of crashing.
 */
export function isSupabaseConfigured(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
