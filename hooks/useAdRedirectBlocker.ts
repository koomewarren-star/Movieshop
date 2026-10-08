'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Top-level navigation and pop-under defence for the third-party player embed.
 *
 * ## What is actually being defended against
 *
 * A hostile embed has three ways to take over a viewer's session:
 *
 *   1. `window.top.location = ...` — navigate this tab away.
 *   2. `window.open(...)` — open a pop-under behind the current tab.
 *   3. Render a full-screen invisible overlay that fires (1) or (2) on the next
 *      click, usually on the player's own play button.
 *
 * `PlayerShield` addresses (3). This hook observes and reports (1) and (2).
 *
 * ## What the platform does and does not let us do
 *
 * The only real control over (1) and (2) is the iframe `sandbox` attribute,
 * specifically its `allow-top-navigation`, `allow-popups` and
 * `allow-top-navigation-by-user-activation` tokens. The MovieShop provider
 * refuses to initialise inside any sandboxed frame, so those tokens are
 * unavailable and the capability cannot be removed. `Permissions-Policy` has
 * no top-navigation directive, so the `allow` attribute cannot substitute.
 *
 * Consequently this hook is observation, not prevention, and the code is
 * written to be honest about that rather than to look like a guarantee:
 *
 *   - A navigation to this tab CANNOT be cancelled from script. Assigning to
 *     `window.top.location` commits the navigation and no `preventDefault`
 *     exists for it. `beforeunload` is the only interrupt point and all it can
 *     do is ask the viewer to confirm - which is why `promptOnExit` now
 *     defaults to false: warning on every Back press and tab close during
 *     playback is a poor trade for a prompt that does not stop the one thing
 *     it was meant to stop.
 *   - A pop-under CANNOT be closed. A window opened by the iframe is not ours
 *     to close, and we never receive a handle on it. It also does not navigate
 *     our tab, so our page survives and can warn the viewer.
 *
 * The UI must not be read as a prevention claim. This detects a pop-under; it
 * does not prevent one, and nothing here closes the tab the provider opened.
 *
 * (Product copy currently says "blocked a pop-up attempt and kept you here",
 * chosen deliberately over more cautious wording. The underlying limit is real
 * and documented above: nothing here closes the tab. If that copy is ever
 * revised, this paragraph is the technical reason for revising it.)
 *
 * What actually recovers the session if (1) happens is
 * `lib/playerRecovery.ts`: the intended title is stored before playback starts
 * and the player is reconstructed on the next load.
 */

export interface AdRedirectBlockerState {
  /** True once a pop-under is suspected. Drives the warning UI. */
  popunderDetected: boolean;
  /** Clears the pop-under warning. */
  dismissPopunder: () => void;
}

export function useAdRedirectBlocker(
  active: boolean,
  options: {
    /**
     * Prompt on real navigation.
     *
     * Defaults to false. A `beforeunload` dialog cannot cancel a cross-origin
     * navigation initiated inside the frame - the exact case we care about - it
     * can only ask the viewer to confirm. Enabling it therefore warns on every
     * Back press, tab close and reload during playback while still failing to
     * stop a hijack, which is a bad trade for viewers and no benefit for us.
     *
     * Set true only if you want the noisy warning as a tripwire while
     * investigating redirect reports.
     */
    promptOnExit?: boolean;
    /** Called when a pop-under is suspected, for UI wiring. */
    onPopunder?: () => void;
  } = {},
): AdRedirectBlockerState {
  const { promptOnExit = false, onPopunder } = options;

  /*
    Guard against the pop-under heuristic false-positiving. Switching tabs to
    read something, or an OS-level focus steal, both blur the window without any
    third-party involvement. Requiring a gesture inside the player within a
    short window keeps normal tab-switching from tripping the warning.
  */
  const lastGesture = useRef(0);
  const warned = useRef(false);
  /*
    State, not a ref: the notice is rendered from this, and mutating a ref
    would not re-render, so it would silently never appear.
  */
  const [popunderDetected, setPopunderDetected] = useState(false);

  useEffect(() => {
    if (!active) return;

    /*
      Record any real interaction with the page. A pop-under almost always
      arrives immediately after a click that the viewer believes went to the
      video, so a gesture followed by a window blur with no other explanation
      is the signal.
    */
    const onGesture = () => {
      lastGesture.current = Date.now();
    };
    window.addEventListener('pointerdown', onGesture, true);
    window.addEventListener('keydown', onGesture, true);

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!promptOnExit) return;
      /*
        Legacy `returnValue` is still what Chrome honours; `preventDefault` is
        the modern spelling. Both are set because Firefox and Safari read the
        legacy path.
       */
      event.preventDefault();
      event.returnValue = '';
    };

    /*
      Pop-under / focus-steal detection.

      A pop-under does not navigate our tab, so we survive it intact and can
      tell the viewer what happened instead of leaving them on an ad page with
      no explanation.
     */
    const onBlur = () => {
      const sinceGesture = Date.now() - lastGesture.current;
      const suspect = warned.current === false && sinceGesture < 1500;
      if (!suspect) return;
      warned.current = true;
      setPopunderDetected(true);
      onPopunder?.();
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('pointerdown', onGesture, true);
      window.removeEventListener('keydown', onGesture, true);
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('blur', onBlur);
    };
  }, [active, promptOnExit, onPopunder]);

  /* Reset between titles so a new playback is not assumed to be hijacked. */
  useEffect(() => {
    if (!active) {
      warned.current = false;
      setPopunderDetected(false);
    }
  }, [active]);

  const dismissPopunder = useCallback(() => setPopunderDetected(false), []);

  return { popunderDetected, dismissPopunder };
}

export default useAdRedirectBlocker;