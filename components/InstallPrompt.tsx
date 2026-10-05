'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

/**
 * BeforeInstallPromptEvent is not in lib.dom yet, so it is declared here.
 * `userChoice` resolves to the user's answer, which we use to avoid showing the
 * banner again after a decline.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Dismissal is deliberately NOT persisted.
 *
 * This used to write `movieshop:install-dismissed` to localStorage, which made
 * the banner a one-shot: tap the X once and it never came back for that browser,
 * for any reason, forever. Since installing is the main on-ramp to the app on
 * Android, a single stray tap could permanently hide it.
 *
 * Now the X hides the banner for the current page view only; it returns on the
 * next load unless the app is genuinely installed.
 */

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    /* Already installed — nothing to offer. */
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    // iOS Safari sets `navigator.standalone` instead of the display-mode query.
    // It is a real, shipped property that lib.dom has no types for.
    if ((window.navigator as Navigator & { standalone?: boolean }).standalone) return;

    const onBeforeInstall = (event: Event) => {
      // Suppress Chrome's mini-infobar so we can present it in our own UI.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  /* Service worker: production only. Registering in dev caches dev chunks and
     reproduces the stale-404 blank page we already hit once. */
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // A failed registration must never surface to the user.
      });
    };

    // Registering after load keeps the worker off the critical path.
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });

    return () => window.removeEventListener('load', register);
  }, []);

  /* Hides for this page view only — see the note above the component. */
  const dismiss = () => {
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'dismissed') dismiss();
    setVisible(false);
    setDeferred(null);
  };

  if (!visible || !deferred) return null;

  return (
    <div
      role="dialog"
      aria-label="Install MovieShop"
      className="fixed inset-x-3 bottom-3 z-[75] animate-fade-up sm:inset-x-auto sm:bottom-5 sm:left-1/2 sm:w-[26rem] sm:-translate-x-1/2"
    >
      <div className="glass-strong flex items-center gap-3 rounded-2xl p-3.5 shadow-glow-lg">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-crimson-sheen shadow-glow">
          <Download className="h-5 w-5 text-white" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">Install MovieShop</p>
          <p className="mt-0.5 text-[11px] leading-tight text-white/50">
            Add it to your home screen for fullscreen, faster launches.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={dismiss} aria-label="Dismiss install prompt" className="grid h-8 w-8 place-items-center rounded-lg text-white/45 transition-colors hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
          <button type="button" onClick={install} className="btn-glow px-4 py-2 text-[11px]">
            Install
          </button>
        </div>
      </div>
    </div>
  );
}
