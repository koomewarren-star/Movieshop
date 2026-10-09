'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Screen Wake Lock, for keeping the device awake during playback.
 *
 * The lock is released automatically by the browser whenever the page becomes
 * hidden, so holding the sentinel alone is not enough - it has to be
 * re-acquired on every return to visibility. That is the part most
 * implementations get wrong, and the symptom is a screen that sleeps anyway
 * after the viewer switches tabs once.
 *
 * Requires a secure context. `localhost` counts as secure, so this works in
 * development, but a plain-HTTP LAN address does not - the capability reports
 * unsupported and the control is hidden rather than shown dead.
 *
 * Nothing here touches the video or the embed. It is a device-level request
 * made by this document about its own visibility, which is why it works at all
 * when the player is a cross-origin frame we cannot otherwise influence.
 */

/*
 * `navigator.wakeLock` is absent from the DOM lib in this TypeScript version,
 * so it is declared locally rather than cast at each call site. Same approach
 * as the non-standard ScreenOrientation.lock handled in NexstreamPlayer.
 */
interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
  removeEventListener: (type: 'release', listener: () => void) => void;
}

interface WakeLockLike {
  request: (type: 'screen') => Promise<WakeLockSentinelLike>;
}

function getWakeLock(): WakeLockLike | null {
  if (typeof navigator === 'undefined') return null;
  return (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock ?? null;
}

export interface UseScreenWakeLockResult {
  /** True while a screen lock is held. */
  active: boolean;
  /** False when the browser or context cannot support it at all. */
  supported: boolean;
  /** Requests the lock, or releases it if already held. */
  toggle: () => Promise<void>;
}

export function useScreenWakeLock(playerOpen: boolean): UseScreenWakeLockResult {
  const [active, setActive] = useState(false);
  const [supported, setSupported] = useState(false);
  const sentinel = useRef<WakeLockSentinelLike | null>(null);
  /*
    Mirrors `active` in a ref so the visibility handler can read the viewer's
    intent without being re-created on every state change.
   */
  const wanted = useRef(false);

  const release = useCallback(async () => {
    const current = sentinel.current;
    sentinel.current = null;
    if (!current) return;
    try {
      await current.release();
    } catch {
      /* already released, or the document went away mid-release */
    }
    setActive(false);
  }, []);

  const acquire = useCallback(async () => {
    const wakeLock = getWakeLock();
    if (!wakeLock) {
      setSupported(false);
      return;
    }
    setSupported(true);
    if (sentinel.current && !sentinel.current.released) return;

    try {
      const lock = await wakeLock.request('screen');
      sentinel.current = lock;
      setActive(true);
      lock.addEventListener('release', () => {
        // The browser dropped it (usually because the tab was hidden). Clear
        // local state so the control reflects reality rather than a stale lock.
        sentinel.current = null;
        setActive(false);
      });
    } catch {
      /*
        Denied when the document is not visible or not focused enough. Not
        worth surfacing: the viewer simply did not get the lock, and playback
        is unaffected. The control reflects the real state either way.
       */
      setActive(false);
    }
  }, []);

  const toggle = useCallback(async () => {
    wanted.current = !wanted.current;
    if (wanted.current) {
      await acquire();
    } else {
      await release();
    }
  }, [acquire, release]);

  useEffect(() => {
    setSupported(getWakeLock() !== null);
  }, []);

  /*
    Re-acquire on return to visibility.

    The browser releases the lock whenever the document is hidden, so without
    this the control would silently stop working after the viewer checks
    another app mid-film.
   */
  useEffect(() => {
    if (!active) return;

    const onVisibility = async () => {
      if (document.visibilityState === 'visible' && wanted.current) {
        await acquire();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [active, acquire]);

  /*
    Release when the player closes, and on unmount.

    A held screen lock keeps the display on for an app nobody is watching, so
    it must not outlive the player. Tying this to `active` also means the lock
    is requested while playing and released when the viewer closes the modal,
    with no separate teardown to forget.
   */
  useEffect(() => {
    if (playerOpen) return;
    wanted.current = false;
    void release();
    return () => {
      void release();
    };
  }, [playerOpen, release]);

  return { active, supported, toggle };
}

export default useScreenWakeLock;