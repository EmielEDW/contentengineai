-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║ Phase 0 acceptance: cross-org isolation must be denied by RLS.              ║
-- ║ Run against a fresh DB after `supabase db reset`. Uses the SQL session GUCs  ║
-- ║ that Supabase sets per request (role=authenticated, request.jwt.claim.sub). ║
-- ╚════════════════════════════════════════════════════════════════════════════╝
begin;

-- Two users, two orgs.
insert into app_users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com');

insert into orgs (id, name, slug, owner_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Org A', 'org-a', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Org B', 'org-b', '22222222-2222-2222-2222-222222222222');

insert into memberships (org_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'owner');

insert into channels (id, org_id, onboarding_path, name) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'new', 'A channel'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'new', 'B channel');

-- Act as user A (authenticated role + their JWT sub).
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

-- Expect: exactly 1 row (only Org A's channel). If this returns 2, RLS is broken.
do $$
declare cnt int;
begin
  select count(*) into cnt from channels;
  if cnt <> 1 then
    raise exception 'RLS FAIL: user A sees % channels, expected 1', cnt;
  end if;
  raise notice 'RLS OK: user A sees exactly their own channel.';
end $$;

rollback;
