# ContentEngineAI — Bouwplan

> Uitvoerbaar plan voor een coding agent (Claude Code) om de ContentEngineAI-webapp te bouwen.
> Gebaseerd op `ContentEngineAI_Build_Spec_and_Context.md` (de 22-state engine-spec) + een
> multi-agent design/review-ronde. Technische identifiers, schema's en code in het Engels;
> toelichting in het Nederlands.

**Bevestigde productbeslissingen (uitgangspunt):**
1. **Moderne stack**, direct uitvoerbaar door een coding agent.
2. **Volledige pipeline mét media-generatie via API's**, achter een **pluggable provider-laag** zodat de
   eigenaar (Google Flow / Veo) én andere gebruikers per modaliteit (LLM / image / voice / video) kunnen
   kiezen, met BYO-API-key support en sensible defaults.
3. **Multi-tenant-ready vanaf dag 1** (org-tenancy, RLS, encrypted keys) — eigenaar eerst, anderen later.

---

## 0. TL;DR — de 10 kernbeslissingen

1. **Stack:** TypeScript end-to-end · Next.js 15 (App Router) · Supabase (Postgres + Auth + Storage + Vault) · **Inngest** als durable orchestrator · Tailwind + shadcn/ui + TanStack Query · deploy op Vercel + Supabase Cloud.
2. **Engine:** de 22 states als **config-driven FSM in Inngest**. AUTO-steps draaien onbewaakt; GATE-steps pauzeren op `step.waitForEvent` tot de mens approve/revise stuurt. Eén bron van waarheid: een `pipeline_state_defs`-tabel.
3. **Tenant = `org`** (niet user). `org_id` op élke rij, RLS via `is_org_member()`. Eigenaar = 1 org. Dit is de enige multi-tenant-zaak die er vanaf dag 1 echt moet zijn.
4. **Provider-abstractie:** één interface per modaliteit + registry. **fal.ai** als snelle default-aggregator voor image/video, **maar minstens één DIRECT-provider per modaliteit** achter dezelfde interface (anti-lock-in). BYO-keys ondersteunen zowel fal- als native keys.
5. **Media-generatie draait in een APARTE Inngest-functie** (per video/batch), aangeroepen vanuit de hoofd-pipeline — nooit 70-120 beats als steps in de hoofdfunctie (step-ceiling + isolatie van retries).
6. **Verplichte cost-gate:** vóór élke media-fan-out een expliciete kostenraming + approval-GATE, plus een per-org quota-check als harde `NonRetriableError` vóór de eerste generate-call. Een longform-video op Veo 3 kan >$100 kosten — dit mag nooit ongated.
7. **Google Flow heeft GEEN publieke API** → first-class **manual export/import handoff** als eigen durable functie (per-beat resumable upload, partial-finalize). Veo-via-API (Gemini API) is het zero-friction alternatief en de default voor nieuwe tenants.
8. **Levering MVP = export-.zip + handmatige upload.** In-app YouTube-upload/scheduling komt ná de YouTube **compliance-audit**, achter een feature-flag. (`videos.insert` ≈ 100 units → ~100 uploads/dag op default quota; quota is *niet* de blocker — de audit wél.)
9. **Prompt-decompositie:** de monolithische system prompt wordt een `prompt registry` met één versioned template per state + gedeelde persona, en **strict JSON Schema** output per state. Revision-memory = prior version + feedback meesturen (editen, niet regenereren).
10. **Compliance is een acceptatiecriterium, geen bijzaak:** YouTube's "inauthentic content"-beleid (jul 2025) viseert precies dit producttype. GATEs zijn echte menselijke auteurschap-checkpoints, met originaliteit + "claims to verify" + publish-velocity-caps.

---

## 1. Architectuur op hoog niveau

```
┌───────────────────────────────────────────────────────────────────────────┐
│  Next.js 15 (App Router) — UI + Server Actions (Vercel)                     │
│   • Server Actions emitten alleen EVENTS naar Inngest (geen zware compute)  │
│   • TanStack Query pollt videos.current_state/status voor de live tracker   │
└───────────────┬──────────────────────────────────────┬────────────────────┘
                │ inngest.send(event)                    │ SQL (RLS)
                ▼                                        ▼
┌───────────────────────────────┐        ┌──────────────────────────────────┐
│  Inngest — durable functies    │        │  Supabase Postgres                │
│  • videoPipeline (22-state FSM)│◄──────►│  • orgs/memberships (RLS)         │
│  • mediaFanout (image/video)   │  data  │  • channels (brand_memory JSONB)  │
│  • flowHandoff (manual import) │        │  • videos / state_executions      │
│  • onboardingPipeline          │        │  • assets (versioned) / media_files│
│  step.run / waitForEvent /     │        │  • api_keys (Vault) / usage_events│
│  step.invoke                   │        │  Supabase Storage (media binaries)│
└───────┬───────────────────────┘        │  Supabase Vault (encrypted keys)  │
        │ provider calls (server-side)    └──────────────────────────────────┘
        ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  Provider-laag (registry, één interface per modaliteit)                     │
│  LLM: Anthropic/Gemini · Image: fal + ≥1 direct · Voice: ElevenLabs        │
│  Video: Veo (Gemini API/fal) + Flow(manual) · YouTube Data API (post-audit)│
└───────────────────────────────────────────────────────────────────────────┘
```

### Stack-keuzes

| Laag | Keuze | Rationale |
|------|-------|-----------|
| Taal | **TypeScript** (strict) | Eén taal door UI, backend, workflows, provider-SDK's. |
| Front+back | **Next.js 15 (App Router)** | Server Components + Server Actions; één deploybaar artefact. Actions emitten enkel events. |
| UI | **Tailwind + shadcn/ui + Radix + TanStack Query** | Owned componenten voor state-tracker, compare-views, diff; server-state/polling voor resumability. Editor: Tiptap. Upload: react-dropzone. Iconen: lucide. |
| DB | **Postgres via Supabase** | Relationele tenancy + JSONB voor `brand_memory`/`assets.content`; Auth/Storage/RLS/Vault in één. |
| Auth+tenancy | **Supabase Auth + eigen `orgs`/`memberships`, afgedwongen via RLS** | UUID-native; `auth.uid()` werkt direct in policies; data-isolatie afgedwongen door de DB, niet enkel app-code. |
| Storage | **Supabase Storage** (S3-compat) | Binaire media als signed URLs; DB houdt enkel paths + metadata. |
| Orchestratie | **Inngest** | `waitForEvent` = first-class gate-pauze; geen determinisme-overhead bij LLM/media-calls; multi-tenant queue met per-tenant concurrency-fairness. |
| Hosting | **Vercel** (app + Inngest endpoint) + **Supabase Cloud** | Inngest doet het langdurige werk → Vercel-functie-timeout is geen beperking. |
| E-mail | **Resend of Postmark** | Transactionele notificaties bij elke GATE-transitie (load-bearing voor "leave & come back"). |

