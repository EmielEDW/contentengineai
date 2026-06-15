-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║ Auth bootstrap: every new Supabase auth user gets an app_users profile, a    ║
-- ║ personal org, and an owner membership — automatically, via a trigger on      ║
-- ║ auth.users. This makes the app multi-tenant-ready with zero app-side glue.   ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

create or replace function handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  new_org uuid;
  uname   text := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
begin
  insert into app_users (id, email, display_name)
  values (new.id, new.email, uname)
  on conflict (id) do nothing;

  insert into orgs (name, slug, owner_id)
  values (uname || '''s workspace', 'org-' || substr(replace(new.id::text, '-', ''), 1, 12), new.id)
  returning id into new_org;

  insert into memberships (org_id, user_id, role, status)
  values (new_org, new.id, 'owner', 'active');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
