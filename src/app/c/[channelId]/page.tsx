import { notFound } from "next/navigation";
import { Check, Circle, Lock, ChevronRight, Sparkles, Plus, Film } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Card, KindBadge } from "@/components/ui";
import { STATES, isBlockedByVisualGate } from "@/lib/pipeline/states";
import { PHASES } from "@/lib/mock";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { requireSession } from "@/lib/auth";
import { createVideoAction } from "../actions";

export const dynamic = "force-dynamic";

interface VideoRow {
  id: string;
  title: string | null;
  topic: string | null;
  current_state: number;
  status: string;
}

export default async function ChannelPage({
  params,
  searchParams,
}: {
  params: Promise<{ channelId: string }>;
  searchParams: Promise<{ video?: string }>;
}) {
  const { channelId } = await params;
  const { video: selectedId } = await searchParams;

  if (!isSupabaseConfigured()) {
    return (
      <Shell active="Channels">
        <Card className="p-8 text-sm text-muted">Connect Supabase to view channels.</Card>
      </Shell>
    );
  }

  const { supabase, user } = await requireSession();
  const { data: channel } = await supabase
    .from("channels")
    .select("id, name, handle, niche, brand_memory, onboarding_path, status")
    .eq("id", channelId)
    .maybeSingle();
  if (!channel) notFound();

  const { data: videosData } = await supabase
    .from("videos")
    .select("id, title, topic, current_state, status")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false });
  const videos = (videosData ?? []) as VideoRow[];
  const selected = videos.find((v) => v.id === selectedId) ?? videos[0] ?? null;
  const current = selected?.current_state ?? 1;
  const scriptApproved = current > 11;
  const bm = (channel.brand_memory ?? {}) as Record<string, unknown>;

  return (
    <Shell active="Channels" userEmail={user.email}>
      <div className="mb-5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted">
            {channel.name ?? "Channel"} · {channel.handle ?? channel.status}
          </div>
          <h1 className="truncate text-xl font-semibold">
            {selected ? selected.title ?? selected.topic ?? "Untitled video" : "No video yet"}
          </h1>
          {selected && (
            <p className="text-sm text-muted">
              State {current} of 22 · {STATES[current - 1]?.title}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[230px_1fr_240px]">
        {/* state tracker */}
        <Card className="h-fit p-3">
          <div className="space-y-4">
            {PHASES.map((phase) => (
              <div key={phase.name}>
                <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                  {phase.name}
                </div>
                <ul className="space-y-0.5">
                  {STATES.filter((s) => s.no >= phase.from && s.no <= phase.to).map((s) => {
                    const done = !!selected && s.no < current;
                    const active = !!selected && s.no === current;
                    const locked = isBlockedByVisualGate(s.no, scriptApproved);
                    return (
                      <li
                        key={s.no}
                        className={`flex items-center gap-2 rounded-md px-1.5 py-1 text-xs ${active ? "bg-surface-2" : ""}`}
                      >
                        {done ? (
                          <Check size={13} className="shrink-0 text-accent" />
                        ) : active ? (
                          <ChevronRight size={13} className="shrink-0 text-fg" />
                        ) : locked ? (
                          <Lock size={12} className="shrink-0 text-lock" />
                        ) : (
                          <Circle size={11} className="shrink-0 text-lock" />
                        )}
                        <span className="flex-1 truncate text-muted">
                          {s.no}. {s.title}
                        </span>
                        <KindBadge kind={s.kind} />
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </Card>

        {/* center: videos + create */}
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="mb-1 font-semibold">Start a new video</h2>
            <p className="mb-4 text-sm text-muted">
              Give a topic (or leave blank to generate ideas). This creates the project; the AI
              pipeline runs once generation is wired (Phase 2).
            </p>
            <form className="flex gap-2">
              <input type="hidden" name="channel_id" value={channelId} />
              <input
                name="topic"
                placeholder="e.g. Why retail investors are the exit liquidity"
                className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-muted"
              />
              <button
                formAction={createVideoAction}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black hover:bg-accent/90"
              >
                <Plus size={16} /> Create
              </button>
            </form>
          </Card>

          <Card className="divide-y divide-border">
            <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
              Videos
            </div>
            {videos.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted">
                <Film size={24} className="mx-auto mb-2 text-lock" />
                No videos yet — create your first above.
              </div>
            ) : (
              videos.map((v) => (
                <a
                  key={v.id}
                  href={`/c/${channelId}?video=${v.id}`}
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-surface-2 ${
                    selected?.id === v.id ? "bg-surface-2" : ""
                  }`}
                >
                  <Film size={15} className="shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{v.title ?? v.topic ?? "Untitled video"}</div>
                    <div className="text-xs text-muted">
                      State {v.current_state} · {v.status}
                    </div>
                  </div>
                </a>
              ))
            )}
          </Card>
        </div>

        {/* brand memory */}
        <Card className="h-fit p-4">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles size={15} className="text-accent" />
            <h3 className="text-sm font-semibold">Brand memory</h3>
          </div>
          {Object.keys(bm).length <= 1 ? (
            <p className="text-xs text-muted">
              Not built yet. Onboarding (states 4–8, 13, 17) fills this from reference material — wired
              in Phase 2.
            </p>
          ) : (
            <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[11px] text-muted">
              {JSON.stringify(bm, null, 2).slice(0, 800)}
            </pre>
          )}
          <div className="mt-3 border-t border-border pt-3 text-xs text-muted">
            <div className="text-lock">Niche</div>
            <div className="mt-0.5 text-fg">{channel.niche ?? "—"}</div>
          </div>
        </Card>
      </div>
    </Shell>
  );
}
