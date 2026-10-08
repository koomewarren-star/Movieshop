'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Film, LogIn, Sparkles, X } from 'lucide-react';

/**
 * Sign-in gate.
 *
 * Replaces the former M-Pesa paywall. A free account is now the only key, so
 * this asks for one instead of taking payment.
 *
 * It deliberately does NOT remember what the viewer was trying to watch. The
 * obvious behaviour is "sign in, then resume", and the trap is that `/login`
 * navigates away from this page, so the pending title is lost with it -
 * resuming afterwards would need the intent persisted across a full page load
 * and a full redirect through Supabase's auth callback. That is a real feature
 * with real failure modes, and shipping a half-built version of it would be
 * worse than not having it. The viewer presses play again after signing in,
 * which is two taps and always works.
 *
 * Escape and backdrop both close, matching the player modal's behaviour.
 */
interface SignInGateProps {
  open: boolean;
  onClose: () => void;
  /** Title the viewer tried to open, shown only when the modal was opened by a play action. */
  intent?: string | null;
}

export default function SignInGate({ open, onClose, intent = null }: SignInGateProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to watch"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-scale-in"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-charcoal/80 shadow-glow-lg backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-0 -top-24 h-56 bg-[radial-gradient(38rem_18rem_at_50%_0%,rgba(220,38,38,0.28),transparent_70%)]" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-white/70 transition-colors hover:border-crimson hover:bg-crimson/20 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative p-6 sm:p-8">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-crimson-sheen shadow-glow">
            <Film className="h-5 w-5 text-white" />
          </span>

          <h2 className="mt-5 text-xl font-black uppercase tracking-tight text-white sm:text-2xl">
            Sign in to <span className="text-crimson-bright">watch</span>
          </h2>

          {intent && (
            <p className="mt-2 flex items-center gap-2 text-sm text-white/55">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-crimson-bright" />
              <span className="truncate">
                <strong className="font-semibold text-white/80">{intent}</strong> is ready for you.
              </span>
            </p>
          )}

          <p className="mt-3 text-sm text-white/55">
            Every movie, series and anime is free with an account. No card, no
            M-Pesa, no subscription.
          </p>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <Link href="/login" onClick={onClose} className="btn-glow flex flex-1 items-center justify-center gap-2">
              <LogIn className="h-4 w-4" />
              Sign in or create account
            </Link>
          </div>

          <p className="mt-4 text-center text-[11px] text-white/35">
            Watching is free. We only ask for an email so your progress is saved.
          </p>
        </div>
      </div>
    </div>
  );
}