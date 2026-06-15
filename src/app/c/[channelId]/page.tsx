import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Check, Circle, Lock, ChevronRight, Sparkles, Plus, Film, Wand2, RotateCcw, AlertTriangle } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Card, KindBadge } from "@/components/ui";
import { STATES, isBlockedByVisualGate } from "@/lib/pipeline/states";
import { PHASES } from "@/lib/mock";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { requireSession } from "@/lib/auth";
import { createVideoAction } from "../actions";
import {
  startGenerationAction,
  approveHookAction,
  approveScriptAction,
  reviseAction,
} from "../pipeline-actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // synchronous generation (script) can take a while

interface VideoRow {
  id: string;
  title: string | null;
  topic: string | null;
  current_state: number;
  status: string;
}
interface AssetRow {
  id: string;
  type: string;
  content: unknown;
}

export default async function ChannelPage({
  params,
  searchParams,
}: {
  params: Promise<{ channelId: string }>;
  searchParams: Promise<{ video?: string; error?: string }>;
}) {
  const { channelId } = await params;
  const sp = await searchParams;

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
    .select("id, name, handle, niche, brand_memory, status")
    .eq("id", channelId)
    .maybeSingle();
  if (!channel) notFound();

  const { data: videosData } = await supabase
    .from("videos")
    .select("id, title, topic, current_state, status")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false });
  const videos = (videosData ?? []) as VideoRow[];
  const selected = videos.find((v) => v.id === sp.video) ?? videos[0] ?? null;
  const current = selected?.current_state ?? 1;
  const scriptApproved = current > 11;

  // current assets for the selected video
  const byType: Record<string, AssetRow> = {};
  if (selected) {
    const { data: assetRows } = await supabase
      .from("assets")
      .select("id, type, content")
      .eq("video_id", selected.id)
      .eq("is_current", true);
    for (const a of (assetRows ?? []) as AssetRow[]) byType[a.type] = a;
  }

  return (
    <Shell active="Channels" userEmail={user.email}>
      <div className="mb-5">
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

      {sp.error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>Generation failed: {sp.error}</span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[230px_1fr_240px]">
        <Tracker current={current} hasVideo={!!selected} scriptApproved={scriptApproved} />

        <div className="space-y-5">
          {selected ? (
            <Curation video={selected} assets={byType} />
          ) : (
            <Card className="p-6 text-center text-sm text-muted">
              <Film size={24} className="mx-auto mb-2 text-lock" />
              No video yet — create your first below.
            </Card>
          )}

          <NewVideo channelId={channelId} />
          <VideoList channelId={channelId} videos={videos} selectedId={selected?.id} />
        </div>

        <BrandMemoryPanel niche={channel.niche} brandMemory={channel.brand_memory as Record<string, unknown>} />
      </div>
    </Shell>
  );
}

/* ─────────────────────────── curation ─────────────────────────── */

function Curation({ video, assets }: { video: VideoRow; assets: Record<string, AssetRow> }) {
  if (assets.seo) return <SeoView video={video} asset={assets.seo} />;
  if (assets.script) return <ScriptView video={video} script={assets.script} audit={assets.script_audit} />;
  if (assets.hook) return <HooksView video={video} asset={assets.hook} />;
  return (
    <Card className="p-6">
      <h2 className="font-semibold">Generate this video</h2>
      <p className="mt-1 text-sm text-muted">
        Topic: <span className="text-fg">{video.topic ?? "(none — add one when creating)"}</span>
      </p>
      <p className="mt-2 text-sm text-muted">
        The AI will write 5 hooks, then a full script + quality audit, then the SEO package. You curate
        at each gate.
      </p>
      <form className="mt-4">
        <input type="hidden" name="video_id" value={video.id} />
        <button
          formAction={startGenerationAction}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black hover:bg-accent/90"
        >
          <Wand2 size={16} /> Generate hooks
        </button>
      </form>
    </Card>
  );
}

