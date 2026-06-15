-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║ ContentEngineAI — canonical schema (Phase 0)                                 ║
-- ║ Single source of truth for all tables. Reconciles the three diverging        ║
-- ║ design variants: tenant = org everywhere; assets.parent_version_id = uuid;   ║
-- ║ one feedback column; assets.source enum present.                             ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists citext;
-- Supabase Vault (`supabase_vault`) is enabled by default on Supabase projects and
-- holds the actual encrypted provider secrets; api_keys only stores pointers to it.

-- ── updated_at helper ─────────────────────────────────────────────────────────
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ════════════════════════════════════════════════════════════════════════════
-- Tenancy: app_users, orgs, memberships
-- ════════════════════════════════════════════════════════════════════════════
create table app_users (
  id           uuid primary key,                       -- = auth.users.id
  email        citext unique not null,
  display_name text,
  plan         text not null default 'free' check (plan in ('free','pro','studio')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table orgs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       citext unique not null,
  plan       text not null default 'free' check (plan in ('free','pro','studio')),
  owner_id   uuid not null references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type membership_role   as enum ('owner','admin','editor','viewer');
create type membership_status as enum ('active','invited','suspended');

create table memberships (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  user_id    uuid not null references app_users(id) on delete cascade,
  role       membership_role   not null default 'editor',
  status     membership_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index memberships_user_idx on memberships (user_id);

-- ── RLS helpers (depend on memberships) ──────────────────────────────────────
create or replace function current_org() returns uuid
  language sql stable as
$$ select nullif(current_setting('app.current_org', true), '')::uuid $$;

create or replace function is_org_member(target uuid) returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from memberships m
     where m.org_id = target and m.user_id = auth.uid() and m.status = 'active') $$;

create or replace function org_role(target uuid) returns membership_role
  language sql stable security definer set search_path = public as
$$ select m.role from memberships m
   where m.org_id = target and m.user_id = auth.uid() and m.status = 'active' limit 1 $$;

-- ════════════════════════════════════════════════════════════════════════════
-- Providers (global reference) + api_keys (org-scoped, encrypted via Vault)
-- ════════════════════════════════════════════════════════════════════════════
create type modality as enum ('llm','image','voice','video','youtube','design');

create table providers (                       -- GLOBAL, no RLS
  id             text primary key,             -- 'anthropic','gemini','fal','elevenlabs','veo','flow','youtube'
  display_name   text not null,
  modalities     modality[] not null,
  auth_type      text not null check (auth_type in ('api_key','oauth','mcp','none')),
  has_public_api boolean not null default true,-- Google Flow = false -> manual handoff
  config_schema  jsonb
);

create table api_keys (
  id                      uuid primary key default gen_random_uuid(),
  org_id                  uuid not null references orgs(id) on delete cascade,
  provider_id             text not null references providers(id),
  modality                modality not null,
  label                   text,
  secret_id               uuid not null,        -- -> vault.secrets.id (the encrypted key)
  secret_last4            text,
  oauth_refresh_secret_id uuid,                 -- -> vault.secrets.id (encrypted refresh token)
  is_default              boolean not null default false,
  status                  text not null default 'active' check (status in ('active','revoked','invalid')),
  created_by              uuid references app_users(id),
  created_at              timestamptz not null default now(),
  unique (org_id, provider_id, modality, label)
);
create unique index api_keys_one_default_per_modality
  on api_keys (org_id, modality) where is_default;
-- secret_id is only a pointer; the secret itself lives in vault and is never
-- selectable by anon/authenticated. Decryption happens server-side via
-- vault.decrypted_secrets in Inngest jobs only.

-- ════════════════════════════════════════════════════════════════════════════
-- Channels (brand_memory + onboarding path)
-- ════════════════════════════════════════════════════════════════════════════
create type onboarding_path as enum ('new','existing');
create type channel_status  as enum ('onboarding','ready','archived');

create table channels (
  id                        uuid primary key default gen_random_uuid(),
  org_id                    uuid not null references orgs(id) on delete cascade,
  onboarding_path           onboarding_path not null,
  name                      text,
  handle                    text,
  reference_channel         text,
  reference_channel_resolved jsonb,
  niche                     text,
  category                  text,
  brand_memory              jsonb not null default '{}'::jsonb,
  brand_memory_ready        boolean not null default false,
  brand_memory_built_at     timestamptz,
  status                    channel_status not null default 'onboarding',
  created_by                uuid references app_users(id),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index channels_org_idx on channels (org_id);
create index channels_brand_memory_gin on channels using gin (brand_memory jsonb_path_ops);

-- ════════════════════════════════════════════════════════════════════════════
-- Pipeline definition (global) + videos + state executions
-- ════════════════════════════════════════════════════════════════════════════
create type state_kind as enum ('auto','gate');

create table pipeline_state_defs (             -- GLOBAL, no RLS (seeded in 0002)
  state_no          smallint primary key check (state_no between 1 and 22),
  slug              text unique not null,
  title             text not null,
  kind              state_kind not null,
  is_optional       boolean not null default false,
  is_visual         boolean not null default false,  -- true for the GENERATING visual states (14,15,18)
  needs_user_upload boolean not null default false,  -- 12, 16
  produces_asset_types text[] not null default '{}',
  description       text
);

create type video_status as enum
  ('draft','running','awaiting_curation','blocked','failed','completed','archived');

create table videos (
  id                      uuid primary key default gen_random_uuid(),
  org_id                  uuid not null references orgs(id) on delete cascade,
  channel_id              uuid not null references channels(id) on delete cascade,
  title                   text,
  topic                   text,
  current_state           smallint not null default 1 check (current_state between 1 and 22),
  status                  video_status not null default 'draft',
  enabled_optional_states smallint[] not null default '{}',   -- subset of {15,21}
  provider_config         jsonb not null default '{}'::jsonb,
  source_calendar_item_id uuid,                                -- FK added at end (circular)
  created_by              uuid references app_users(id),
  started_at              timestamptz,
  completed_at            timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index videos_org_idx on videos (org_id);
create index videos_channel_status_idx on videos (channel_id, status);
create index videos_active_idx on videos (channel_id)
  where status in ('running','awaiting_curation');

create type execution_status as enum
  ('pending','running','succeeded','awaiting_curation','approved','revision_requested','failed','skipped');

create table state_executions (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references orgs(id) on delete cascade,
  video_id         uuid not null references videos(id) on delete cascade,
  state_no         smallint not null references pipeline_state_defs(state_no),
  attempt          smallint not null default 1,
  status           execution_status not null default 'pending',
  input_ref        jsonb,
  output_asset_ids uuid[] not null default '{}',
  curated_by       uuid references app_users(id),
  curation_note    text,
  job_id           text,
  error            jsonb,
  retry_count      smallint not null default 0,
  started_at       timestamptz,
  finished_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (video_id, state_no, attempt)
);
create index state_executions_video_idx on state_executions (video_id, state_no);
create index state_exec_open_idx on state_executions (video_id)
  where status in ('running','awaiting_curation','revision_requested');

-- ════════════════════════════════════════════════════════════════════════════
-- Assets (versioned, append-only) — canonical versioning model
-- ════════════════════════════════════════════════════════════════════════════
create type asset_type as enum (
  'channel_name','branding_prompt','topic_idea','channel_analysis','style_dna',
  'audience_psychology','hook','script','script_audit','visual_style','scene_prompt',
  'motion_prompt','thumbnail_analysis','thumbnail_concept','seo','ab_variant','calendar','export_bundle');

create type asset_source as enum ('generate','revise','auto-revise');

create table assets (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references orgs(id) on delete cascade,
  video_id          uuid references videos(id) on delete cascade,     -- null for channel-scoped (onboarding)
  channel_id        uuid references channels(id) on delete cascade,
  state_no          smallint references pipeline_state_defs(state_no),
  execution_id      uuid references state_executions(id),
  type              asset_type not null,
  version           smallint not null default 1,
  parent_version_id uuid references assets(id),
  is_current        boolean not null default true,
  approved          boolean not null default false,
  content           jsonb not null,
  rank              smallint,
  slot_key          text,
  feedback          text,
  source            asset_source not null default 'generate',
  provider_id       text references providers(id),
  model             text,
  cost_cents        integer,
  tokens_in         integer,
  tokens_out        integer,
  latency_ms        integer,
  created_by        uuid references app_users(id),
  created_at        timestamptz not null default now()
);
create unique index assets_one_current
  on assets (video_id, type, coalesce(slot_key,'')) where is_current and video_id is not null;
create index assets_video_type_slot_idx on assets (video_id, type, slot_key);
create index assets_channel_type_idx on assets (channel_id, type);
create index assets_content_gin on assets using gin (content jsonb_path_ops);

-- ════════════════════════════════════════════════════════════════════════════
-- Transcripts, media files, SEO, calendars, usage, jobs, audit
-- ════════════════════════════════════════════════════════════════════════════
create table transcripts (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references orgs(id) on delete cascade,
  channel_id      uuid not null references channels(id) on delete cascade,
  tag             text not null,                  -- 'T1'..'T5'
  source_url      text,
  source_video_id text,
  text            text not null,
  word_count      integer not null,
  duration_s      integer,
  wps             numeric(6,3),
  fetched_via     text,                           -- 'algrow_mcp' | 'youtube_api' | 'manual'
  created_at      timestamptz not null default now(),
  unique (channel_id, tag)
);
create index transcripts_channel_idx on transcripts (channel_id);

create type media_kind as enum ('image','audio','video','document');

create table media_files (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references orgs(id) on delete cascade,
  video_id        uuid references videos(id) on delete cascade,
  channel_id      uuid references channels(id) on delete cascade,
  asset_id        uuid references assets(id) on delete set null,
  kind            media_kind not null,
  storage_bucket  text not null,
  storage_path    text not null,
  mime_type       text,
  width           integer,
  height          integer,
  duration_ms     integer,
  byte_size       bigint,
  provider_id     text references providers(id),
  source          text not null default 'generated'
                    check (source in ('generated','uploaded','manual_handoff')),
  external_ref    text,
  cost_cents      integer,
  checksum_sha256 text,
  created_at      timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);
create index media_files_video_kind_idx on media_files (video_id, kind);
create index media_files_asset_idx on media_files (asset_id);

create table seo_packages (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references orgs(id) on delete cascade,
  video_id              uuid not null references videos(id) on delete cascade,
  asset_id              uuid references assets(id),
  titles                text[] not null,
  selected_title        text,
  description           text not null,
  timestamps            jsonb,
  tags                  text[] not null,
  pinned_comments       text[] not null,
  category              text,
  recommended_upload_at timestamptz,
  created_at            timestamptz not null default now(),
  unique (video_id)
);

create table calendars (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references orgs(id) on delete cascade,
  channel_id      uuid not null references channels(id) on delete cascade,
  source_video_id uuid references videos(id),
  asset_id        uuid references assets(id),
  span_days       smallint not null default 30,
  created_by      uuid references app_users(id),
  created_at      timestamptz not null default now()
);

create type calendar_item_status as enum ('idea','planned','in_production','published','skipped');

create table calendar_items (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references orgs(id) on delete cascade,
  calendar_id         uuid not null references calendars(id) on delete cascade,
  channel_id          uuid not null references channels(id) on delete cascade,
  title               text not null,
  angle               text,
  pillar              text,
  difficulty          text check (difficulty in ('easy','medium','hard')),
  scheduled_upload_at timestamptz,
  status              calendar_item_status not null default 'idea',
  spawned_video_id    uuid,                          -- FK added at end (circular)
  position            smallint,
  created_at          timestamptz not null default now()
);
create index calendar_items_calendar_pos_idx on calendar_items (calendar_id, position);

create table usage_events (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  video_id    uuid references videos(id) on delete cascade,
  provider_id text references providers(id),
  modality    modality,
  units       numeric(14,4) not null default 0,
  cost_cents  integer not null default 0,
  key_source  text not null check (key_source in ('byok','platform')),
  note        text,
  created_at  timestamptz not null default now()
);
create index usage_events_org_created_idx on usage_events (org_id, created_at desc);

create table jobs (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id) on delete cascade,
  video_id     uuid references videos(id) on delete cascade,
  execution_id uuid references state_executions(id) on delete cascade,
  queue        text not null,                  -- 'llm','image','voice','video','export'
  status       text not null default 'queued'
                 check (status in ('queued','active','completed','failed','retrying','canceled')),
  attempts     smallint not null default 0,
  max_attempts smallint not null default 3,
  scheduled_at timestamptz,
  last_error   text,
  created_at   timestamptz not null default now()
);
create index jobs_open_idx on jobs (status) where status in ('queued','active','retrying');

create table audit_log (                        -- append-only, service-role only (no RLS policy)
  id          bigserial primary key,
  org_id      uuid,
  actor_id    uuid,
  action      text not null,
  entity_type text,
  entity_id   uuid,
  meta        jsonb,
  at          timestamptz not null default now()
);
create index audit_log_org_at_idx on audit_log (org_id, at desc);
create index audit_log_entity_idx on audit_log (entity_type, entity_id);

-- ── circular FKs ─────────────────────────────────────────────────────────────
alter table videos
  add constraint videos_source_calendar_item_fk
  foreign key (source_calendar_item_id) references calendar_items(id) on delete set null;
alter table calendar_items
  add constraint calendar_items_spawned_video_fk
  foreign key (spawned_video_id) references videos(id) on delete set null;

-- ── updated_at triggers ──────────────────────────────────────────────────────
create trigger app_users_updated      before update on app_users      for each row execute function set_updated_at();
create trigger orgs_updated           before update on orgs           for each row execute function set_updated_at();
create trigger channels_updated       before update on channels       for each row execute function set_updated_at();
create trigger videos_updated         before update on videos         for each row execute function set_updated_at();
create trigger state_exec_updated     before update on state_executions for each row execute function set_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ════════════════════════════════════════════════════════════════════════════
-- Tenant tables: members of the row's org can read; editors+ can write.
-- (providers, pipeline_state_defs are global read-only; audit_log is service-role only.)

alter table app_users        enable row level security;
alter table orgs             enable row level security;
alter table memberships      enable row level security;
alter table api_keys         enable row level security;
alter table channels         enable row level security;
alter table videos           enable row level security;
alter table state_executions enable row level security;
alter table assets           enable row level security;
alter table transcripts      enable row level security;
alter table media_files      enable row level security;
alter table seo_packages     enable row level security;
alter table calendars        enable row level security;
alter table calendar_items   enable row level security;
alter table usage_events     enable row level security;
alter table jobs             enable row level security;
alter table audit_log        enable row level security;   -- enabled with NO policy => deny all to anon/auth

-- app_users: self only
create policy app_users_self on app_users
  using (id = auth.uid()) with check (id = auth.uid());

-- orgs: members read; only owner/admin update
create policy orgs_read on orgs for select using (is_org_member(id));
create policy orgs_write on orgs for update using (org_role(id) in ('owner','admin'))
  with check (org_role(id) in ('owner','admin'));

-- memberships: members read; owner/admin manage
create policy memberships_read on memberships for select using (is_org_member(org_id));
create policy memberships_manage on memberships for all
  using (org_role(org_id) in ('owner','admin'))
  with check (org_role(org_id) in ('owner','admin'));

-- Generic helper macro is not available; write explicit policies per tenant table.
-- Read = any member. Write = editor/admin/owner (viewer is read-only).

-- api_keys (admin/owner only — they hold secret pointers)
create policy api_keys_read on api_keys for select using (org_role(org_id) in ('owner','admin'));
create policy api_keys_write on api_keys for all
  using (org_role(org_id) in ('owner','admin')) with check (org_role(org_id) in ('owner','admin'));

-- channels
create policy channels_read on channels for select using (is_org_member(org_id));
create policy channels_write on channels for all
  using (org_role(org_id) in ('owner','admin','editor'))
  with check (org_role(org_id) in ('owner','admin','editor'));

-- videos
create policy videos_read on videos for select using (is_org_member(org_id));
create policy videos_write on videos for all
  using (org_role(org_id) in ('owner','admin','editor'))
  with check (org_role(org_id) in ('owner','admin','editor'));

-- state_executions
create policy state_exec_read on state_executions for select using (is_org_member(org_id));
create policy state_exec_write on state_executions for all
  using (org_role(org_id) in ('owner','admin','editor'))
  with check (org_role(org_id) in ('owner','admin','editor'));

-- assets
create policy assets_read on assets for select using (is_org_member(org_id));
create policy assets_write on assets for all
  using (org_role(org_id) in ('owner','admin','editor'))
  with check (org_role(org_id) in ('owner','admin','editor'));

-- transcripts
create policy transcripts_read on transcripts for select using (is_org_member(org_id));
create policy transcripts_write on transcripts for all
  using (org_role(org_id) in ('owner','admin','editor'))
  with check (org_role(org_id) in ('owner','admin','editor'));

-- media_files
create policy media_files_read on media_files for select using (is_org_member(org_id));
create policy media_files_write on media_files for all
  using (org_role(org_id) in ('owner','admin','editor'))
  with check (org_role(org_id) in ('owner','admin','editor'));

-- seo_packages
create policy seo_read on seo_packages for select using (is_org_member(org_id));
create policy seo_write on seo_packages for all
  using (org_role(org_id) in ('owner','admin','editor'))
  with check (org_role(org_id) in ('owner','admin','editor'));

-- calendars
create policy calendars_read on calendars for select using (is_org_member(org_id));
create policy calendars_write on calendars for all
  using (org_role(org_id) in ('owner','admin','editor'))
  with check (org_role(org_id) in ('owner','admin','editor'));

-- calendar_items
create policy calendar_items_read on calendar_items for select using (is_org_member(org_id));
create policy calendar_items_write on calendar_items for all
  using (org_role(org_id) in ('owner','admin','editor'))
  with check (org_role(org_id) in ('owner','admin','editor'));

-- usage_events (read-only for members; writes happen via service role in jobs)
create policy usage_events_read on usage_events for select using (is_org_member(org_id));

-- jobs (read-only for members; writes via service role)
create policy jobs_read on jobs for select using (is_org_member(org_id));

-- providers + pipeline_state_defs: global read for everyone (no RLS needed),
-- but expose read via grant since they are not tenant tables.
grant select on providers, pipeline_state_defs to anon, authenticated;
