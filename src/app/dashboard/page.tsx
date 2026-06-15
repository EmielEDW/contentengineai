import Link from "next/link";
import { Plus, Pause, ArrowRight, Tv, Database } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Card, Button } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface ChannelRow {
  id: string;
  name: string | null;
  handle: string | null;
  niche: string | null;
  status: string;
}
interface VideoRow {
  id: string;
  title: string | null;
  topic: string | null;
  channel_id: string;
  current_state: number;
  status: string;
}

export default async function Dashboard() {
  if (!isSupabaseConfigured()) {
    return (
      <Shell active="Dashboard">
        <NotConfigured />
      </Shell>
    );
  }

  const { supabase, user } = await requireSession();

  const { data: channels } = await supabase
    .from("channels")
    .select("id, name, handle, niche, status")
    .order("created_at", { ascending: false });
  const { data: videos } = await supabase
    .from("videos")
    .select("id, title, topic, channel_id, current_state, status")
    .order("created_at", { ascending: false });

  const chans = (channels ?? []) as ChannelRow[];
  const vids = (videos ?? []) as VideoRow[];
  const reviewCount = (cid: string) =>
    vids.filter((v) => v.channel_id === cid && v.status === "awaiting_curation").length;
  const videoCount = (cid: string) => vids.filter((v) => v.channel_id === cid).length;
  const inbox = vids.filter((v) => v.status === "awaiting_curation");

  return (
    <Shell active="Dashboard" userEmail={user.email}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted">Your channels and what needs your attention.</p>
        </div>
        <Button href="/c/new">
          <Plus size={16} /> New channel
        </Button>
      </div>

      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Your channels</h2>
      {chans.length === 0 ? (
        <Card className="mb-8 grid place-items-center p-10 text-center">
          <Tv size={28} className="mb-3 text-lock" />
          <p className="text-sm text-muted">No channels yet.</p>
          <div className="mt-4">
            <Button href="/c/new">
              <Plus size={16} /> Create your first channel
            </Button>
          </div>
        </Card>
      ) : (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {chans.map((c) => (
            <Link key={c.id} href={`/c/${c.id}`}>
              <Card className="p-5 transition-colors hover:border-muted">
                <div className="mb-3 flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-black">
                    <Tv size={18} />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{c.name ?? "Untitled channel"}</div>
                    <div className="truncate text-xs text-muted">{c.handle ?? c.status}</div>
                  </div>
                </div>
                <p className="mb-3 line-clamp-2 text-sm text-muted">{c.niche ?? "—"}</p>
                <div className="flex items-center gap-4 text-xs text-muted">
                  <span>{videoCount(c.id)} videos</span>
                  {reviewCount(c.id) > 0 && (
                    <span className="inline-flex items-center gap-1 text-gate">
                      <Pause size={12} /> {reviewCount(c.id)} in review
                    </span>
                  )}
                </div>
              </Card>
            </Link>
          ))}
          <Link href="/c/new">
            <Card className="grid h-full place-items-center p-5 text-muted transition-colors hover:border-muted">
              <div className="text-center">
                <div className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-lg border border-border">
                  <Plus size={18} />
                </div>
                <div className="text-sm">Create channel</div>
              </div>
            </Card>
          </Link>
        </div>
      )}

      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
        Needs your review
      </h2>
      <Card className="divide-y divide-border">
        {inbox.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted">Nothing waiting on you. 🎉</div>
        ) : (
          inbox.map((v) => (
            <Link
              key={v.id}
              href={`/c/${v.channel_id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2"
            >
              <Pause size={16} className="shrink-0 text-gate" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{v.title ?? v.topic ?? "Untitled video"}</div>
                <div className="text-xs text-muted">State {v.current_state}</div>
              </div>
              <ArrowRight size={16} className="shrink-0 text-muted" />
            </Link>
          ))
        )}
      </Card>
    </Shell>
  );
}

function NotConfigured() {
  return (
    <Card className="grid place-items-center p-12 text-center">
      <Database size={28} className="mb-3 text-gate" />
      <h2 className="text-lg font-semibold">Backend not configured yet</h2>
      <p className="mt-2 max-w-md text-sm text-muted">
        Add your Supabase keys (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY) in the Vercel project settings and run the migrations. The UI is
        live; sign-in and data activate once the backend is connected.
      </p>
    </Card>
  );
}
