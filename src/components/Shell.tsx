import Link from "next/link";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  Tv,
  Library,
  Calendar,
  Settings,
  Sparkles,
  Bell,
  ChevronDown,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/c/dom-economics", label: "Channels", icon: Tv },
  { href: "/dashboard", label: "Library", icon: Library },
  { href: "/dashboard", label: "Calendar", icon: Calendar },
  { href: "/dashboard", label: "Settings", icon: Settings },
];

export function Shell({ children, active }: { children: ReactNode; active?: string }) {
  return (
    <div className="min-h-screen app-backdrop">
      {/* top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-bg/80 px-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-black">
              <Sparkles size={16} />
            </span>
            ContentEngineAI
          </Link>
          <button className="ml-2 flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm text-muted hover:text-fg">
            Dom Economics <ChevronDown size={14} />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button className="relative grid h-8 w-8 place-items-center rounded-lg hover:bg-surface-2">
            <Bell size={16} />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
          </button>
          <div className="grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-xs font-semibold">
            E
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1200px] gap-6 px-4 py-6">
        {/* sidebar */}
        <aside className="hidden w-48 shrink-0 md:block">
          <nav className="sticky top-20 space-y-1">
            {NAV.map((item, i) => {
              const Icon = item.icon;
              const isActive = item.label === active;
              return (
                <Link
                  key={i}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg"
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