function HooksView({ video, asset }: { video: VideoRow; asset: AssetRow }) {
  const options = ((asset.content as { options?: HookOpt[] }).options ?? []) as HookOpt[];
  return (
    <Card className="p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-semibold">State 9 · Hook Engineering</h2>
        <KindBadge kind="gate" />
      </div>
      <p className="mb-4 text-sm text-muted">Pick the hook to build the script around.</p>
      <div className="space-y-2.5">
        {options.map((h, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface-2/40 p-3">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold">
                {h.rank ?? i + 1}
              </span>
              <span className="text-xs font-medium text-muted">{h.archetype}</span>
              <span className="ml-auto text-xs text-muted">
                {h.word_count}w · {Math.round(h.estimated_duration_sec ?? 0)}s
              </span>
            </div>
            <p className="text-sm leading-relaxed">{h.text}</p>
            <form className="mt-2.5">
              <input type="hidden" name="video_id" value={video.id} />
              <input type="hidden" name="hook_index" value={i} />
              <button
                formAction={approveHookAction}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-black hover:bg-accent/90"
              >
                <Check size={13} /> Use this hook → write script
              </button>
            </form>
          </div>
        ))}
      </div>
      <ReviseBox videoId={video.id} stateNo={9} placeholder="e.g. make them punchier, drop the jargon…" />
    </Card>
  );
}

function ScriptView({ video, script, audit }: { video: VideoRow; script: AssetRow; audit?: AssetRow }) {
  const s = script.content as ScriptT;
  const a = audit?.content as AuditT | undefined;
  const accuracy =
    s.target_word_count > 0 ? Math.round((s.actual_word_count / s.target_word_count) * 100) : 0;
  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-semibold">State 10 · Script</h2>
          <KindBadge kind="gate" />
        </div>
        <p className="mb-3 text-xs text-muted">
          {s.actual_word_count} / {s.target_word_count} words ({accuracy}%) · WPS {s.wps} · ~
          {Math.round((s.estimated_duration_sec ?? 0) / 60)}m
        </p>
        <div className="max-h-80 space-y-3 overflow-y-auto rounded-lg border border-border bg-bg p-3 text-sm leading-relaxed">
          {(s.beats ?? []).map((b, i) => (
            <p key={i}>
              <span className="mr-2 text-[10px] uppercase text-lock">{b.section}</span>
              {b.text}
            </p>
          ))}
        </div>
        <form className="mt-4">
          <input type="hidden" name="video_id" value={video.id} />
          <button
            formAction={approveScriptAction}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-black hover:bg-accent/90"
          >
            <Check size={14} /> Approve script → SEO
          </button>
        </form>
        <ReviseBox videoId={video.id} stateNo={10} placeholder="e.g. tighten the intro, add a stat in the body…" />
      </Card>

      {a && (
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">State 11 · Quality Audit · overall {a.overall_score}/10</h3>
          <div className="space-y-1.5">
            {(a.criteria ?? []).map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-40 text-muted">{c.name.replace(/_/g, " ")}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded bg-surface-2">
                  <div
                    className={`h-full ${c.score < 7 ? "bg-gate" : "bg-accent"}`}
                    style={{ width: `${c.score * 10}%` }}
                  />
                </div>
                <span className={c.score < 7 ? "text-gate" : "text-muted"}>{c.score}</span>
              </div>
            ))}
          </div>
          {a.claims_to_verify?.length ? (
            <div className="mt-3 rounded-lg border border-gate/40 bg-gate-soft p-2.5 text-xs text-gate">
              <div className="mb-1 font-semibold">Claims to verify before publishing</div>
              <ul className="list-disc space-y-0.5 pl-4">
                {a.claims_to_verify.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      )}
    </div>
  );
}

