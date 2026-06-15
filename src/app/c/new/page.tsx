import Link from "next/link";
import { Sparkles, TrendingUp } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Card } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { createChannelAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewChannelPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  if (!isSupabaseConfigured()) {
    return (
      <Shell active="Channels">
        <Card className="p-8 text-sm text-muted">Connect Supabase to create channels.</Card>
      </Shell>
    );
  }
  const { user } = await requireSession();

  return (
    <Shell active="Channels" userEmail={user.email}>
      <div className="mx-auto max-w-xl">
        <h1 className="text-xl font-semibold">Add a channel</h1>
        <p className="mt-1 text-sm text-muted">
          Start fresh (we help name &amp; brand it) or connect an existing channel. Either way we build
          its brand memory from reference material.
        </p>

        {sp.error && (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {sp.error}
          </div>
        )}

        <form className="mt-6 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <label className="cursor-pointer rounded-xl border border-border bg-surface p-4 transition-colors has-[:checked]:border-accent">
              <input type="radio" name="onboarding_path" value="new" defaultChecked className="peer sr-only" />
              <Sparkles size={18} className="mb-2 text-accent" />
              <div className="text-sm font-medium">New channel</div>
              <div className="text-xs text-muted">Name + brand it from a reference.</div>
            </label>
            <label className="cursor-pointer rounded-xl border border-border bg-surface p-4 transition-colors has-[:checked]:border-accent">
              <input type="radio" name="onboarding_path" value="existing" className="peer sr-only" />
              <TrendingUp size={18} className="mb-2 text-accent" />
              <div className="text-sm font-medium">Existing channel</div>
              <div className="text-xs text-muted">Skip naming; learn my style.</div>
            </label>
          </div>

          <Field label="Channel name" name="name" placeholder="Dom Economics" />
          <Field label="@handle" name="handle" placeholder="@domeconomics" />
          <Field
            label="Reference channel URL"
            name="reference_channel"
            placeholder="https://youtube.com/@CasuallyFinance"
          />
          <Field label="Niche" name="niche" placeholder="Personal finance for the smart layperson" />

          <div className="flex items-center gap-3">
            <button
              formAction={createChannelAction}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black hover:bg-accent/90"
            >
              Create channel
            </button>
            <Link href="/dashboard" className="text-sm text-muted hover:text-fg">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </Shell>
  );
}

function Field({ label, name, placeholder }: { label: string; name: string; placeholder: string }) {
  return (
    <div>
      <label className="text-xs text-muted">{label}</label>
      <input
        name={name}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-muted"
      />
    </div>
  );
}