**Bewust overwogen, niet gekozen:** Clerk (auth) — org-data buiten je DB + string-id's botsen met UUID-RLS; pas relevant bij B2B-SSO. Temporal — determinisme-eis botst met een volledig non-deterministische LLM/media-pipeline. Trigger.dev — sterke tweede keuze, kies dit als Inngest-limieten (zie §3.4) knellen. Eigen DB-FSM + BullMQ — te veel maatwerk-infra voor een owner-first MVP.

---

## 2. De pipeline-engine (22-state FSM)

### 2.1 States als data, niet als code

De 22 states leven in een geseede `pipeline_state_defs`-tabel met per state: `kind` (AUTO/GATE), `is_optional`, `is_visual`, `needs_user_upload`, `produces_asset_types`. De pipeline-functie itereert deze config. Eén bron van waarheid; UI rendert de tracker eruit.

| Categorie | States |
|---|---|
| **GATE** | 2, 3, 5, 9, 10, 11, 12, 16, 18, en optioneel 15, 21 |
| **AUTO** | 1, 4, 6, 7, 8, 13, 14, 17, 19, 20, 22 |
| **Genereert scene-/video-/thumbnail-beeld** (visual gate) | 14 (scene-images), 15 (clips), 18 (thumbnail-images) |
| **Vereist user-upload** | 12 (frames), 16 (thumbnails) |
| **Branding-uitzondering op visual gating** | 3 (logo/banner) — mag wél vóór script-approval |

> **Correctie op de visual-gating-scope:** gate de **daadwerkelijke beeldgeneratie** (states 14/15/18 + de media-jobs), niet de analyse-states. State 13 (Visual Style Analysis) en 17 (Thumbnail Analysis) zijn LLM-vision over *geüploade* beelden — ze genereren niets en horen niet onder de gate. Branding (3) is de enige generatie die vóór State 11 mag.

### 2.2 AUTO vs GATE lifecycle

- **AUTO:** model draait onbeheerd → schema-gevalideerd → asset opgeslagen → `current_state` schuift automatisch door. Validatie-fail → auto-revise/retry, geen stop voor de gebruiker (wel een non-blocking flag bij fout).
- **GATE:** na generatie zet de worker de executie + video op `awaiting_curation` en de FSM **stopt hard**. Pas een expliciete user-actie (approve / revise / select) deblokkeert.

```
AUTO:  pending → running → succeeded → advance
GATE:  pending → running → awaiting_curation ─┬─ approve → advance
                                              └─ revise  → attempt+1, nieuwe asset-versie, terug naar awaiting_curation
```

**Advance-regel** (transactioneel, DB-functie `advance_video(video_id)`):
1. Markeer huidige executie `succeeded`/`approved`.
2. Volgende state = kleinste `state_no > current_state` die niet geskipt wordt:
   - Skip 2-3 als `channels.onboarding_path = 'existing'`.
   - Skip optionele states (15, 21) als niet in `videos.enabled_optional_states`.
3. **Visual-gating-guard:** als next een genererende visual-state is (14/15/18) en er geen approved `script`-asset bestaat (State 11) → weiger, zet `videos.status = 'blocked'`.
4. Zet `current_state = next`; AUTO → enqueue + `running`; GATE → na run `awaiting_curation`.

### 2.3 GATE-pauze + resume (Inngest) — gecorrigeerde vorm

```typescript
export const videoPipeline = inngest.createFunction(
  { id: "video-pipeline", concurrency: { key: "event.data.orgId", limit: 3 } },
  { event: "pipeline/start" },
  async ({ event, step }) => {
    const { videoId, orgId } = event.data;

    // ── STATE 10 (AUTO-generate van script) ──
    await step.run("state-10-script", () => generateAndSaveScript(videoId));
    await step.run("state-10-mark-gate", () => setState(videoId, 11, "awaiting_curation"));

    // ── GATE bij STATE 11: pauzeer tot mens beslist (BOUNDED revise-loop) ──
    let approved = false, version = 1;
    const MAX_REVISIONS = 6; // harde grens — geen oneindige loop
    for (let i = 0; i < MAX_REVISIONS && !approved; i++) {
      const decision = await step.waitForEvent(`script-gate-${i}`, {
        event: "gate/script.decided",
        timeout: GATE_TIMEOUT,          // §3.4: geverifieerde max van het Inngest-plan, NIET hardcoded 30d
        match: "data.videoId",
      });
      if (!decision) { await setState(videoId, 11, "expired"); return { status: "expired" }; }
      if (decision.data.action === "approve") {
        approved = true; await markApproved(videoId, "script", version);
      } else {
        version++;
        await step.run(`state-10-revise-v${version}`, () =>
          reviseScript(videoId, version, decision.data.feedback)); // prior version + feedback
      }
    }
    if (!approved) { await setState(videoId, 11, "needs_attention"); return { status: "max_revisions" }; }

    // ── VISUAL GATING: pas NA approve mag media. Media in EIGEN functie (geen 70+ steps hier) ──
    // ── COST-GATE vóór elke media-fan-out (zie §4.5) ──
    const estimate = await step.run("estimate-media-cost", () => estimateMediaCost(videoId));
    const ok = await step.waitForEvent("cost-gate", {
      event: "gate/cost.approved", timeout: GATE_TIMEOUT, match: "data.videoId",
    });
    if (!ok) { await setState(videoId, 14, "awaiting_curation"); return { status: "cost_gate_pending" }; }

    await step.run("quota-check", () => assertOrgQuota(orgId, estimate)); // NonRetriableError bij overschrijding
    await step.invoke("run-media-fanout", { function: mediaFanout, data: { videoId, orgId } });
    // ... states 19/20/22
  }
);
```

De UI stuurt een beslissing simpelweg als event: `inngest.send({ name: "gate/script.decided", data: { videoId, action: "revise", feedback } })`. De gepauzeerde run hervat exact waar hij stond; de browser hoeft geen verbinding vast te houden.

### 2.4 Revision-memory (editen, niet regenereren)

`assets` is **append-only**: elke generate én revise schrijft een nieuwe rij met opgehoogde `version`, `parent_version_id`, `feedback`, `source ∈ {generate,revise,auto-revise}`. Bij revise injecteert de orchestrator een `REVISION_BLOCK` (prior output + feedback + "maak de kleinste wijziging die de feedback volledig adresseert; behoud wat de user niet aankaartte; zelfde JSON-schema"). Auto-revise gebruikt hetzelfde mechanisme met door de app ingevulde feedback (bv. word-count buiten ±5%, audit-criterium <7, originaliteit-overlap). Niets wordt ooit overschreven → volledige audit trail + diff-view + rollback.

