import { STATES } from "@/lib/pipeline/states";

/**
 * Placeholder landing page. Renders the canonical 22-state pipeline from the
 * single source of truth so you can verify the scaffold compiles and the state
 * config is wired. Replace with the real dashboard (see PLAN §5).
 */
export default function Home() {
  const phases: Record<string, [number, number]> = {
    "Foundation": [1, 8],
    "Script": [9, 11],
    "Visuals": [12, 18],
    "Delivery": [19, 22],
  };

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "48px 24px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>ContentEngineAI</h1>
      <p style={{ color: "var(--muted)", marginTop: 8 }}>
        Multi-tenant pipeline for longform YouTube video production. Scaffold + Phase 0 contracts.
        See <code>ContentEngineAI_PLAN.md</code> for the full build plan.
      </p>

      {Object.entries(phases).map(([phase, [from, to]]) => (
        <section key={phase} style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)" }}>
            {phase}
          </h2>
          <ul style={{ marginTop: 8, display: "grid", gap: 6 }}>
            {STATES.filter((s) => s.no >= from && s.no <= to).map((s) => (
              <li
                key={s.no}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
              >
                <span style={{ width: 26, color: "var(--muted)" }}>{s.no}</span>
                <span style={{ flex: 1 }}>{s.title}</span>
                <Badge kind={s.kind} />
                {s.optional && <Tag label="optional" />}
                {s.visual && <Tag label="visual-gated" />}
                {s.needsUpload && <Tag label="upload" />}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}

function Badge({ kind }: { kind: "auto" | "gate" }) {
  const isGate = kind === "gate";
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 999,
        background: isGate ? "rgba(234,179,8,0.15)" : "rgba(22,163,74,0.15)",
        color: isGate ? "#eab308" : "var(--accent)",
      }}
    >
      {kind.toUpperCase()}
    </span>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span style={{ fontSize: 11, color: "var(--muted)", border: "1px solid var(--border)", padding: "1px 6px", borderRadius: 6 }}>
      {label}
    </span>
  );
}
