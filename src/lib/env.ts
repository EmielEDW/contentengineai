/**
 * Centralised, validated environment access.
 *
 * IMPORTANT: nothing here throws at module-load time, so the app builds and
 * deploys (e.g. on Vercel) even before Supabase / provider keys are configured.
 * Validation happens lazily at the point of use:
 *   - requireSupabasePublicEnv()  — when a Supabase client is created
 *   - serverEnv()                 — when server-only code runs (Inngest jobs)
 *
 * Public vars (NEXT_PUBLIC_*) are safe in the browser and inlined at build time.
 * Everything in serverEnv() is server-only — never import it into client code.
 */
import { z } from "zod";

function read(name: string): string {
  return process.env[name] ?? "";
}

/** Raw public env (may be empty before configuration). */
export const publicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: read("NEXT_PUBLIC_SUPABASE_URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: read("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
};

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

/** Validate the public Supabase env; throws a clear error if missing/invalid. */
export function requireSupabasePublicEnv() {
  const parsed = publicSchema.safeParse(publicEnv);
  if (!parsed.success) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  return parsed.data;
}

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),
  APP_SECRET_ENCRYPTION_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  FAL_KEY: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),
  YOUTUBE_OAUTH_CLIENT_ID: z.string().optional(),
  YOUTUBE_OAUTH_CLIENT_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  FEATURE_YOUTUBE_UPLOAD: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

/** Lazily parse + cache server-only env. Call only from server-side code. */
let _serverEnv: z.infer<typeof serverSchema> | null = null;
export function serverEnv(): z.infer<typeof serverSchema> {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() must not be called in the browser.");
  }
  if (!_serverEnv) _serverEnv = serverSchema.parse(process.env);
  return _serverEnv;
}
