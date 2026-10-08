import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Refreshes the Supabase auth cookie on every matched request.
 *
 * Supabase access tokens are short-lived. Without this pass, a Server
 * Component rendering after expiry would call `auth.getUser()` with a stale
 * token, get back an unauthenticated result, and the viewer would appear
 * signed out mid-session — most visibly on the admin page.
 *
 * This runs on the edge, so it must stay small and dependency-free. It is the
 * only place that writes auth cookies outside the browser client.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Unconfigured deploy: pass through untouched rather than 500 on every page.
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  /*
   * `getUser()` revalidates against the auth server. `getSession()` would only
   * read the cookie and would happily trust a forged payload, which is exactly
   * the mistake that makes an "authenticated" route meaningless.
   */
  await supabase.auth.getUser();

  return response;
}