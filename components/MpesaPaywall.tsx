'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Crown,
  Film,
  Loader2,
  Lock,
  PartyPopper,
  ShieldCheck,
  Smartphone,
  Tv,
  X,
  Zap,
} from 'lucide-react';
import { PLAN, STK_PROMPT, maskPhone, normalisePhone, stkPush, validatePhone } from '@/lib/mpesa';
import type { PayState } from '@/lib/types';

interface MpesaPaywallProps {
  open: boolean;
  onClose: () => void;
  onSubscribed: (details: { phone: string; checkoutRequestId: string }) => void;
  /** The title whose "Watch Now" triggered this, for context. */
  intent?: string | null;
}

const PERKS = [
  { icon: Film, label: 'Unlimited 4K HDR films', sub: 'Every new release, uncut' },
  { icon: Tv, label: 'Full TV series & anime', sub: 'All seasons and episodes' },
  { icon: Zap, label: 'No buffering, no adverts', sub: 'Ad-free playback' },
  { icon: Smartphone, label: 'Phone, TV, laptop', sub: 'Watch anywhere in Kenya' },
];

export default function MpesaPaywall({
  open,
  onClose,
  onSubscribed,
  intent,
}: MpesaPaywallProps) {
  const [phone, setPhone] = useState('');
  const [pay, setPay] = useState<PayState>({ status: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setPay({ status: 'idle' });
    setError(null);
    setPhone('');
    busyRef.current = false;
    const timer = setTimeout(() => inputRef.current?.focus(), 280);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      // Don't let Escape yank the modal away mid-transaction.
      if (event.key === 'Escape' && !busyRef.current) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const onPay = useCallback(async () => {
    const value = normalisePhone(phone);
    const check = validatePhone(value);
    if (!check.valid) {
      setError(check.error ?? 'Invalid number');
      return;
    }
    if (busyRef.current) return;

    setError(null);
    busyRef.current = true;

    const result = await stkPush(value, setPay);
    if (result.ok) {
      onSubscribed({ phone: value, checkoutRequestId: result.checkoutRequestId });
    } else {
      busyRef.current = false;
    }
  }, [phone, onSubscribed]);

  if (!open) return null;

  const busy =
    pay.status === 'authorizing' ||
    pay.status === 'awaiting' ||
    pay.status === 'processing';
  const succeeded = pay.status === 'success';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="MovieShop Access Pass"
      className="fixed inset-0 z-[80] flex items-end justify-center overflow-y-auto bg-black/90 p-0 backdrop-blur-md animate-scale-in sm:items-center sm:p-6"
      onClick={(event) => !busy && event.target === event.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-4xl overflow-hidden rounded-t-3xl border border-white/10 bg-obsidian shadow-glow-lg sm:rounded-3xl">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[38rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(220,38,38,0.45),transparent)] blur-2xl" />

        {!busy && !succeeded && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close paywall"
            className="absolute right-4 top-4 z-20 grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-black/40 text-white/70 backdrop-blur-md transition-colors hover:border-crimson hover:bg-crimson/20 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="relative grid gap-8 p-6 sm:p-9 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
          {/* Pitch */}
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-crimson/45 bg-crimson/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-crimson-bright">
              <Crown className="h-3.5 w-3.5" />
              {PLAN.name}
            </span>

            <h2 className="mt-4 text-3xl font-black uppercase leading-[1.05] tracking-tight text-white sm:text-4xl">
              Stream Unlimited HD
              <br className="hidden sm:block" />{' '}
              <span className="text-crimson-bright">Movies &amp; TV Series</span>
            </h2>

            <p className="mt-3 text-base font-semibold text-white/80 sm:text-lg">
              for{' '}
              <span className="text-crimson-bright">
                {PLAN.priceBob} {PLAN.currency} / {PLAN.cadence}
              </span>
            </p>

            <p className="mt-3 text-sm leading-relaxed text-white/50">
              {intent
                ? `“${intent}” is part of the pass. Pay once and every film, series and anime unlocks instantly.`
                : 'Pay once and every film, series and anime unlocks instantly. One flat fee, no tiers, no bundles.'}
            </p>

            <ul className="mt-6 grid gap-2.5 text-left sm:grid-cols-2">
              {PERKS.map(({ icon: Icon, label, sub }) => (
                <li
                  key={label}
                  className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-md"
                >
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-crimson/15 text-crimson-bright">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-[13px] font-bold text-white">{label}</span>
                    <span className="block text-[11px] text-white/45">{sub}</span>
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-6 flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-white/35 lg:justify-start">
              <ShieldCheck className="h-4 w-4 text-emerald-400/70" />
              Secured by Safaricom M-Pesa
            </p>
          </div>

          {/* Payment */}
          <div className="glass-strong flex flex-col justify-center rounded-2xl p-5 sm:p-6">
            <div className="flex items-end justify-between rounded-xl border border-crimson/30 bg-crimson/[0.07] p-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/45">
                  Monthly Access Pass
                </p>
                <p className="mt-1 text-4xl font-black text-white">
                  {PLAN.priceBob}
                  <span className="ml-1.5 text-lg font-black text-crimson-bright">
                    {PLAN.currency}
                  </span>
                </p>
              </div>
              <span className="rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white/70">
                / {PLAN.cadence}
              </span>
            </div>

            {succeeded ? (
              <div className="mt-6 flex flex-col items-center py-4 text-center">
                <span className="relative grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
                  <span className="absolute inset-0 animate-pulse-ring rounded-full bg-emerald-500/20" />
                  <CheckCircle2 className="h-9 w-9" />
                </span>
                <h3 className="mt-5 text-xl font-black uppercase tracking-tight text-white">
                  Access Pass active
                </h3>
                <p className="mt-2 max-w-xs text-sm text-white/55">{pay.message}</p>
                {pay.checkoutRequestId && (
                  <p className="mt-3 font-mono text-[11px] uppercase tracking-widest text-white/30">
                    {pay.checkoutRequestId}
                  </p>
                )}
                <button type="button" onClick={onClose} autoFocus className="btn-glow mt-7 w-full">
                  <PartyPopper className="h-4 w-4" />
                  Start Watching
                </button>
              </div>
            ) : (
              <form
                className="mt-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void onPay();
                }}
              >
                <label
                  htmlFor="mpesa-phone"
                  className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-white/55"
                >
                  Safaricom M-Pesa number
                </label>

                <div
                  className={`flex items-center gap-2.5 rounded-xl border bg-black/40 px-4 py-3.5 transition-colors ${
                    error
                      ? 'border-crimson shadow-glow'
                      : 'border-white/10 focus-within:border-crimson/70 focus-within:shadow-glow'
                  }`}
                >
                  <span className="text-lg" aria-hidden>
                    🇰🇪
                  </span>
                  <input
                    ref={inputRef}
                    id="mpesa-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    disabled={busy}
                    value={phone}
                    onChange={(event) => {
                      setPhone(event.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="07XX XXX XXX"
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'mpesa-error' : undefined}
                    className="w-full bg-transparent text-base font-semibold tracking-wide text-white placeholder-white/25 outline-none disabled:opacity-60"
                  />
                  <Lock className="h-4 w-4 shrink-0 text-white/25" aria-hidden />
                </div>

                <p className="mt-2 text-[11px] text-white/35">
                  Accepts 07XXXXXXXX, 01XXXXXXXX or 2547XXXXXXXX.
                </p>

                {error && (
                  <p
                    id="mpesa-error"
                    role="alert"
                    className="mt-2 animate-fade-up text-xs font-semibold text-crimson-bright"
                  >
                    {error}
                  </p>
                )}

                {busy && (
                  <div className="mt-5 rounded-xl border border-white/10 bg-black/40 p-4">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-crimson-bright" />
                      <p className="text-sm font-semibold text-white/85">{pay.message}</p>
                    </div>

                    {pay.status === 'awaiting' && (
                      <div className="mt-4 flex items-center gap-3 rounded-lg border border-crimson/35 bg-crimson/10 px-3.5 py-3">
                        <span className="rounded-md bg-black/60 px-2.5 py-1.5 font-mono text-sm font-bold tracking-widest text-crimson-bright">
                          {STK_PROMPT}
                        </span>
                        <span className="text-[11px] leading-tight text-white/55">
                          Enter your M-Pesa PIN on the handset
                          <br />
                          <span className="text-white/35">to {maskPhone(phone)}</span>
                        </span>
                      </div>
                    )}

                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <span
                        className="block h-full rounded-full bg-crimson-sheen transition-all duration-700"
                        style={{
                          width:
                            pay.status === 'authorizing'
                              ? '30%'
                              : pay.status === 'awaiting'
                                ? '60%'
                                : '88%',
                        }}
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="btn-glow mt-5 w-full disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {pay.status === 'awaiting' ? 'Awaiting approval…' : 'Processing…'}
                    </>
                  ) : (
                    <>
                      <Smartphone className="h-4 w-4" />
                      Pay {PLAN.priceBob} {PLAN.currency} via M-Pesa
                    </>
                  )}
                </button>

                <p className="mt-3 text-center text-[10px] uppercase tracking-widest text-white/25">
                  You will receive an STK prompt on your phone
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
