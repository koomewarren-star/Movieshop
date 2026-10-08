'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * Short-lived click shield for the third-party embed.
 *
 * ## What it is for
 *
 * Pop-under providers do not fire on page load. They arm a listener on the
 * first trusted click inside the frame, then use that gesture to call
 * `window.open` and navigate the opener. The viewer is usually clicking the
 * provider's own play button when it happens, which is why it presents as
 * "pressing a button kicks me off the page".
 *
 * ## Why it is deliberately weak
 *
 * This shield eats gestures, and gestures are what a human-verification
 * challenge needs. The upstream provider currently serves an *invisible*
 * Cloudflare Turnstile challenge, which self-solves without interaction, so
 * swallowing a click costs nothing today. If that ever changes to an
 * interactive challenge, a click swallowed here would leave every viewer
 * staring at a black frame with no way past it.
 *
 * Breaking playback is worse than tolerating a pop-under, so this is built to
 * fail in the safe direction. Three properties guarantee it cannot lock the
 * player:
 *
 *   1. It absorbs at most ONE gesture, then unmounts.
 *   2. It auto-disarms on a hard timer (`maxArmedMs`) regardless of whether a
 *      click ever arrives, so an untouched shield cannot linger.
 *   3. Any keypress that could be a remote-control "OK" disarms it immediately
 *      at the window level, before the event can be swallowed.
 *
 * It is absolutely positioned inside the existing video surface, so it adds no
 * layout, no dimensions and no styling. Once disarmed it is removed from the
 * tree entirely and the provider's own controls work normally.
 *
 * Nothing here opens a window, so disarming cannot itself trigger a popup.
 */

/** Hard ceiling on how long the shield can intercept input. */
const MAX_ARMED_MS = 2500;

interface PlayerShieldProps {
  /** Disarms the shield, e.g. once the embed reports it has loaded. */
  disabled?: boolean;
  /** Hard timeout override, mainly for tests. */
  maxArmedMs?: number;
  onDisarm?: (reason: 'click' | 'timeout' | 'key' | 'disabled') => void;
}

export default function PlayerShield({
  disabled = false,
  maxArmedMs = MAX_ARMED_MS,
  onDisarm,
}: PlayerShieldProps) {
  const [armed, setArmed] = useState(true);
  const frame = useRef<number | null>(null);
  const fired = useRef(false);

  const disarm = useCallback(
    (reason: 'click' | 'timeout' | 'key' | 'disabled') => {
      if (fired.current) return;
      fired.current = true;
      /*
        Disarm on the next frame rather than synchronously. The click that
        follows a pointerdown is dispatched after the gesture completes, so
        waiting a frame lets that click reach the player instead of being
        swallowed by a shield that is on its way out.
       */
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        setArmed(false);
        onDisarm?.(reason);
      });
    },
    [onDisarm],
  );

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  /*
    Hard timeout. This is the guarantee that the shield can never hold the
    video surface hostage: even if the viewer never clicks, it stops
    intercepting input after `maxArmedMs`.
   */
  useEffect(() => {
    if (!armed || disabled) return;
    const timer = window.setTimeout(() => disarm('timeout'), maxArmedMs);
    return () => window.clearTimeout(timer);
  }, [armed, disabled, maxArmedMs, disarm]);

  /*
    Remote controls and keyboards produce no pointer gesture to intercept, so a
    confirm key is released at the window level. Swallowing an "OK" would leave
    a TV viewer unable to start playback at all, which is a worse outcome than
    the pop-under this component exists to reduce.
   */
  useEffect(() => {
    if (!armed || disabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
      disarm('key');
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [armed, disabled, disarm]);

  if (disabled) {
    // Disarm without unmounting mid-render.
    return null;
  }

  if (!armed) return null;

  const absorb = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    disarm('click');
  };

  return (
    <div
      onPointerDownCapture={absorb}
      onPointerUpCapture={absorb}
      onClickCapture={absorb}
      aria-hidden="true"
      data-player-shield="armed"
      className="absolute inset-0 z-[15]"
    />
  );
}