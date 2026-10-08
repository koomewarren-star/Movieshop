import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, BarChart3, Clock, LogIn, TrendingUp, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getStats } from '@/lib/analytics';
import AuthCard from '@/components/AuthCard';

export const dynamic = 'force-dynamic';

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
      <div className="mb-2 flex items-center gap-2 text-white/40">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-2xl font-black tabular-nums text-white">{value.toLocaleString()}</p>
    </div>
  );
}

function when(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export default async function AdminStatsPage() {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch {
    return (
      <AuthCard>
        <h1 className="text-xl font-black uppercase tracking-tight text-white">Not configured</h1>
        <p className="mt-3 text-sm text-white/50">
          Add <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
          <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable this page.
        </p>
        <Link href="/" className="mt-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-crimson-bright hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to browsing
        </Link>
      </AuthCard>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Unauthenticated viewers are sent to sign in rather than shown an empty shell.
  if (!user) redirect('/login');

  const stats = await getStats(supabase);
  const allZero = stats.totalUsers === 0 && stats.recentSignUps.length === 0;

  return (
    <main className="min-h-svh bg-obsidian px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-white">
              Movie<span className="text-crimson-bright">Shop</span> Stats
            </h1>
            <p className="mt-1 text-sm text-white/45">Signed in as {user.email}</p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/45 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to browsing
          </Link>
        </div>

        {allZero && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            No data yet. Run <code className="font-mono">supabase/schema.sql</code> in the Supabase
            SQL editor — the <code className="font-mono">profiles</code> and{' '}
            <code className="font-mono">activity_log</code> tables and their Row Level Security
            policies are what make these queries return anything.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat icon={<Users className="h-3.5 w-3.5" />} label="Registered users" value={stats.totalUsers} />
          <Stat icon={<TrendingUp className="h-3.5 w-3.5" />} label="Active · 7 days" value={stats.activeUsers7d} />
          <Stat icon={<Clock className="h-3.5 w-3.5" />} label="Active · 24 hours" value={stats.activeUsers24h} />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-charcoal/50 p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-white/70">
              <LogIn className="h-4 w-4 text-crimson-bright" />
              Latest sign-ups
            </h2>
            {stats.recentSignUps.length === 0 ? (
              <p className="text-sm text-white/40">No sign-ups recorded yet.</p>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {stats.recentSignUps.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0 truncate text-white/80">{row.email ?? '—'}</span>
                    <span className="shrink-0 text-xs tabular-nums text-white/35">{when(row.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-charcoal/50 p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-white/70">
              <BarChart3 className="h-4 w-4 text-crimson-bright" />
              Recent activity
            </h2>
            {stats.recentActivity.length === 0 ? (
              <p className="text-sm text-white/40">No activity recorded yet.</p>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {stats.recentActivity.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0 truncate text-white/70">
                      <span className="font-semibold text-white/85">{row.event}</span>
                      {row.path && <span className="ml-2 text-white/35">{row.path}</span>}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-white/35">{when(row.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}