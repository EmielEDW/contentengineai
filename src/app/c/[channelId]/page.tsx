import { notFound } from "next/navigation";
import { Check, Circle, Lock, ChevronRight, Pencil, RotateCcw, Sparkles } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Card, KindBadge } from "@/components/ui";
import { STATES, isBlockedByVisualGate } from "@/lib/pipeline/states";
import { PHASES, MOCK_HOOKS, MOCK_VIDEOS, channelById } from "@/lib/mock";

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;
  const channel = channelById(channelId);
  if (!channel) notFound();

  const video = MOCK_VIDEOS[channelId]?.[0];
  const current = video?.currentState ?? 9;
  const scriptApproved = current > 11;

  return (
    <Shell active="Channels">
      <div className="mb-5">
        <div className="text-xs text-muted">{channel.name}</div>
        <h1 className="truncate text-xl font-semibold">{video?.title ?? "New video"}</h1>
        <p className="text-sm text-muted">
          State {current} of 22 · {STATES[current - 1]?.title}
        </p>
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
                    const done = s.no < current;
                    const active = s.no === current;
                    const locked = isBlockedByVisualGate(s.no, scriptApproved);
                    return (
                      <li
                        key={s.no}
                        className={`flex items-center gap-2 rounded-md px-1.5 py-1 text-xs ${
                          active ? "bg-surface-2" : ""
                        }`}
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
                        <span
                          className={`flex-1 truncate ${
                            done ? "text-muted" : active ? "text-fg" : "text-muted"
                          }`}
                        >
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

        {/* active state — Hook Engineering curation */}
        <div>
          <Card className="p-5">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-semibold">State 9 · Hook Engineering</h2>
              <KindBadge kind="gate" />
            </div>
            <p className="mb-4 text-sm text-muted">
              Pick the hook that fits the channel best. Each is one archetype, sized to your WPS.
            </p>

            <div className="space-y-2.5">
              {MOCK_HOOKS.map((h) => (
                <div
                  key={h.rank}
                  className="rounded-lg border border-border bg-surface-2/40 p-3 transition-colors hover:border-muted"
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold">
                      {h.rank}
                    </span>
                    <span className="text-xs font-medium text-muted">{h.archetype}</span>
                    <span className="ml-auto text-xs text-muted">
                      {h.words}w · {h.seconds}s
                    </span>
                    <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent">
                      {h.score.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed">{h.text}</p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <button className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-black hover:bg-accent/90">
                      <Check size={13} /> Approve
                    </button>
                    <button className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted hover:text-fg">
                      <RotateCcw size={13} /> Revise
                    </button>
                    <button className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted hover:text-fg">
                      <Pencil size={13} /> Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-border pt-3">
              <label className="text-xs text-muted">Revision feedback (feeds revision-memory)</label>
              <div className="mt-1.5 flex gap-2">
                <input
                  disabled
                  placeholder="e.g. make hook #2 punchier, drop the jargon…"
                  className="flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm text-muted placeholder:text-lock"
                />
                <button className="rounded-md border border-border px-3 py-2 text-sm text-muted">
                  Revise selected
                </button>
              </div>
            </div>
          </Card>
          <p className="mt-2 px-1 text-xs text-muted">
            Preview with mock data — wired to the live pipeline in Phase 2.
          </p>
        </div>

        {/* brand memory panel */}
        <Card className="h-fit p-4">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles size={15} className="text-accent" />
            <h3 className="text-sm font-semibold">Brand memory</h3>
          </div>
          <dl className="space-y-3 text-xs">
            {[
              ["Niche", channel.niche],
              ["WPS", "2.85 · target 1,800–2,000 words"],
              ["Opening", "Absolute contrarian claim, no warm-up"],
              ["Signature", "“Surely X, right? Wrong.”"],
              ["Enemy", "Institutions quietly rewriting the rules"],
              ["Visual", "Hand-drawn whiteboard doodle, marker outlines"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-lock">{k}</dt>
                <dd className="mt-0.5 text-fg">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </Shell>
  );
}
