import { createClient } from '@/lib/supabase/server';
import { getStats } from '@/lib/analytics';
import { NextResponse } from 'next/server';

/**
 * Admin stats endpoint.
 *
 * Read-only JSON for the admin dashboard. The route deliberately contains no
 * role check of its own: it forwards the caller's JWT to Postgres and lets the
 * RLS policies in `supabase/schema.sql` decide. Adding a `role` comparison
 * here would create a second, weaker authorization path to keep in sync.
 *
 * Without that SQL applied the policies deny everything and this returns
 * zeroes rather than leaking rows.
 */
export async function GET() {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json(
      { error: 'Supabase is not configured on this deployment.' },
      { status: 503 },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const stats = await getStats(supabase);

  return NextResponse.json(stats, {
    headers: { 'Cache-Control': 'no-store' },
  });
}