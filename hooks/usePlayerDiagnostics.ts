'use client';

import { useEffect } from 'react';

/**
 * Development-only diagnostics for player navigation failures.
 *
 * The upstream embed can navigate the top-level tab or open a pop-under, and
 * neither event is observable from this side once it happens. What IS
 * observable is our own lifecycle: when the frame loads, when the page is
 * shown or hidden, when it is being torn down, and when we reinitialise after
 * a failure. Correlating those timestamps with a viewer's report of "it sent
 * me to an ad site" is the only practical way to narrow down what happened.
 *
 * Every value logged here is either a lifecycle event name or a coarse
 * duration. Deliberately never logged: Turnstile tokens, cookies, session or
 * auth material, email addresses, the viewer's watch history, or any URL the
 * provider put in the frame. Hostnames of third-party frames are not logged
 * either, since the embed URL is already in the repo.
 */

const ENABLED = process.env.NODE_ENV !== 'production';

function log(event: string, detail?: Record<string, string | number | boolean | null>) {
  if (!ENABLED) return;
  // eslint-disable-next-line no-console
  console.debug(`[player] ${event}`, detail ?? {});
}

/** Logs a navigation-relevant event. Exported so call sites need not check env. */
export function playerEvent(event: string, detail?: Record<string, string | number | boolean | null>) {
  log(event, detail);
}

export interface PlayerDiagnosticsOptions {
  /** True while the player modal is open. */
  active: boolean;
  /** Set when we force a reload of our own player state. */
  recoveryNonce: number;
}

/**
 * Page-level lifecycle events.
 *
 * `pagehide` is used rather than `beforeunload` because it fires on both normal
 * unloads and bfcache navigations, which is what actually distinguishes "the
 * viewer pressed Back" from "something navigated us away". No handler here can
 * cancel a navigation; these are observers only.
 */
export function usePlayerDiagnostics({ active, recoveryNonce }: PlayerDiagnosticsOptions) {
  useEffect(() => {
    if (!ENABLED) return;

    log('app mounted', { active, recoveryNonce });

    const onPageShow = () => log('pageshow', { persisted: false, active });
    // pageshow carries `persisted`, which is true when restored from bfcache.
    const onPageShowEvt = (event: PageTransitionEvent) =>
      log('pageshow', { persisted: event.persisted, active });

    const onVisibility = () => log('visibilitychange', { state: document.visibilityState, active });

    const onPageHide = () => log('pagehide', { active });

    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('pageshow', onPageShowEvt as EventListener);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('pageshow', onPageShowEvt as EventListener);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [active, recoveryNonce]);
}

export default usePlayerDiagnostics;