function SeoView({ video, asset }: { video: VideoRow; asset: AssetRow }) {
  const s = asset.content as SeoT;
  return (
    <Card className="p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-semibold">State 19 · SEO &amp; Metadata</h2>
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">DONE</span>
      </div>
      <p className="mb-4 text-sm text-muted">Your package is ready. (Visuals, voice &amp; export: next phases.)</p>

      <Section title="Titles">
        <ul className="space-y-1 text-sm">
          {(s.titles ?? []).map((t, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-lock">{t.rank}.</span>
              {t.text}
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Description">
        <p className="whitespace-pre-wrap text-sm text-muted">{s.description}</p>
      </Section>
      <Section title={`Tags (${(s.tags ?? []).length})`}>
        <div className="flex flex-wrap gap-1.5">
          {(s.tags ?? []).map((t, i) => (
            <span key={i} className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted">
              {t}
            </span>
          ))}
        </div>
      </Section>
      <p className="mt-3 text-xs text-muted">
        Recommended upload: {s.recommended_upload_time} · Category: {s.category}
      </p>
      <ReviseBox videoId={video.id} stateNo={19} placeholder="e.g. more curiosity in the titles…" />
    </Card>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">{title}</div>
      {children}
    </div>
  );
}

function ReviseBox({ videoId, stateNo, placeholder }: { videoId: string; stateNo: number; placeholder: string }) {
  return (
    <form className="mt-4 border-t border-border pt-3">
      <label className="text-xs text-muted">Revise with feedback (edits, doesn&apos;t regenerate)</label>
      <input type="hidden" name="video_id" value={videoId} />
      <input type="hidden" name="state_no" value={stateNo} />
      <div className="mt-1.5 flex gap-2">
        <input
          name="feedback"
          required
          placeholder={placeholder}
          className="flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-muted"
        />
        <button
          formAction={reviseAction}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted hover:text-fg"
        >
          <RotateCcw size={14} /> Revise
        </button>
      </div>
    </form>
  );
}

/* ─────────────────────────── side panels ─────────────────────────── */

function Tracker({ current, hasVideo, scriptApproved }: { current: number; hasVideo: boolean; scriptApproved: boolean }) {
  return (
    <Card className="h-fit p-3">
      <div className="space-y-4">
        {PHASES.map((phase) => (
          <div key={phase.name}>
            <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
              {phase.name}
            </div>
            <ul className="space-y-0.5">
              {STATES.filter((s) => s.no >= phase.from && s.no <= phase.to).map((s) => {
                const done = hasVideo && s.no < current;
                const active = hasVideo && s.no === current;
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
  );
}

function NewVideo({ channelId }: { channelId: string }) {
  return (
    <Card className="p-5">
      <h2 className="mb-1 font-semibold">Start a new video</h2>
      <p className="mb-4 text-sm text-muted">Give a topic; we create the project and you generate from there.</p>
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
  );
}

function VideoList({ channelId, videos, selectedId }: { channelId: string; videos: VideoRow[]; selectedId?: string }) {
  if (videos.length === 0) return null;
  return (
    <Card className="divide-y divide-border">
      <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">Videos</div>
      {videos.map((v) => (
        <a
          key={v.id}
          href={`/c/${channelId}?video=${v.id}`}
          className={`flex items-center gap-3 px-4 py-3 hover:bg-surface-2 ${selectedId === v.id ? "bg-surface-2" : ""}`}
        >
          <Film size={15} className="shrink-0 text-muted" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm">{v.title ?? v.topic ?? "Untitled video"}</div>
            <div className="text-xs text-muted">
              State {v.current_state} · {v.status}
            </div>
          </div>
        </a>
      ))}
    </Card>
  );
}

function BrandMemoryPanel({ niche, brandMemory }: { niche: string | null; brandMemory: Record<string, unknown> }) {
  return (
    <Card className="h-fit p-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles size={15} className="text-accent" />
        <h3 className="text-sm font-semibold">Brand memory</h3>
      </div>
      {Object.keys(brandMemory).length <= 1 ? (
        <p className="text-xs text-muted">
          Not built yet. Onboarding (states 4–8, 13, 17) fills this from reference material — next phase.
        </p>
      ) : (
        <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[11px] text-muted">
          {JSON.stringify(brandMemory, null, 2).slice(0, 800)}
        </pre>
      )}
      <div className="mt-3 border-t border-border pt-3 text-xs">
        <div className="text-lock">Niche</div>
        <div className="mt-0.5 text-fg">{niche ?? "—"}</div>
      </div>
    </Card>
  );
}

/* types of stored asset content */
interface HookOpt {
  rank?: number;
  archetype: string;
  text: string;
  word_count: number;
  estimated_duration_sec?: number;
}
interface ScriptT {
  target_word_count: number;
  actual_word_count: number;
  wps: number;
  estimated_duration_sec?: number;
  beats?: { section: string; text: string }[];
}
interface AuditT {
  overall_score: number;
  criteria?: { name: string; score: number; comment: string }[];
  claims_to_verify?: string[];
}
interface SeoT {
  titles?: { rank: number; text: string }[];
  description: string;
  tags?: string[];
  recommended_upload_time: string;
  category: string;
}
