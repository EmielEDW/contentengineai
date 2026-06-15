import Link from "next/link";
import { Sparkles, ArrowRight, Github, Brain, Workflow, Plug, ShieldCheck, Lock } from "lucide-react";
import { Button, KindBadge } from "@/components/ui";
import { PHASES, statesInPhase } from "@/lib/mock";

export default function Home() {
  return (
    <div className="app-backdrop min-h-screen">
      {/* nav */}
      <header className="mx-auto flex max-w-[1100px] items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2 font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-black">
            <Sparkles size={16} />
          </span>
          ContentEngineAI
        </div>
        <div className="flex items-center gap-2">
          <Button href="https://github.com/EmielEDW/contentengineai" variant="ghost">
            <Github size={16} /> GitHub
          </Button>
          <Button href="/dashboard">
            Open dashboard <ArrowRight size={16} />
          </Button>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto max-w-[1100px] px-5 pb-10 pt-16 text-center">
        <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" /> 22-state pipeline · human-in-the-loop
        </div>
        <h1 className="mx-auto max-w-3xl text-balance text-4xl font-bold leading-tight sm:text-5xl">
          From a channel idea to an upload-ready{" "}
          <span className="text-accent">longform video</span> — mostly on autopilot.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-muted">
          ContentEngineAI learns a channel&apos;s style once, then runs research, scripting, visuals,
          voice, thumbnails and SEO through a 22-step pipeline. You curate at the gates that matter.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button href="/dashboard">
            Open dashboard <ArrowRight size={16} />
          </Button>
          <Button href="/c/dom-economics" variant="outline">
            See a pipeline
          </Button>
        </div>
      </section>

      {/* pipeline preview */}
      <section className="mx-auto max-w-[1100px] px-5 py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PHASES.map((phase) => (
            <div key={phase.name} className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                  {phase.name}
                </h3>
                <span className="text-xs text-muted">
                  {phase.from}–{phase.to}
                </span>
              </div>
              <ul className="space-y-1.5">
                {statesInPhase(phase.from, phase.to).map((s) => (
                  <li key={s.no} className="flex items-center gap-2 text-sm">
                    <span className="w-5 shrink-0 text-right text-xs text-muted">{s.no}</span>
                    <span className="flex-1 truncate">{s.title}</span>
                    {s.visual && <Lock size={11} className="text-lock" />}
                    <KindBadge kind={s.kind} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* features */}
      <section className="mx-auto max-w-[1100px] px-5 py-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Brain, title: "Brand memory", body: "Learns voice, style DNA, audience and visuals once — reused on every new video." },
            { icon: Workflow, title: "22-state pipeline", body: "AUTO steps run unattended; GATE steps pause for your approval and resume later." },
            { icon: Plug, title: "Pluggable providers", body: "Choose your LLM, image, voice and video engine per channel. Bring your own keys." },
            { icon: ShieldCheck, title: "Human gates", body: "You approve hooks, scripts and thumbnails. Publishing always stays human-confirmed." },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="rounded-xl border border-border bg-surface p-5">
                <span className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-accent-soft text-accent">
                  <Icon size={18} />
                </span>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{f.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="mx-auto max-w-[1100px] px-5 py-10 text-center text-sm text-muted">
        <p>
          ContentEngineAI · scaffold + Phase 0 ·{" "}
          <Link className="text-accent hover:underline" href="/dashboard">
            dashboard
          </Link>{" "}
          ·{" "}
          <Link className="text-accent hover:underline" href="https://github.com/EmielEDW/contentengineai">
            source
          </Link>
        </p>
        <p className="mt-1 text-xs">UI preview with mock data — backend (auth, generation) lands in Phase 1+.</p>
      </footer>
    </div>
  );
}
