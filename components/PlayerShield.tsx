'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * One-shot click shield for the third-party embed.
 *
 * Most pop-under providers do not fire on page load. They arm a listener on
 * the first trusted click anywhere in the frame, then use that gesture to call
 * `window.open` and navigate the opener. The viewer is usually clicking the
 * player's own play button when it happens, which is why it reads as "pressing
 * a button kicks me off the page".
 *
 * This overlay sits on top of the iframe, eats exactly one gesture, and then
 * unmounts so the player has the surface to itself. It is deliberately narrow:
 *
 *   - Only the *first* gesture is absorbed. Subsequent clicks reach the player,
 *     so play/pause, seek, volume and the provider's own fullscreen button all
 *     behave normally.
 *   - The absorbed gesture is stopped in the capture phase at `pointerdown`,
 *     before it can reach any listener the provider registered on the frame.
 *   - It is absolutely positioned inside the existing video surface, so it adds
 *     no layout, no dimensions and no styling to the player.
 *
 * Nothing here opens a window, so disarming cannot itself trigger a popup.
 */
interface PlayerShieldProps {
  /** Disarms the shield, e.g. once the embed reports it has loaded. */
  disabled?: boolean;
  onDisarm?: () => void;
}

export default function PlayerShield({ disabled = false, onDisarm }: PlayerShieldProps) {
  const [armed, setArmed] = useState(true);
  const frame = useRef<number | null>(null);

  const disarm = useCallback(() => {
    if (frame.current !== null) return;
    /*
      * Disarm on the next frame rather than synchronously. The click that
      * follows a pointerdown is dispatched after the gesture completes, so
      * waiting one frame means that click lands on the player rather than
      * being swallowed by a shield that is on its way out.
     */
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      setArmed(false);
      onDisarm?.();
    });
  }, [onDisarm]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  /*
    TV remotes and keyboard users have no pointer gesture to intercept, so the
    capture key goes through a window-level listener. Without this the shield
    would swallow D-pad OK presses and the player would never receive them.
  */
  useEffect(() => {
    if (!armed || disabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
      event.preventDefault();
      event.stopPropagation();
      disarm();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [armed, disabled, disarm]);

  if (!armed || disabled) return null;

  const absorb = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    disarm();
  };

  return (
    <div
      onPointerDownCapture={absorb}
      onPointerUpCapture={absorb}
      onClickCapture={absorb}
      aria-hidden="true"
      className="absolute inset-0 z-[15] cursor-pointer"
    />
  );
}