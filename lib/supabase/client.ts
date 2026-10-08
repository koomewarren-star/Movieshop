import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase client for Client Components.
 *
 * The URL and anon key are `NEXT_PUBLIC_*`, so they are inlined into the
 * browser bundle. That is expected and safe for Supabase: the anon key is a
 * public identifier, and access is enforced by Row Level Security on the
 * database, not by hiding this value. Never put the service_role key in
 * anything that reaches the browser — that one bypasses RLS entirely.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    /*
     * Throwing here would white-screen the whole app whenever the env is
     * missing, which is a hostile failure on a deploy that has not been
     * configured yet. A typed null lets callers degrade instead.
     */
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. See .env.example.',
    );
  }

  return createBrowserClient(url, anonKey);
}

/**
 * Returns a client, or null when Supabase is not configured.
 *
 * Used by components that must keep working on an unconfigured deploy — the
 * navbar session badge, for instance, which should simply hide itself rather
 * than take the header down with it.
 */
export function tryCreateClient(): ReturnType<typeof createBrowserClient> | null {
  try {
    return createClient();
  } catch {
    return null;
  }
}