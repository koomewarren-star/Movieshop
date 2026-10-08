'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, User } from 'lucide-react';
import { tryCreateClient } from '@/lib/supabase/client';
import type { SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';

/**
 * Navbar account control.
 *
 * Renders nothing at all when Supabase is unconfigured, so an unconfigured
 * deploy keeps the header it has today instead of showing a dead "Sign In"
 * button that cannot work.
 */
export default function AuthButton() {
  const router = useRouter();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const clientRef = useRef<SupabaseClient | null>(null);

  useEffect(() => {
    const supabase = tryCreateClient();
    clientRef.current = supabase;
    if (!supabase) return;

    let active = true;

    supabase.auth.getUser().then(({ data }: { data: { user: SupabaseUser | null } }) => {
      if (!active) return;
      setUser(data.user ?? null);
      setReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: { user: SupabaseUser } | null) => {
      setUser(session?.user ?? null);
      setReady(true);
      /*
       * Sign-in and sign-out both change server-rendered output (the admin
       * page, any future gated route). `refresh()` re-runs the server
       * components so the cookie-backed session is picked up immediately
       * rather than on the next full navigation.
       */
      router.refresh();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  if (!ready || !clientRef.current) return null;

  const signOut = async () => {
    const supabase = clientRef.current;
    if (!supabase) return;
    setBusy(true);
    try {
      await supabase.auth.signOut();
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
    `user_metadata.avatar_url` is only populated when the provider supplies a
    picture. Email sign-up does not, so the initial-based badge below is the
    normal case rather than a fallback for something broken.
  */
  const avatar = typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : null;

  return (
    <div className="flex shrink-0 items-center gap-2">
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar}
          alt=""
          className="h-8 w-8 shrink-0 rounded-full border border-white/15 object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span
          aria-hidden="true"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-crimson/20 text-[11px] font-black uppercase text-crimson-bright ring-1 ring-inset ring-crimson/40"
        >
          {(user.email ?? '?').charAt(0)}
        </span>
      )}

      <span
        title={user.email ?? undefined}
        className="hidden max-w-[14rem] truncate text-xs font-semibold text-white/65 md:inline"
      >
        {user.email}
      </span>

      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        aria-label="Sign out"
        title="Sign out"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 text-white/70 transition-colors hover:border-crimson hover:bg-crimson/20 hover:text-white disabled:opacity-50"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}