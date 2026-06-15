import Link from "next/link";
import { Sparkles } from "lucide-react";
import { signInAction, signUpAction } from "./actions";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const configured = isSupabaseConfigured();

  return (
    <div className="app-backdrop grid min-h-screen place-items-center px-5">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-black">
            <Sparkles size={16} />
          </span>
          ContentEngineAI
        </Link>

        <div className="rounded-xl border border-border bg-surface p-6">
          <h1 className="text-lg font-semibold">Sign in</h1>
          <p className="mt-1 text-sm text-muted">Use your email and password, or create an account.</p>

          {!configured && (
            <div className="mt-4 rounded-lg border border-gate/40 bg-gate-soft px-3 py-2 text-xs text-gate">
              Backend not configured yet — sign-in activates once Supabase keys are set.
            </div>
          )}
          {sp.error && (
            <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {sp.error}
            </div>
          )}
          {sp.message && (
            <div className="mt-4 rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 text-xs text-accent">
              {sp.message}
            </div>
          )}

          <form className="mt-5 space-y-3">
            <input type="hidden" name="next" value={sp.next ?? "/dashboard"} />
            <div>
              <label className="text-xs text-muted">Email</label>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-muted"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="text-xs text-muted">Password</label>
              <input
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="current-password"
                className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-muted"
                placeholder="••••••••"
              />
            </div>
            <button
              formAction={signInAction}
              className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black hover:bg-accent/90"
            >
              Sign in
            </button>
            <button
              formAction={signUpAction}
              className="w-full rounded-lg border border-border px-4 py-2 text-sm text-fg hover:bg-surface-2"
            >
              Create account
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-muted">
          <Link href="/" className="hover:text-fg">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
