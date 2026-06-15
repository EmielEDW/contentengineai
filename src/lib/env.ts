/**
 * Centralised, validated environment access.
 *
 * Public vars (NEXT_PUBLIC_*) are safe in the browser. Everything else must only
 * ever be imported from server-side code (Server Components, Server Actions,
 * Inngest functions, route handlers). Importing `serverEnv` into a client
 * component will leak secrets — don't.
 */
import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),
  APP_SECRET_ENCRYPTION_KEY: z.string().min(1),
  // Platform provider keys are optional — a tenant may bring their own.
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

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

/**
 * Parse lazily so that importing this module in the browser does not throw on
 * missing server vars. Call `serverEnv()` only from server-side code.
 */
let _serverEnv: z.infer<typeof serverSchema> | null = null;
export function serverEnv(): z.infer<typeof serverSchema> {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() must not be called in the browser.");
  }
  if (!_serverEnv) _serverEnv = serverSchema.parse(process.env);
  return _serverEnv;
}