---

## 3. Datamodel (canoniek — verzoend)

> **Belangrijk:** de design-ronde leverde drie licht afwijkende schema-varianten. Dit is de **canonieke** versie — gebruik enkel deze. Verschillen die zijn opgelost: tenant = **org** overal; `parent_version_id` = **uuid**; één feedback-kolom genaamd **`feedback`**; **`source`** enum toegevoegd op `assets`.

### 3.1 Conventies
- PK's: `uuid default gen_random_uuid()`. `created_at/updated_at timestamptz default now()` overal.
- **Gedenormaliseerde `org_id` op élke business-rij** → triviale, performante RLS (`org_id`-predicate i.p.v. joins).
- RLS aan op alle tenant-tabellen; uit op globale referentietabellen (`providers`, `pipeline_state_defs`) en `audit_log` (service-role only).

### 3.2 RLS-helpers
```sql
create or replace function current_org() returns uuid language sql stable as
$$ select nullif(current_setting('app.current_org', true), '')::uuid $$;

create or replace function is_org_member(target uuid) returns boolean
  language sql stable security definer as $$
  select exists (select 1 from memberships m
    where m.org_id = target and m.user_id = auth.uid() and m.status = 'active') $$;

-- generieke policy per tenant-tabel:
-- alter table <t> enable row level security;
-- create policy <t>_rw on <t> using (is_org_member(org_id)) with check (is_org_member(org_id));
-- (write verfijnd op role via aparte policies; viewer = alleen SELECT)
```

### 3.3 Tenancy
```sql
create table app_users (             -- 1:1 spiegel van auth.users
  id uuid primary key, email citext unique not null, display_name text,
  plan text not null default 'free' check (plan in ('free','pro','studio')),
  created_at timestamptz not null default now());

create table orgs (
  id uuid primary key default gen_random_uuid(), name text not null,
  slug citext unique not null,
  plan text not null default 'free' check (plan in ('free','pro','studio')),
  owner_id uuid not null references app_users(id), created_at timestamptz not null default now());

create type membership_role   as enum ('owner','admin','editor','viewer');
create type membership_status as enum ('active','invited','suspended');
create table memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  role membership_role not null default 'editor',
  status membership_status not null default 'active', unique (org_id, user_id));
```

### 3.4 Providers + encrypted keys (BYO)
```sql
create type modality as enum ('llm','image','voice','video','youtube','design');

create table providers (                -- GLOBAAL, geen RLS
  id text primary key,                  -- 'anthropic','gemini','fal','elevenlabs','veo','youtube',...
  display_name text not null, modalities modality[] not null,
  auth_type text not null check (auth_type in ('api_key','oauth','mcp','none')),
  has_public_api boolean not null default true,    -- Google Flow = false → manual handoff
  config_schema jsonb);

create table api_keys (                  -- org-scoped (tenant = org)
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  provider_id text not null references providers(id),
  modality modality not null, label text,
  secret_id uuid not null,              -- → Supabase Vault (vault.secrets); NOOIT plaintext in deze tabel
  secret_last4 text, oauth_refresh_secret_id uuid,
  is_default boolean not null default false,
  status text not null default 'active' check (status in ('active','revoked','invalid')),
  created_by uuid references app_users(id),
  unique (org_id, provider_id, modality, label));
create unique index one_default_per_modality on api_keys (org_id, modality) where is_default;
```
> **Secret-handling:** keys/refresh-tokens in **Supabase Vault**; decryptie alleen server-side in jobs via `vault.decrypted_secrets`. Client-rollen kunnen ciphertext nooit selecteren (column-level grant revoke). Geen secrets in logs/Sentry. "Test connection" zonder plaintext te persisteren. RLS = defense-in-depth, niet de enige controle.

### 3.5 Channels (brand_memory + onboarding-path)
```sql
create type onboarding_path as enum ('new','existing');
create type channel_status  as enum ('onboarding','ready','archived');

create table channels (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  onboarding_path onboarding_path not null,
  name text, handle text, reference_channel text, reference_channel_resolved jsonb,
  niche text, category text,
  brand_memory jsonb not null default '{}'::jsonb,        -- typed; zie §6
  brand_memory_ready boolean not null default false,
  brand_memory_built_at timestamptz,
  status channel_status not null default 'onboarding', created_by uuid references app_users(id));
create index channels_brand_memory_gin on channels using gin (brand_memory jsonb_path_ops);
```
Onboarding-logica (in pipeline, niet DDL): bij `existing` worden 2-3 geskipt (`name`/`handle` van user), maar 4/6/7/8/13/17 draaien wél. Beide paden → `brand_memory_ready=true` → `status='ready'` → per-video pipeline beschikbaar. Provider-selectie per channel leeft in `brand_memory.providers`; de **keys** leven op org-niveau (`api_keys`). Documenteer die join.

### 3.6 Videos + state-machine
```sql
create type video_status as enum
  ('draft','running','awaiting_curation','blocked','failed','completed','archived');

create table videos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  channel_id uuid not null references channels(id) on delete cascade,
  title text, topic text,
  current_state smallint not null default 1 check (current_state between 1 and 22),
  status video_status not null default 'draft',
  enabled_optional_states smallint[] not null default '{}',   -- subset van {15,21}
  provider_config jsonb not null default '{}'::jsonb,         -- per-modality keuze (zie onder)
  source_calendar_item_id uuid references calendar_items(id),
  created_by uuid references app_users(id), started_at timestamptz, completed_at timestamptz);
create index videos_active on videos (channel_id) where status in ('running','awaiting_curation');

create type state_kind as enum ('auto','gate');
create table pipeline_state_defs (      -- GLOBAAL, geseed
  state_no smallint primary key check (state_no between 1 and 22),
  slug text unique not null, title text not null, kind state_kind not null,
  is_optional boolean not null default false, is_visual boolean not null default false,
  needs_user_upload boolean not null default false,
  produces_asset_types text[] not null default '{}', description text);

create type execution_status as enum
  ('pending','running','succeeded','awaiting_curation','approved','revision_requested','failed','skipped');
create table state_executions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  video_id uuid not null references videos(id) on delete cascade,
  state_no smallint not null references pipeline_state_defs(state_no),
  attempt smallint not null default 1, status execution_status not null default 'pending',
  input_ref jsonb, output_asset_ids uuid[] not null default '{}',
  curated_by uuid references app_users(id), curation_note text,
  job_id text, error jsonb, retry_count smallint not null default 0,
  started_at timestamptz, finished_at timestamptz,
  unique (video_id, state_no, attempt));
```
`provider_config` (getypeerd in TS, opgeslagen JSONB):
```jsonc
{ "llm":   { "provider_id": "anthropic",  "model": "...",    "api_key_id": "uuid|null" },
  "image": { "provider_id": "fal",        "model": "...",    "api_key_id": "uuid|null" },
  "voice": { "provider_id": "elevenlabs", "voice_id": "...", "api_key_id": "uuid|null" },
  "video": { "provider_id": "veo", "mode": "api|manual_handoff", "api_key_id": "uuid|null" } }
```
`api_key_id = null` → org-default key voor die modaliteit. Resolver: video-override → org-default → systeem-default → harde fallback. Ontbrekende verplichte key → pipeline blokkeert met duidelijke fout vóór de eerste API-call.

