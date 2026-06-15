import Link from "next/link";
import { Plus, Pause, ArrowRight, Tv } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Card, Button } from "@/components/ui";
import { MOCK_CHANNELS, MOCK_INBOX, MOCK_ACTIVITY } from "@/lib/mock";

export default function Dashboard() {
  return (
    <Shell active="Dashboard">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted">Your channels and what needs your attention.</p>
        </div>
        <Button>
          <Plus size={16} /> New channel
        </Button>
      </div>

      {/* channels */}
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Your channels</h2>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MOCK_CHANNELS.map((c) => (
          <Link key={c.id} href={`/c/${c.id}`}>
            <Card className="p-5 transition-colors hover:border-muted">
              <div className="mb-3 flex items-center gap-3">
                <span
                  className="grid h-9 w-9 place-items-center rounded-lg text-black"
                  style={{ background: c.accent }}
                >
                  <Tv size={18} />
                </span>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{c.name}</div>
                  <div className="truncate text-xs text-muted">{c.handle}</div>
                </div>
              </div>
              <p className="mb-3 line-clamp-2 text-sm text-muted">{c.niche}</p>
              <div className="flex items-center gap-4 text-xs text-muted">
                <span>{c.videos} videos</span>
                {c.inReview > 0 && (
                  <span className="inline-flex items-center gap-1 text-gate">
                    <Pause size={12} /> {c.inReview} in review
                  </span>
                )}
              </div>
            </Card>
          </Link>
        ))}
        <Card className="grid place-items-center p-5 text-muted transition-colors hover:border-muted">
          <div className="text-center">
            <div className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-lg border border-border">
              <Plus size={18} />
            </div>
            <div className="text-sm">Create channel</div>
          </div>
        </Card>
      </div>

      {/* inbox */}
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
        Needs your review
      </h2>
      <Card className="mb-8 divide-y divide-border">
        {MOCK_INBOX.map((item, i) => (
          <Link
            key={i}
            href={`/c/${item.channelId}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2"
          >
            <Pause size={16} className="shrink-0 text-gate" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{item.video}</div>
              <div className="text-xs text-muted">
                {item.channel} · State {item.stateNo} {item.state}
              </div>
            </div>
            <span className="hidden text-xs text-muted sm:block">waiting {item.waiting}</span>
            <ArrowRight size={16} className="shrink-0 text-muted" />
          </Link>
        ))}
      </Card>

      {/* activity */}
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Recent activity</h2>
      <Card className="p-4">
        <ul className="space-y-2 text-sm text-muted">
          {MOCK_ACTIVITY.map((a, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              {a}
            </li>
          ))}
        </ul>
      </Card>
    </Shell>
  );
}
