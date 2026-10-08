import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Supabase SSR auth token refresh.
 *
 * This runs on every matched request, which means a throw here does not fail
 * one route - it fails routing for the whole deployment, and Vercel surfaces
 * it as `500 MIDDLEWARE_INVOCATION_FAILED` on every page including static-ish
 * ones. So nothing in here is allowed to reject.
 *
 * Three guards, each covering a distinct real failure:
 *
 *   1. Missing env vars. The edge runtime can invoke this before the project
 *      variables resolve, and `createServerClient` throws on undefined input.
 *   2. A throwing or slow `getUser()`. It is a live network call to the
 *      Supabase auth server from the edge; DNS failure, a cold region or a
 *      rate-limit all reject. This is the one that actually takes a deploy
 *      down in practice.
 *   3. Anything else unforeseen, caught by the outermost catch.
 *
 * The tradeoff is deliberate: if the refresh fails we return a pass-through
 * response and the request continues unauthenticated. Server components may
 * then read a stale session for that one request. That is far better than the
 * alternative, which is a site that returns 500 to every visitor because an
 * auth server was briefly unreachable.
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    })

    // Revalidates the token against the auth server. getSession() would only
    // read the cookie and would trust a forged payload.
    await supabase.auth.getUser()
  } catch (error) {
    // Never let auth break routing. Log and continue unauthenticated.
    console.error('[supabase-middleware] token refresh failed, continuing unauthenticated:', error)
    return NextResponse.next({ request })
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
      Static assets and image optimisation are excluded so the middleware is
      not invoked per icon request. `manifest.webmanifest` and `sw.js` are
      deliberately still matched: the service worker is fetched on every load
      and must not be served from a stale cache.
    */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}