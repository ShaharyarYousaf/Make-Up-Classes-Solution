import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Edit PIN sent with every request; the database only accepts writes that carry the right one */
let editPin: string | null = null;
export const setEditPin = (pin: string | null) => {
  editPin = pin;
};

const fetchWithPin: typeof fetch = (input, init) => {
  if (!editPin) return fetch(input, init);
  const headers = new Headers(init?.headers);
  headers.set('x-edit-pin', editPin);
  return fetch(input, { ...init, headers });
};

/** Without Supabase settings the app runs in local mode: bundled data, changes kept in this browser only. */
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key, { global: { fetch: fetchWithPin } }) : null;

/** Coordinator accounts instead of the shared PIN (for when the system matures). */
export const REQUIRE_SIGN_IN = process.env.NEXT_PUBLIC_REQUIRE_SIGN_IN === 'true';
