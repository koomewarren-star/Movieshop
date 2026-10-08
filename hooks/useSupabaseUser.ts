'use client';

import { useEffect, useState } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { tryCreateClient } from '@/lib/supabase/client';

/**
 * Supabase session state for client components.
 *
 * `ready` distinguishes "definitely signed out" from "we have not asked yet".
 * Anything that gates on authentication must wait for it, otherwise a signed-in
 * viewer who clicks quickly on first paint gets bounced to the sign-in screen.
 *
 * Returns `user: null` and `ready: false` when Supabase is unconfigured, so
 * callers can choose their own fallback for that case.
 */
export function useSupabaseUser(): {
  user: User | null;
  ready: boolean;
  client: SupabaseClient | null;
} {
  const [user, setUser] = useState<User | null>(null);
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = tryCreateClient();
    if (!supabase) {
      // No Supabase: nothing will ever resolve a session, so do not leave
      // every caller waiting on `ready` forever.
      setReady(true);
      return;
    }
    setClient(supabase);

    let active = true;

    supabase.auth.getUser().then(({ data }: { data: { user: User | null } }) => {
      if (!active) return;
      setUser(data.user ?? null);
      setReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: { user: User } | null) => {
      setUser(session?.user ?? null);
      setReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return { user, ready, client };
}

export default useSupabaseUser;