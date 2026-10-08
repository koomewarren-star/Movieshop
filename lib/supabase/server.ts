import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Supabase client for Server Components, Route Handlers and Server Actions.
 *
 * Reads and writes the auth cookie through `cookies()`, which is what lets a
 * server component see the viewer's session. `setAll` is required even though
 * a Server Component cannot itself mutate cookies: Next runs this during the
 * render pass, and on a refresh Supabase may rotate the token, which has to be
 * persisted or the next request would see a stale session.
 */
export async function createClient() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. See .env.example.',
    );
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          /*
           * Thrown when called from a Server Component, which is not allowed
           * to set cookies. Harmless here: the session is already in the
           * cookie jar, and a middleware refresh handles persistence.
           */
        }
      },
    },
  });
}