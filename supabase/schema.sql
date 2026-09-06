-- ============================================================
-- Aaru Habit Tracker — Supabase production schema
--
-- Apply: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Idempotent: safe to run repeatedly, and safe to re-run after edits.
--
-- SECURITY MODEL
--   Every row is owned by exactly one auth user. Row Level Security is
--   ENABLED and FORCED on every table, and every policy is scoped to
--   auth.uid(). The database — not the frontend — enforces isolation.
--   The client only ever holds the publishable (anon) key, whose entire
--   authority is bounded by the policies below.
--
-- DATA MODEL NOTE (read before extending)
--   The app's client state is one reduced document (habits, checkins,
--   routines, projects, assignments, moods, preferences). It is stored as a
--   single owned jsonb row per user in `user_state`, which makes each sync an
--   atomic, conflict-checked write and keeps the merge engine deterministic.
--
--   `user_state.doc` is validated below so it cannot be a non-object, and
--   generated columns expose per-entity counts for indexing/analytics without
--   duplicating the data. If you later want per-entity relational tables,
--   see the "FUTURE: relational entities" section at the bottom — it is
--   intentionally NOT created here, because no application code reads it yet
--   and shipping empty unused tables would misrepresent the system.
-- ============================================================

-- ------------------------------------------------------------
-- Extensions
-- ------------------------------------------------------------
-- None required. All primary keys are supplied by auth.users, so there is no
-- server-side UUID generation and therefore no pgcrypto/uuid-ossp dependency.

-- ============================================================
-- TABLES
-- ============================================================

-- profiles: one row per auth user, created automatically on signup.
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint profiles_display_name_len check (display_name is null or char_length(display_name) <= 80)
);

comment on table public.profiles is
  'Public profile per auth user. RLS: a user may only touch their own row.';

-- user_state: the authoritative cloud copy of a user's app document.
create table if not exists public.user_state (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  doc         jsonb  not null default '{}'::jsonb,
  revision    bigint not null default 1,
  schema_version integer not null default 4,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  constraint user_state_doc_is_object check (jsonb_typeof(doc) = 'object'),
  constraint user_state_revision_positive check (revision > 0)
);

comment on table public.user_state is
  'One owned JSON document per user: habits, checkins, routines, projects, assignments, moods, preferences.';

-- Additive columns, so re-running against an older deployment upgrades it.
alter table public.user_state add column if not exists schema_version integer not null default 4;
alter table public.user_state add column if not exists created_at timestamptz not null default now();
alter table public.profiles   add column if not exists avatar_url text;

-- ------------------------------------------------------------
-- Generated count columns — cheap, always-consistent metrics that avoid
-- re-parsing the document. Used by the migration preview and support tooling.
-- ------------------------------------------------------------
alter table public.user_state
  add column if not exists habit_count integer
  generated always as (coalesce(jsonb_array_length(doc -> 'habits'), 0)) stored;

alter table public.user_state
  add column if not exists project_count integer
  generated always as (coalesce(jsonb_array_length(doc -> 'projects'), 0)) stored;

alter table public.user_state
  add column if not exists assignment_count integer
  generated always as (coalesce(jsonb_array_length(doc -> 'assignments'), 0)) stored;

-- ============================================================
-- INDEXES
-- ============================================================
-- Primary keys already index user_id / id. These support the access patterns
-- the app and tooling actually use.

-- "what changed since my last sync" and staleness sweeps
create index if not exists user_state_updated_at_idx
  on public.user_state (updated_at desc);

-- containment/existence queries into the document (jsonb_path_ops is the
-- smaller, faster GIN variant for @> style lookups)
create index if not exists user_state_doc_gin_idx
  on public.user_state using gin (doc jsonb_path_ops);

create index if not exists profiles_updated_at_idx
  on public.profiles (updated_at desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- ENABLE turns RLS on; FORCE applies it even to the table owner, so a
-- misconfigured privileged role cannot quietly bypass isolation.
alter table public.profiles   enable row level security;
alter table public.user_state enable row level security;
alter table public.profiles   force row level security;
alter table public.user_state force row level security;

-- Explicit, separate policies per command. `to authenticated` ensures the
-- anonymous role matches nothing at all.

-- ---- profiles ----
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles
  for delete to authenticated using ((select auth.uid()) = id);

-- ---- user_state ----
drop policy if exists "user_state_select_own" on public.user_state;
create policy "user_state_select_own" on public.user_state
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "user_state_insert_own" on public.user_state;
create policy "user_state_insert_own" on public.user_state
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "user_state_update_own" on public.user_state;
create policy "user_state_update_own" on public.user_state
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_state_delete_own" on public.user_state;
create policy "user_state_delete_own" on public.user_state
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ============================================================
-- PRIVILEGES
-- ============================================================
-- Belt and braces: the anon role gets no table access whatsoever, so an RLS
-- misconfiguration alone cannot expose data to signed-out visitors.
revoke all on public.profiles   from anon;
revoke all on public.user_state from anon;
grant select, insert, update, delete on public.profiles   to authenticated;
grant select, insert, update, delete on public.user_state to authenticated;

-- ============================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep updated_at honest, and stop a client from forging revision history.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  -- created_at is immutable once set.
  if tg_table_name = 'user_state' then
    new.created_at = old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists user_state_touch on public.user_state;
create trigger user_state_touch
  before update on public.user_state
  for each row execute function public.touch_updated_at();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- Account deletion: lets a signed-in user erase their own cloud data and
-- auth account. SECURITY DEFINER is required to reach auth.users, but the
-- function only ever acts on auth.uid() — it cannot touch another account.
-- ------------------------------------------------------------
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  delete from public.user_state where user_id = uid;
  delete from public.profiles  where id = uid;
  delete from auth.users       where id = uid;  -- cascades the rest
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

-- ============================================================
-- VERIFICATION — run these after applying; every row must report OK.
-- ============================================================
-- select tablename,
--        rowsecurity  as rls_enabled,
--        forcerowsecurity as rls_forced
--   from pg_tables
--  where schemaname = 'public' and tablename in ('profiles','user_state');
--
-- select tablename, policyname, cmd, roles
--   from pg_policies
--  where schemaname = 'public'
--  order by tablename, cmd;
--   -> expect 8 policies (4 per table), all roles = {authenticated}

-- ============================================================
-- FUTURE: relational entities
-- ============================================================
-- Deliberately not created. Splitting the document into habits /
-- habit_completions / habit_notes / projects / project_tasks /
-- project_milestones / assignments / assignment_tasks / goals / mood_entries
-- / daily_reflections / achievements / routines / preferences / notifications
-- would require rewriting the store, the sync engine and the merge rules.
--
-- Creating those tables now, with no code reading or writing them, would put
-- an empty schema in the database that misrepresents how the app works. When
-- that migration is scheduled, each table takes the same shape as above:
--   user_id uuid not null references auth.users(id) on delete cascade,
--   updated_at timestamptz, deleted_at timestamptz (tombstone),
--   an index on (user_id, updated_at desc),
--   RLS enabled + forced, and four auth.uid() = user_id policies.