### 3.7 Assets (versioned — canoniek)
```sql
create type asset_type as enum (
  'channel_name','branding_prompt','topic_idea','channel_analysis','style_dna',
  'audience_psychology','hook','script','script_audit','visual_style','scene_prompt',
  'motion_prompt','thumbnail_analysis','thumbnail_concept','seo','ab_variant','calendar','export_bundle');
create type asset_source as enum ('generate','revise','auto-revise');

create table assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  video_id uuid references videos(id) on delete cascade,      -- null voor channel-scoped (onboarding)
  channel_id uuid references channels(id) on delete cascade,
  state_no smallint references pipeline_state_defs(state_no),
  execution_id uuid references state_executions(id),
  type asset_type not null,
  version smallint not null default 1,
  parent_version_id uuid references assets(id),               -- UUID (canoniek)
  is_current boolean not null default true, approved boolean not null default false,
  content jsonb not null,
  rank smallint, slot_key text,                               -- beat-id, 'logo_1', dimension, ...
  feedback text,                                              -- feedback die tot DEZE versie leidde
  source asset_source not null default 'generate',
  provider_id text references providers(id), model text,
  cost_cents integer, tokens_in integer, tokens_out integer, latency_ms integer,
  created_by uuid references app_users(id));
create unique index assets_one_current
  on assets (video_id, type, coalesce(slot_key,'')) where is_current;
create index assets_content_gin on assets using gin (content jsonb_path_ops);
```
Curatie = **select** (kies uit ranked opties; alternatieven blijven bestaan), **edit** (handmatige aanpassing → nieuwe versie), of **revise** (terug naar model met feedback → nieuwe versie). Niets wordt verwijderd; alleen `is_current`/`approved`-vlaggen flippen.

### 3.8 Overige tabellen
```sql
-- transcripts(org_id, channel_id, tag 'T1'..'T5', source_url, text, word_count, duration_s, wps, fetched_via)
-- media_files(org_id, video_id, channel_id, asset_id, kind image|audio|video|document,
--   storage_bucket, storage_path, mime_type, width, height, duration_ms, byte_size,
--   provider_id, source 'generated'|'uploaded'|'manual_handoff', external_ref, cost_cents, checksum_sha256)
-- seo_packages(org_id, video_id unique, asset_id, titles text[], selected_title, description,
--   timestamps jsonb, tags text[], pinned_comments text[], category, recommended_upload_at)
-- calendars(org_id, channel_id, source_video_id, asset_id, span_days)
-- calendar_items(org_id, calendar_id, channel_id, title, angle, pillar, difficulty, scheduled_upload_at,
--   status idea|planned|in_production|published|skipped, spawned_video_id, position)
-- usage_events(org_id, video_id, provider_id, modality, units, cost_cents,
--   key_source byok|platform, note, created_at)   ← metering + budget-guards
-- jobs(org_id, video_id, execution_id, queue, status, attempts, max_attempts, scheduled_at, last_error)
-- audit_log(org_id, actor_id, action, entity_type, entity_id, meta, at)   ← append-only, service-role only
```
**Manual handoff (Flow):** bij `provider_config.video.mode='manual_handoff'` maakt de pipeline `media_files`-placeholders met `source='manual_handoff'` + `external_ref`; de executie wacht op `awaiting_curation` tot de user de clips uploadt (placeholder krijgt dan `storage_path`).

**Calendar-idee → video:** insert in `videos` met `source_calendar_item_id`, `topic`/`title` van het item, `current_state=5` (topic al "gelockt"); update `calendar_items.spawned_video_id` + `status='in_production'`. Bidirectionele lineage.

**A/B-varianten (State 20):** `assets` van type `ab_variant`, één rij per variant; `content = {dimension, variable_tested, hypothesis, value|media_file_id, baseline_asset_id}`; groepeer via `slot_key=dimension` + `rank`. Uitbreidbaar met latere `ab_results`-tabel zonder migratiepijn.

---

## 4. Provider-abstractie & externe services

### 4.1 Geverifieerde kernfeiten (2026)
- **Google Veo HEEFT een echte API** (Gemini API `generateVideos`, model `veo-3.x`), ~$0.40/sec (Veo 3) / ~$0.15/sec (Veo 3 Fast). *(Prijs varieert per bron — valideer bij implementatie tegen de live pricing-pagina.)*
- **Google Flow heeft GEEN publieke API** → manual export/import handoff (§4.4).
- **fal.ai** = aggregator met ~1 key voor honderden image/video-modellen (FLUX, Veo, Kling, Nano Banana, Imagen) → nieuwe modellen = één registry-regel.
- **ElevenLabs** Voice Design (`guidance_scale`, `loudness`) + TTS — direct integreren vanwege diepe controle die `brand_memory.voice_design_elevenlabs` nodig heeft.
- **YouTube Data API v3:** `videos.insert` ≈ **100 units** (sinds dec-2025 verlaging), `thumbnails.set` ≈ 50 units; default **10.000 units/dag/project** → **~100 uploads/dag**. Quota is *niet* de multi-tenant-blocker. **De echte blocker is de compliance-audit** (zie §4.6).

### 4.2 Interfaces per modaliteit (alles async-first)
```ts
interface ProviderResult<T> { ok: boolean; data?: T; jobId?: string; costCents?: number; error?: ProviderError }
interface ProviderContext { orgId: string; channelId: string; projectId: string; apiKey: ResolvedKey }

interface LLMProvider   { id: string; capabilities:{vision:boolean;maxContextTokens:number;json:boolean};
  complete(req:{system?:string;messages:Msg[];jsonSchema?:object;temperature?:number}, ctx):Promise<ProviderResult<LLMOutput>>; }
interface ImageProvider { id: string; capabilities:{textInImage:boolean;maxResolution:string;refImages:boolean};
  generate(req:{prompt:string;refImages?:Url[];aspectRatio:string;n?:number}, ctx):Promise<ProviderResult<ImageOutput>>; }
interface VoiceProvider { id: string;
  designVoice(req:{description:string;guidanceScale:number;loudness:number;previewText:string}, ctx):Promise<ProviderResult<VoiceDesign>>;
  synthesize(req:{voiceId:string;text:string;modelId:string}, ctx):Promise<ProviderResult<AudioOutput>>; }
interface VideoProvider { id: string; mode:"api"|"manual";
  generate(req:{prompt:string;refImage?:Url;durationSec:number;aspectRatio:string}, ctx):Promise<ProviderResult<VideoJob>>;
  /* manual-providers retourneren ok:true met een handoff-payload i.p.v. een job */ }
```

