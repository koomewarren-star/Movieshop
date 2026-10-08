'use client';

import { useEffect } from 'react';
import { tryCreateClient } from '@/lib/supabase/client';

/**
 * Appends a row to the activity log after each route change.
 *
 * Fire-and-forget by design. An analytics write must never block navigation or
 * surface an error to a viewer, so failures are swallowed here and the query
 * is skipped entirely when nobody is signed in — an insert would violate the
 * RLS policy and cost a pointless round trip per page view.
 */
export default function ActivityTracker() {
  useEffect(() => {
    const supabase = tryCreateClient();
    if (!supabase) return;

    let cancelled = false;

    const track = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      try {
        await supabase.from('activity_log').insert({
          user_id: user.id,
          event: 'page_view',
          path: window.location.pathname,
        });
      } catch {
        /* analytics must never surface to the viewer */
      }
    };

    void track();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}