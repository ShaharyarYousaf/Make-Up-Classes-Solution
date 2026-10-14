-- Make-Up Class Scheduler – shared timetable database
-- Run once in Supabase → SQL Editor. Safe to re-run.
--
-- OPEN MODE (current): anyone with the app can read and change the timetable.
-- To restrict changes to signed-in coordinators later, run supabase/require-sign-in.sql
-- and set NEXT_PUBLIC_REQUIRE_SIGN_IN=true in the app's environment.

-- Each record is stored as the app's own JSON shape, keyed by its id.
create table if not exists public.rooms (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.allocations (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

-- Who changed which class, from what to what
create table if not exists public.change_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  user_email text default (auth.jwt() ->> 'email'),
  action text not null,
  allocation_id text,
  before jsonb,
  after jsonb
);

-- Dataset version: bumped on every full import so open browsers reload everything
create table if not exists public.meta (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['rooms', 'courses', 'students', 'allocations', 'change_log', 'meta'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "public read" on public.%I', t);
    execute format('create policy "public read" on public.%I for select to anon, authenticated using (true)', t);
    execute format('drop policy if exists "coordinators write" on public.%I', t);
    execute format('drop policy if exists "anyone write" on public.%I', t);
    execute format(
      'create policy "anyone write" on public.%I for all to anon, authenticated using (true) with check (true)', t
    );
  end loop;
end $$;

-- Live updates for reschedules and dataset replacements
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'allocations'
  ) then
    alter publication supabase_realtime add table public.allocations;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'meta'
  ) then
    alter publication supabase_realtime add table public.meta;
  end if;
end $$;