### 4.3 Registry + selectie + anti-lock-in
Een centrale registry mapt `(modality, providerId) → instance` met metadata (`displayName`, `mode`, `approxCostPerSecCents`, `keyStrategy: platform|byok`, `schema`, `factory`).

**Resolutie (meest-specifiek wint):** per-project override → per-channel default (`brand_memory.providers`) → platform-default per plan → harde fallback.

> **Anti-lock-in (kritieke correctie):** fal.ai is de snelle default, **maar implementeer vanaf dag 1 minstens één DIRECT-provider per modaliteit** achter dezelfde interface (bv. Veo via Gemini API direct; één image-provider direct). BYO-keys ondersteunen zowel fal- als native keys. Een `fallbackChain` per modaliteit (bv. image: `[nano-banana-pro → imagen4 → flux]`) routeert om een fal-uitval heen. Zo is "pluggable" echt waar en is een aggregator-outage overleefbaar.

### 4.4 Google Flow manual handoff (eigen durable functie)
1. State 14/15 produceren standalone scene-prompts + motion-specs (volledig geautomatiseerd, LLM).
2. Bij `mode='manual'` retourneert `generate()` geen job maar een **handoff-pakket**: genummerde shotlist (per beat: prompt, duur, aspect ratio, ref-frame) als kopieerbare tekst + downloadbare JSON/CSV. Status → `awaiting_manual_render`.
3. Eigenaar rendert in Flow en **uploadt clips terug** (filename-conventie `beat_01.mp4` of re-match UI bij mismatch).
4. Upload triggert dezelfde post-processing (assets/versioning/approval) als het API-pad.

> **Maak dit een aparte `flowHandoff`-functie**, losgekoppeld van de hoofd-pipeline, met **per-beat status-tracking**, **resumable upload**, en een **"finalize met N van M clips"-escape-hatch**. Dit is het hoogste-frictie, meest-abandonment-gevoelige pad én de persoonlijke default van de eigenaar — investeer hier disproportioneel in UX. Default voor nieuwe tenants = `veo-api` (zero-friction).

### 4.5 Kosten- & rate-limit-strategie (verplicht)
- **Alle media-gen async** in queue/eigen Inngest-functie; web-request blokkeert nooit.
- **Cost-gate vóór elke fan-out:** toon geschatte kost (`beats × avg_duration × provider_rate`) en eis een aparte "generate"-bevestiging (als echte `waitForEvent`-gate, niet enkel prose). Default = goedkope Fast-tier.
- **Per-org quota als harde check vóór de eerste call** (`NonRetriableError` bij overschrijding). Soft-cap waarschuwt, hard-cap blokkeert.
- **Batch** scene-prompts (chunked, §6.3); image-gen parallel met begrensde concurrency (4-8).
- **Caching/dedup:** hash `provider_id + genormaliseerde params + prompt`; revise raakt alleen gewijzigde beats → directe besparing.
- **Metering:** elke call schrijft `usage_events` (units, cost_cents, key_source) → per-tenant rapportage + budget-guards. Bij BYOK: loggen + rate-limiten (kosten zijn van de user).

Indicatieve kosten: video is veruit de grootste post (een 71-beat video op Veo 3 ≈ $100+); image enkele dollars; voice goedkoop; LLM verwaarloosbaar t.o.v. media.

### 4.6 YouTube-integratie (post-audit, achter flag)
- Scopes: `youtube.upload` (insert) + `youtube` of `youtube.force-ssl` (thumbnail/metadata). Refresh-token per channel encrypted (Vault).
- Upload altijd als `privacyStatus='private'` + `status.publishAt` (ISO 8601) voor scheduling; `thumbnails.set` (<2 MB, ≥1280×720). Publish blijft **human-confirmed**.
- **Hard gate:** een ongeverifieerd API-project (aangemaakt na 2020-07-28) forceert alle uploads naar `private` en kan niet publiek schedulen tot de **YouTube compliance-audit** slaagt. → **MVP-levering = export-pakket + handmatige upload**; in-app API-upload/scheduling is een post-audit feature achter een flag. Budgetteer de audit als externe milestone; een AI-massa-productietool wordt extra gescrutineerd (zie §7).

---

## 5. UX — schermen & flows

### 5.1 Sitemap
```
/auth (login/signup · Google OAuth)
/onboarding (full-screen wizard) → /choose-path → /new/... | /existing/...
/dashboard (org-home: channels + "needs your review"-inbox + recent activity)
/c/:channelId
  /home          channel-home: brand-memory-samenvatting + video-lijst + "New video"
  /brand-memory  read/edit van het brand_memory-object (secties als kaarten)
  /videos        lijst + /:videoId (per-video pipeline) + /state/:n (deep-link)
  /inbox         alle open GATES van dit channel
  /library       asset library (alle assets, alle versies)
  /calendar      30-day content calendar (State 21)
  /settings      per-channel provider-override
/settings        /account · /providers · /api-keys · /billing · /team(toekomst)
```
Channel-switcher linksboven; settings op twee niveaus (org-default + per-channel override met "inherit"-toggle).

### 5.2 Onboarding-wizard (NEW vs EXISTING)
Full-screen, lineaire progress-rail in **fases** (geen 22 nummers).
- **NEW:** `Reference → Name → Branding → Learning your style → Done`. State 1 = URL plakken + live sub-status; State 2 = grid van 10 ranked names (kies/revise); State 3 = tabs Logo (3)/Banner (2) met hex-swatches + **Generate** (visual-gating-uitzondering); dan 4/6/7/8 + upload-gates 12/16 → 13/17.
- **EXISTING:** `Connect channel → Learning your style → Visuals & thumbnails → Done`. Intake-formulier (name/handle/URL), **skip 2-3**, dezelfde brand-memory-bouw uit eigen materiaal.
- Zware AUTO-fase als **één "Building your brand memory"-scherm met live afvinkende checklist** ("You can leave — we'll email you"). AUTO-output is read-only met "Re-run / Edit"-affordance, blokkeert niet.
- Beide paden eindigen op het **Brand Memory-overzicht** (bewerkbare kaarten) + CTA "Create your first video".

### 5.3 Per-video pipeline
Drie zones: (a) **persistente verticale State Tracker** links (22 states in 6 fases, type-badge AUTO/GATE, status-icoon, **slotje** op genererende visual-states tot State 11), (b) active state-view midden, (c) context-paneel rechts (revision history, brand-memory-pin). Voltooide states klikbaar voor read-back; niet vooruit-springbaar (dwingt sequentialiteit af). "State X / 22" altijd zichtbaar.

