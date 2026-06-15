import Link from "next/link";
import type { ReactNode } from "react";

export function KindBadge({ kind }: { kind: "auto" | "gate" }) {
  const gate = kind === "gate";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
        gate ? "bg-gate-soft text-gate" : "bg-accent-soft text-accent"
      }`}
    >
      {kind.toUpperCase()}
    </span>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted">
      {children}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-surface ${className}`}>{children}</div>
  );
}

export function Button({
  children,
  href,
  variant = "primary",
  className = "",
}: {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "ghost" | "outline";
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors";
  const styles = {
    primary: "bg-accent text-black hover:bg-accent/90",
    ghost: "text-muted hover:text-fg hover:bg-surface-2",
    outline: "border border-border text-fg hover:bg-surface-2",
  }[variant];
  const cls = `${base} ${styles} ${className}`;
  if (href) {
    const external = href.startsWith("http");
    return (
      <Link href={href} className={cls} target={external ? "_blank" : undefined}>
        {children}
      </Link>
    );
  }
  return <button className={cls}>{children}</button>;
}
