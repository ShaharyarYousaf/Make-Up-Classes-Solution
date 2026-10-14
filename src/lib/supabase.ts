import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Without Supabase settings the app runs in local mode: bundled data, changes kept in this browser only. */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