- **Inbox "What needs your review"** (per channel + geaggregeerd op dashboard): alle videos op een GATE, met deeplink naar exact die state. Gefaalde AUTO-steps verschijnen als "Re-run needed".
- **Notificaties** bij elke GATE: in-app badge/toast + e-mail met deeplink (default aan; preferences per channel). Load-bearing voor "leave & come back" → emit een notification-step vanuit Inngest bij elke GATE-transitie + AUTO-fase-completion.
- **Resumability:** alle state server-side; AUTO-jobs draaien als background workers (tab mag dicht). Bij terugkomst rehydrateert het scherm naar de huidige state.

### 5.4 Curation-views (gedeelde interactiegrammatica)
`[ ◯ select ] [✎ edit inline] [↻ revise w/ feedback] [✓ approve & continue →]`
- **Side-by-side opties:** hooks (5 kaarten, archetype + word count + duration + score), titels (5), thumbnails (5 met render-preview + CTR-reasoning).
- **Script-editor (10):** document-editor met live word-count vs target (±5%) + WPS/duration.
- **Audit-scorecard (11):** 10 criteria met score-balken; elk criterium <7 rood + "Revise this"; "Approve" pas actief als geen criterium <7 (met bewuste override). Toon hier ook de **originaliteitsstatus** + de **"claims to verify"-lijst** (§6.4, §7).
- **Scene-prompt + image-gallery (14):** beat-by-beat grid; per beat prompt (editable) + image + regenerate/edit/approve; banner "12 beats · 12 prompts · 10 images" dwingt "every beat covered" af; aparte "extra fill-beats"-sectie.
- **Motion/video-handoff (15):** API-provider → per-beat "Generate clip"; **Flow manual** → per beat "Copy prompt" + drop-zone "Upload clip", samenvattingsbalk "8/12 uploaded · 4 pending".
- **Cost-gate-scherm (vóór media):** geschatte kost in $ + provider + aantal beats → "Generate" bevestigen.

### 5.5 Library, export, settings
- **Library:** alle assets, filterbaar op type/video/approved/version; versie-historie + diff-view; preview voor beeld/audio.
- **Export (22):** manifest van het pakket + "Download .zip"; optioneel "Push to YouTube (review before publish)" (post-audit).
- **Settings:** vier modaliteit-rijen (LLM/Image/Voice/Video) met default-dropdown + "sensible default"-label; API-keys met masked input + "test connection" + status-pill; YouTube OAuth-connect; per-channel override met "inherit"-toggle.

### 5.6 Design-system & device
shadcn/ui op Tailwind, Radix-primitives, TanStack Query, Tiptap (editor), react-dropzone, lucide. **Desktop-first** voor de productieve kern (pipeline, editor, gallery, side-by-side). **Mobiel beperkt tot review-on-the-go** (notificaties, inbox, GATE-acties approve/revise); zware acties tonen "Best done on desktop" + deeplink.

---

## 6. Pipeline / prompt-engineering

### 6.1 Decompositie i.p.v. mega-prompt
De monolithische system prompt wordt een **`prompt registry`**: één versioned template per state + gedeelde persona. Voordelen: deterministische per-state output, goedkoper (alleen relevante context), model-routing per state, onafhankelijke evaluatie/iteratie, foutisolatie, en GATE-orkestratie door de app (niet het model).

**Anatomie van een state-call:**
```
[SYSTEM] 1. PERSONA_BLOCK (constant, prompt-cachebaar)  2. STATE_INSTRUCTION (versioned)  3. OUTPUT_CONTRACT (JSON Schema)
[USER]   4. CONTEXT_PAYLOAD: { brand_memory: <projection>, state_inputs: {...}, revision?: {prior, feedback} }
```
`PERSONA_BLOCK` (constant): "You are ContentEngineAI, one state in a sequential 22-state pipeline. GLOBAL RULES: stay 100% original (match style, never copy wording); only do the current state; honor brand_memory as single source of truth; output ONLY the requested JSON."

### 6.2 Structured output (strict JSON Schema per state)
Afgedwongen via provider-feature (`response_format: json_schema strict` / forced tool-use / `responseSchema`). Schemas in `schemas/states/*.json` zijn de bron van waarheid voor LLM-call + DB-opslag + UI-rendering. Conventies: `additionalProperties:false` overal; `rank` op elke optielijst; woord-/duurmetadata waar de UI het toont. Voorbeeld (State 9, Hooks):
```json
{ "title":"HookOptions","type":"object","additionalProperties":false,"required":["options"],
  "properties":{"options":{"type":"array","minItems":5,"maxItems":5,"items":{
    "type":"object","additionalProperties":false,
    "required":["rank","archetype","text","word_count","estimated_duration_sec","why_it_works"],
    "properties":{"rank":{"type":"integer","minimum":1,"maximum":5},
      "archetype":{"type":"string","enum":["curiosity-gap","bold-claim","story-open","question","pattern-interrupt"]},
      "text":{"type":"string"},"word_count":{"type":"integer","minimum":1},
      "estimated_duration_sec":{"type":"number","minimum":0},"why_it_works":{"type":"string"}}}}}}
```
Concreet te leveren schemas (Phase 0): State 2 (10 names), 3 (3 logo + 2 banner), 5 (10 topics), 9 (5 hooks), 10 (script met `beats[]` + target/actual word count), 11 (10-punts scorecard), 14 (scene-prompts per beat met `is_fill_beat`, `negative_prompt`), 15 (motion per beat), 18 (5 thumbnail-concepts), 19 (SEO: 5 titles/description/timestamps/30 tags/3 pinned), 20 (A/B), 21 (30-day calendar). De app **hervalideert** kritieke regels zelf: word-count ±5% (State 10), `min(score) ≥ 7` (State 11), beat-coverage (State 14).

### 6.3 Context- & kostenbeheer
- **Brand_memory = single source of truth:** ruwe transcripts/frames worden eenmalig (onboarding) gecondenseerd tot `style_dna`/`audience`/`visual_style`/… en daarna **niet** meer meegestuurd — alleen de afgeleide, per-state **projection** (bv. State 14 krijgt `visual_style` + `narrator_character` + approved script-beats).
- **70-120 scene-prompts via chunked fan-out:** batches van 8-12 beats, parallel op een mid-tier model, daarna stitchen + coverage-validatie; ontbrekende beats → gerichte aanvul-call. **Draait in de aparte `mediaFanout`-functie** (niet als 100 steps in de hoofd-pipeline).
- **Model-routing per state:** goedkoop voor AUTO-analyse (1/4/6/7/8/13/17), mid voor ideatie (2/3/5/9/18/20) en fan-out (14/15), **sterk** voor script (10) + audit (11). Per-state configureerbaar in de registry, respecteert BYO-key.
- **Prompt caching** op de constante persona/instructie; per-call token/cost-logging naar `usage_events`.

