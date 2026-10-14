-- Run later to allow changes only for signed-in coordinators (Supabase Auth users).
-- Then set NEXT_PUBLIC_REQUIRE_SIGN_IN=true in .env.local and Vercel, create coordinator accounts in
-- Authentication → Users, and turn off public sign-ups in Authentication → Sign In / Providers.
do $$
declare t text;
begin
  foreach t in array array['rooms', 'courses', 'students', 'allocations', 'change_log', 'meta'] loop
    execute format('drop policy if exists "anyone write" on public.%I', t);
    execute format('drop policy if exists "pin write" on public.%I', t);
    execute format('drop policy if exists "pin insert" on public.%I', t);
    execute format('drop policy if exists "pin update" on public.%I', t);
    execute format('drop policy if exists "pin delete" on public.%I', t);
    execute format('drop policy if exists "coordinators write" on public.%I', t);
    execute format(
      'create policy "coordinators write" on public.%I for all to authenticated using (true) with check (true)', t
    );
  end loop;
end $$;
