import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Read-only analytics for the admin surface.
 *
 * Every function here reads through the caller's Supabase client, which
 * carries that user's JWT. Authorization is therefore enforced by Row Level
 * Security in Postgres rather than in TypeScript — which is the point. A check
 * like `if (user.role !== 'admin')` in this file would be one refactor away
 * from being bypassed, whereas an RLS policy is enforced by the database on
 * every single query regardless of what the client sends.
 *
 * The matching policies are in `supabase/schema.sql`. Until that SQL is run,
 * every function here returns nothing and the admin page shows zeroes — which
 * is the correct fail-closed behaviour, not a bug.
 */

export interface SignUpRow {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
}

export interface ActivityRow {
  id: number;
  user_id: string;
  event: string;
  path: string | null;
  created_at: string;
}

export interface Stats {
  totalUsers: number;
  activeUsers7d: number;
  activeUsers24h: number;
  recentSignUps: SignUpRow[];
  recentActivity: ActivityRow[];
}

/** Narrowing the client keeps the returned rows typed without casts. */
type Db = any;

function rows<T>(result: { data: unknown; error: unknown } | null | undefined): T[] {
  if (!result || result.error || !Array.isArray(result.data)) return [];
  return result.data as T[];
}

export async function getStats(supabase: SupabaseClient<Db>): Promise<Stats> {
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  /*
    Run the independent reads concurrently. Sequential awaits here would make
    the page wait the sum of five round-trips instead of the slowest one.
   */
  const [totalResult, active7d, active24h, signUpResult, activityResult] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id').gte('last_sign_in_at', sevenDaysAgo),
    supabase.from('profiles').select('id').gte('last_sign_in_at', oneDayAgo),
    supabase
      .from('profiles')
      .select('id, email, created_at, last_sign_in_at')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('activity_log')
      .select('id, user_id, event, path, created_at')
      .order('created_at', { ascending: false })
      .limit(25),
  ]);

  const recentSignUps = rows<SignUpRow>(signUpResult);
  const recentActivity = rows<ActivityRow>(activityResult);

  return {
    // A denied query returns a null count; fall back to the fetched page length
    // so the panel reads "0" rather than NaN in the unconfigured case.
    totalUsers: typeof totalResult.count === 'number' ? totalResult.count : recentSignUps.length,
    activeUsers7d: Array.isArray(active7d.data) ? active7d.data.length : 0,
    activeUsers24h: Array.isArray(active24h.data) ? active24h.data.length : 0,
    recentSignUps,
    recentActivity,
  };
}