### 6.4 Visual gating & originaliteit (server-afgedwongen)
- **Visual gating** als transition-guard op twee niveaus: (a) orchestrator weigert de state-call te bouwen, (b) media-provider-laag weigert elke job zonder geldige approved-script-referentie. UI-disable is cosmetisch; echte afdwinging is server-side. Branding (3) expliciet vrijgesteld.
- **Originaliteit (style-plagiaat):** na State 10 een deterministische n-gram-overlap-check tegen de eigen `transcripts.text` (shingles van 7-9 woorden; drempels bv. <2% gedeelde 8-grams, geen exacte match >12 woorden). Overschrijding → auto-revise met de overlappende spans als feedback. Optioneel een goedkope LLM-judge als backstop. **Label dit expliciet als style-plagiaat-check** (niet web/competitor-breed, niet fact-checking).
- **Factual claims:** extraheer feitelijke beweringen (getallen/namen/datums) en toon een **"claims to verify"-lijst bij de State 11-gate**. Gehallucineerde cijfers publiceren als feit = misinformatie-/reputatierisico (zie §7).

---

## 7. Compliance, veiligheid & risico's (first-class)

> De design-review legde één **bet-the-product** blinde vlek bloot die in geen enkele losse sectie zat. Behandel compliance als acceptatiecriterium, niet als bijzaak.

| Risico | Ernst | Mitigatie (in te bouwen) |
|---|---|---|
| **YouTube "inauthentic content"-beleid (jul 2025)** viseert precies massa-geproduceerde, getemplate AI-longform met AI-voice/visuals op snelheid → demonetisatie/strikes/YPP-verwijdering. Dit kan het échte kanaal van de eigenaar vernietigen. | **Hoog** | GATEs framen als echte menselijke auteurschap-checkpoints (geen rubber-stamp) en dat in de UX tonen; AI-voice + template-visuals optioneel maken, eigen VO/footage aanmoedigen; **publish-velocity per channel cappen** + waarschuwen bij batch-patronen; originaliteit-/inzicht-scoring bij State 11 die op YouTube's lat mikt (origineel inzicht, niet enkel niet-geplagieerd); compliance-disclaimer bij onboarding. |
| **Runaway media-kosten** (>$100/video op Veo 3, geen gate in eerste ontwerpcode) | **Hoog** | Harde per-org quota vóór de eerste generate-call; expliciete cost-estimate approval-GATE vóór elke fan-out; default Fast-tiers + goedkope image-modellen; `usage_events`-metering met soft/hard caps. |
| **YouTube compliance-audit** (ongeaudit project → uploads geforceerd private, geen publieke scheduling) | **Hoog** | MVP-levering = export + handmatige upload; in-app API-upload/scheduling post-audit achter flag; audit als externe milestone met doorlooptijd; producтnarratief benadrukt menselijke curatie. |
| **Gehallucineerde feiten** gepubliceerd als waarheid (Part D toont concrete financiële claims) | **Midden** | "Claims to verify"-lijst bij State 11; optioneel retrieval/verificatie voor feit-zware niches; nooit auto-publish. |
| **Voice cloning van een derde** (reference-channel-narrator via `clone_voice`) → impersonation/IP/publicity-rights | **Midden** | Voice **CLONE** alleen voor eigen stem achter consent/ownership-attestatie; clonen vanaf reference-channel verbieden. Voice **DESIGN** (synthetisch uit prompt) is onbeperkt. **MVP: enkel voice DESIGN** als consent-gating nog niet af is. |
| **Style-cloning ethiek/legaliteit** (een specifieke genoemde creator modelleren) | **Midden** | Stijl-PATRONEN benadrukken i.p.v. één persoon kopiëren; blending van meerdere references toestaan; n-gram-check behouden; documenteren dat de tool genre-conventies modelleert, geen beschermde expressie van een persoon. |
| **Multi-tenant secret-handling** (BYO-keys + YouTube refresh-tokens) | **Midden** | Vault/envelope-encryptie; column-level grant revoke; decryptie alleen server-side; geen secrets in logs/Sentry; key-rotation; RLS als defense-in-depth. |
| **Aggregator-lock-in** (alles via fal.ai) | **Midden** | ≥1 DIRECT-provider per modaliteit vanaf dag 1; BYO ondersteunt fal + native keys; `fallbackChain` routeert om uitval. |

### Observability & robuustheid
Inngest-dashboard (step-timeline per run) + structured logging (`videoId`/`orgId`/`state` op elke regel) + optioneel Sentry. Retries per `step.run` (retryable 429/5xx/timeout vs `NonRetriableError` voor auth/ongeldige prompt). Idempotentie: Inngest event-dedup + memoized steps; side-effects upsert op `(video_id, type, version)`. **Partiële fouten** (3 van 70 images falen): isolatie per beat-step; video → `partial`-status met "retry deze 3" i.p.v. hard-error; rerun doet alleen het ontbrekende werk (geen dubbele kosten).

---

## 8. Bouwvolgorde (fasen met verificatie)

> **Phase 0 is niet optioneel.** De review vond drie tegenstrijdige schema-/tenant-varianten; reconcilieer ze vóór er één regel feature-code is.

