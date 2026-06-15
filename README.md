# ContentEngineAI

Multi-tenant web app that produces **longform YouTube videos** end-to-end via a 22-state AI
pipeline. Build plan: [`ContentEngineAI_PLAN.md`](./ContentEngineAI_PLAN.md). Engine spec:
[`ContentEngineAI_Build_Spec_and_Context.md`](./ContentEngineAI_Build_Spec_and_Context.md).

Stack: **Next.js 15 (App Router) · TypeScript · Supabase (Postgres + Auth + Storage + Vault) ·
Inngest (durable FSM) · Tailwind + shadcn/ui**. Pluggable provider layer per modality
(LLM / image / voice / video) with BYO-keys.

---

## ⚠️ Google Drive note

This project currently lives inside a Google Drive folder. **`node_modules` and `.next` will
churn Drive sync badly.** They are git-ignored, but for a smooth dev experience either:
- work from a local clone outside Drive (`git clone` this folder elsewhere), or
- mark `node_modules`/`.next` as "available offline only" / exclude them from sync.

`npm install` was **not** run for you (to avoid writing ~tens of thousands of files into Drive).

---

## Setup

```bash
# 1. Install deps (see Drive note above)
npm install

# 2. Environment
cp .env.example .env.local      # then fill in Supabase + provider keys

# 3. Database (Supabase CLI)
supabase init                   # creates supabase/config.toml (kept out of git)
supabase start                  # local Postgres + Auth + Storage
supabase db reset               # applies supabase/migrations/0001_init.sql + 0002_seed.sql
npm run db:types                # regenerate src/lib/supabase/database.types.ts from the DB

# 4. Run (two terminals)
npm run dev                     # Next.js on :3000
npm run inngest:dev             # Inngest dev server (discovers /api/inngest)
```

Open http://localhost:3000 — the landing page renders the canonical 22-state pipeline from
`src/lib/pipeline/states.ts` (sanity check that the scaffold compiles and the state config is wired).

---

## What's implemented (Phase 0 + skeleton)

| Area | Files |
|------|-------|
| **Canonical schema** (org-tenancy, RLS, versioned assets) | `supabase/migrations/0001_init.sql` |
| **Seed** (22 states + providers) | `supabase/migrations/0002_seed.sql` |
| **BrandMemory** type (Zod) | `src/lib/brand-memory.ts` |
| **22-state config** + advance/visual-gate logic | `src/lib/pipeline/states.ts` |
| **Per-state structured-output schemas** (Zod → JSON Schema) | `src/lib/schemas/` |
| **Provider abstraction** (interfaces, registry, resolution, anti-lock-in) | `src/lib/providers/` |
| **Prompt registry** (persona, per-state instructions, revision-memory) | `src/lib/prompts/` |
| **Cost estimation + originality (style-plagiarism) check** | `src/lib/cost.ts`, `src/lib/originality.ts` |
| **Durable FSM** (pipeline, media fan-out, flow handoff, onboarding) | `src/inngest/` |
| **Supabase clients** (server/browser/admin) | `src/lib/supabase/` |
| **App shell** | `src/app/` |

## Not yet wired (later phases — see PLAN §8)

- Auth UI + org/membership bootstrap (Phase 1)
- Real Server Actions to start pipelines + send gate decisions (Phase 2)
- BYO-key resolution from Supabase Vault (`resolvePlatformKey` is a TODO for Vault) (Phase 3)
- Media download → Supabase Storage + `media_files` rows (Phase 3)
- Veo polling/webhook + full Flow upload UI (Phase 4)
- Export bundle + notifications (Phase 5)
- YouTube upload **behind a flag, post compliance-audit** (Phase 6)
- Authenticity/compliance hardening: publish-velocity caps, claims-to-verify UI (Phase 7)

## Verification (Phase 0 acceptance)

```bash
npm run typecheck                       # contracts + schemas compile
supabase db reset                       # migration applies clean on a fresh DB
psql "$DATABASE_URL" -f supabase/tests/rls_check.sql   # cross-org access is denied
```

## Compliance (read before launch)

YouTube's "inauthentic content" policy (Jul 2025) targets mass-produced templated AI video.
GATEs are genuine human-authorship checkpoints — not rubber-stamps. In-app YouTube upload stays
**off** (`FEATURE_YOUTUBE_UPLOAD=false`) until the Google Cloud project passes the YouTube API
compliance audit; default delivery is an export bundle + manual upload. See PLAN §7.
