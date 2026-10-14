-- Make-Up Class Scheduler – shared timetable database
-- Run once in Supabase → SQL Editor. Safe to re-run.
--
-- Everyone can read. Changes need the edit PIN, which the app sends in the x-edit-pin header;
-- the database checks it on every write, so the PIN cannot be bypassed with the public key.
--
-- After running this file, set the PIN once (replace 0000):
--   insert into private.edit_pin (id, pin_hash) values (1, extensions.crypt('0000', extensions.gen_salt('bf')))
--   on conflict (id) do update set pin_hash = excluded.pin_hash;
--
-- To use coordinator accounts instead, run supabase/require-sign-in.sql
-- and set NEXT_PUBLIC_REQUIRE_SIGN_IN=true in the app's environment.

create extension if not exists pgcrypto with schema extensions;

-- Not exposed to the API: the PIN hash and failed attempts
create schema if not exists private;
revoke all on schema private from anon, authenticated;

create table if not exists private.edit_pin (
  id int primary key default 1 check (id = 1),
  pin_hash text not null
);

create table if not exists private.pin_failures (
  at timestamptz not null default now()
);

-- True when the request carries the correct PIN (used by the write policies)
create or replace function public.edit_pin_ok() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from private.edit_pin p
    where p.pin_hash = extensions.crypt(
      coalesce(current_setting('request.headers', true)::json ->> 'x-edit-pin', ''), p.pin_hash
    )
  );
$$;

-- Lets the app check a PIN before unlocking; slows guessing to 20 wrong tries per 15 minutes
create or replace function public.check_edit_pin(pin text) returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare ok boolean;
begin
  if (select count(*) from private.pin_failures where at > now() - interval '15 minutes') >= 20 then
    raise exception 'Too many wrong PINs. Try again in 15 minutes.';
  end if;
  select exists (
    select 1 from private.edit_pin p where p.pin_hash = extensions.crypt(pin, p.pin_hash)
  ) into ok;
  if not ok then
    insert into private.pin_failures default values;
  end if;
  return ok;
end $$;

revoke execute on function public.edit_pin_ok() from public;
revoke execute on function public.check_edit_pin(text) from public;
grant execute on function public.edit_pin_ok() to anon, authenticated;
grant execute on function public.check_edit_pin(text) to anon, authenticated;

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
    execute format('drop policy if exists "pin write" on public.%I', t);
    execute format(
      'create policy "pin write" on public.%I for all to anon, authenticated using (public.edit_pin_ok()) with check (public.edit_pin_ok())', t
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