| Fase | Wat ship't | Verificatie (acceptance) |
|---|---|---|
| **0 — Canonical contracts** | Eén bron-van-waarheid DDL (§3, org-tenant, uuid `parent_version_id`, één `feedback` + `source` enum). Alle JSON-schemas (§6.2). `BrandMemory` TS/Zod-type (§9). `ProviderInterface`-signatures (§4.2). | Schemas compileren; migratie draait clean op verse Supabase; RLS-test weigert cross-org toegang. |
| **1 — Auth + tenancy + data** | Next.js 15 + Supabase Auth; `orgs`/`memberships`; RLS op elke tenant-tabel; Vault voor keys. | Tweede org kan channels/assets van eerste org niet lezen via directe query; ciphertext-kolom onleesbaar voor anon/auth-role. |
| **2 — Pipeline-skeleton (LLM-only, geen media, geen upload)** | Config-driven 22-state FSM in Inngest (AUTO/GATE, `waitForEvent` met geverifieerde+bounded timeout + max-revise), revision-memory, zichtbare state-tracker, NEW vs EXISTING onboarding. Eén LLM-provider. States 1·2·5·6·7·8·9·10·11·19·20 (alle tekst). | Volledige text-only run bereikt State 22-export van script+SEO; revise edit (niet regenereert); gates pauzeren/hervatten over een server-restart; visual-gating-guard blokkeert visual-states tot State 11 approved. |
| **3 — Provider-abstractie + voice + image (mét cost-controls éérst)** | Registry, per-channel/per-project resolutie, BYO-key-resolutie, `usage_events`-metering, **cost-estimate approval-GATE vóór elke generatie**. Eén DIRECT image-provider + fal achter dezelfde interface. ElevenLabs voice (eigen-stem clone consent-gating; MVP = voice DESIGN). Media-fan-out in **aparte** `mediaFanout`-functie. | Genereren vereist cost-gate + org-quota-check; 71-beat fan-out met partial-failure-retry van enkel gefaalde beats; provider wisselen = één config-change. |
| **4 — Video-generatie** | Veo-via-API (direct/fal) async met poller/webhook als default + Flow manual-handoff als eigen `flowHandoff`-functie (per-beat resumable upload, partial-finalize, filename/reorder-reconciliatie). Visual-states 14/15/18 enkel post-State-11. | API-pad produceert clips end-to-end; manual-pad exporteert shotlist, accepteert partial uploads, hervat, finaliseert N-van-M. |
| **5 — Levering** | MVP-levering = export-.zip + upload-instructies (nog geen API-upload). Asset library, versies/diff, calendar→video spawn, notificaties (transactionele e-mail per GATE). | Bundle bevat alle approved assets; calendar-rij spawnt video pre-seeded op State 5; e-mail vuurt bij gate-transitie. |
| **6 — YouTube API (achter flag, gated op audit)** | Per-channel OAuth, upload als private + `publishAt`, `thumbnails.set`, human-confirmed publish. | Upload landt als private op het verbonden channel; publieke/geplande publish **niet** aanzetten in product tot het project de YouTube compliance-audit passeert (externe milestone). |
| **7 — Authenticity/compliance-hardening** (vóór bredere multi-tenant uitrol) | Publish-velocity-caps, "claims to verify" bij State 11, monetization-safety-framing in UX, onboarding-disclaimer, audit-narratief. | Expliciete acceptance-review tegen de jul-2025 "inauthentic content"-lat. |

---

## 9. MVP-cut (wat wel/niet in de eerste shippable versie)

**CUT (later):**
- In-app YouTube API-upload/scheduling → default = export + handmatige upload.
- De brede provider-matrix → ship exact: 1 LLM (Claude), 1 image DIRECT + fal als fallback, ElevenLabs voice, Veo-via-API, + Flow manual-handoff. Registry blijft, maar geen Flux+Imagen+DALL-E+Ideogram+Kling+Runway+Luma+Pika op dag 1.
- Team-features (invites, rollen >owner, /team, /billing, plan-quota) → wel org-grain + RLS + Vault (multi-tenant-**ready**), maar ship single-owner-single-org.
- Optionele States 15 (motion) en 21 (calendar) + A/B (20) uit de eerste run → houd de tekst-spine (1-11, 19) + visual-spine (12-14, 18): dat levert al een bruikbaar videopakket.
- Web-breed/competitor-plagiaat + automatische fact-verificatie → houd de n-gram-check tegen eigen transcripts + een "claims to verify"-lijst bij State 11 (goedkoop, hoge waarde).
- Mobiele UX voorbij read-only review → houd desktop-first pipeline + minimale mobiele approve/revise.
- Voice cloning helemaal weg als consent-gating niet af is → houd ElevenLabs voice **DESIGN** (geen derden-consent-risico).

**NIET-onderhandelbaar (vanaf dag 1):** org-tenancy + RLS + Vault-key-encryptie · de Inngest-FSM met GATE pauze/resume + revision-memory · de zichtbare 22-state-tracker · visual-gating-afdwinging · de cost-estimate approval-gate vóór élke media-generatie · per-call usage-metering. Dit zijn de dragende correctheids-/veiligheidsprimitieven — niet wegcutten om "snel te shippen".

---

## 10. `BrandMemory`-type (single source of truth)

```ts
export interface BrandMemory {
  schema_version: 1;
  providers?: { llm?: string; image?: string; voice?: string; video?: string }; // per-channel default
  channel: { name: string; handle: string; reference_channel: string; niche: string;
             positioning: string; category: string; logo?: { media_file_id: string; prompt: string } };
  style_dna: { wps: number; target_length_words: number;
    sentence_mix: { short: number; medium: number; long: number };
    flow: string; tone_ratio: Record<string, number>; signature_transition: string[];
    trigger_vocab: string[]; opening: string; closing: string; signature_phrases: string[];
    analogy_style: string; cta: string };
  audience: { demo: string; knowledge: 'beginner'|'intermediate'|'advanced'|string;
    needs: string[]; pain_points: string[]; identity_promise: string; enemy: string };
  visual_style: { art: string; lighting: string; camera: string; composition: string;
    background: string; mood: string; overlays?: string; palette: { name?: string; hex: string }[] };
  narrator_character: { name: string; anchor_description: string; mouths?: string; usage: string };
  voice_design_elevenlabs: { primary_prompt: string; guidance_scale: number; loudness: number;
    preview_text: string; voice_id?: string };
  thumbnail_system: { text_style: string; composition: string; contrast: string; emotion: string; branding: string };
  music?: { style: string; references?: string[] };
}
```
Versioned envelope (`schema_version`) voor veilige evolutie. Wordt eenmalig afgeleid bij onboarding (states 4/6/7/8/13/17 vullen elk hun deelobject als regulier asset → bij approval ge-merged in `channels.brand_memory`) en daarna read-mostly per-state geprojecteerd geïnjecteerd.

---

## 11. Te verifiëren bij implementatie (open punten)
- **Inngest:** exacte max `waitForEvent`-timeout van het gekozen plan (niet 30d aannemen); step-ceiling per functie (daarom media in aparte functie); 4MB step-return-limiet.
- **Veo-prijs:** valideer ~$0.40/sec vs live Gemini-API pricing; idem fal.ai-opslag per model.
- **Transcript-collectie in productie** (State 4) zonder de Algrow-MCP: kies een third-party transcript-service (de MCP is enkel owner/harness-power-tool, geen multi-tenant-fundament).
- **YouTube compliance-audit:** doorlooptijd + of `yt-analytics`-scope in MVP nodig is (waarschijnlijk niet vóór de analytics-loop).
- **Image-provider voor tekst-in-beeld** (thumbnails): Nano Banana Pro is sterk; bevestig prijs/limieten bij keuze.

---

*Bronnen geverifieerd in de design-ronde: Veo 3 in Gemini API · "geen Flow API" · ElevenLabs Voice Design · Gemini/Imagen/Nano-Banana pricing · YouTube Data API quota & upload-docs · Inngest waitForEvent/concurrency/timeouts · Supabase RLS/Vault · Next.js hosting 2026 · fal.ai.*
*Dit plan reconcilieert de 5 design-dimensies (services, stack, datamodel, UX, pipeline) + de adversariële review tot één uitvoerbare bron van waarheid.*
