'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, LogOut, User } from 'lucide-react';
import { tryCreateClient } from '@/lib/supabase/client';
import { useSupabaseUser } from '@/hooks/useSupabaseUser';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * NEXT_PUBLIC_* values are inlined at build time, so this is known during the
 * first render rather than having to be discovered in an effect.
 */
const SUPABASE_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

/**
 * Navbar account control.
 *
 * Renders the Sign In link immediately and swaps it for the account badge once
 * the session resolves. It deliberately does NOT wait on `getUser()` before
 * rendering anything: that is a network round trip to the Supabase auth server,
 * and gating the render on it meant the control was absent for the whole of
 * that round trip, and never appeared at all if the call failed or hung.
 *
 * Renders nothing when Supabase is unconfigured, so a deploy without the env
 * vars keeps the header it has today rather than showing a dead button.
 */
export default function AuthButton() {
  const router = useRouter();
  const { user } = useSupabaseUser();
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setClient(tryCreateClient());
  }, []);

  if (!SUPABASE_CONFIGURED) return null;

  const signOut = async () => {
    if (!client) return;
    setBusy(true);
    try {
      await client.auth.signOut();
      router.push('/');
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-white/80 transition-all duration-300 hover:border-crimson/50 hover:bg-crimson/10 hover:text-white"
      >
        <User className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Sign In</span>
      </Link>
    );
  }

  /*
    Signed-in state.

    The green pill is the account's "you are in" indicator, and it occupies
    the slot the old subscription pill used to sit in, so the header keeps the
    same balance. The label is the first thing to hide on narrow viewports
    because the sign-out button is the part that must stay reachable - a viewer
    who cannot get signed out on a phone has a real problem.
  */

  /*
    `user_metadata.avatar_url` is only populated when the identity provider
    supplies a picture. Email sign-up does not, so the initial-based badge
    below is the normal case rather than a fallback for something broken.
  */
  const avatar = typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : null;

  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-emerald-300 shadow-[0_0_20px_-6px_rgba(16,185,129,0.7)]">
        <Check className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Signed In</span>
      </span>

      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar}
          alt=""
          className="hidden h-8 w-8 shrink-0 rounded-full border border-white/15 object-cover lg:block"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span
          aria-hidden="true"
          className="hidden h-8 w-8 shrink-0 place-items-center rounded-full bg-crimson/20 text-[11px] font-black uppercase text-crimson-bright ring-1 ring-inset ring-crimson/40 lg:grid"
        >
          {(user.email ?? '?').charAt(0)}
        </span>
      )}

      <span
        title={user.email ?? undefined}
        className="hidden max-w-[14rem] truncate text-xs font-semibold text-white/65 xl:inline"
      >
        {user.email}
      </span>

      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        aria-label="Sign out"
        title="Sign out"
        className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-white/80 transition-colors hover:border-crimson hover:bg-crimson/15 hover:text-white disabled:opacity-50"
      >
        <LogOut className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Sign Out</span>
      </button>
    </div>
  );
}