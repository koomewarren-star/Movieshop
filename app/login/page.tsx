'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, LogIn, Mail, UserPlus } from 'lucide-react';
import { tryCreateClient } from '@/lib/supabase/client';
import AuthCard from '@/components/AuthCard';

/**
 * Read synchronously rather than in an effect.
 *
 * NEXT_PUBLIC_* values are inlined at build time, so this is known during the
 * first render. Initialising to `true` and correcting in an effect would make
 * the form look briefly functional on an unconfigured deploy before the
 * warning appeared.
 */
const SUPABASE_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

type Mode = 'signin' | 'signup';

interface FormErrors {
  email?: string;
  password?: string;
  form?: string;
}

/**
 * Email + password authentication.
 *
 * Client-side validation here is a convenience, not a security control. The
 * authoritative checks are Supabase's own password policy and the database's
 * Row Level Security rules; anything enforced only here can be bypassed by
 * calling the API directly.
 */
export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [configured] = useState(SUPABASE_CONFIGURED);

  const validate = (): boolean => {
    const next: FormErrors = {};
    const trimmed = email.trim();

    if (!trimmed) {
      next.email = 'Enter your email address.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      next.email = 'That does not look like a valid email address.';
    }

    if (!password) {
      next.password = 'Enter your password.';
    } else if (mode === 'signup' && password.length < 8) {
      next.password = 'Use at least 8 characters.';
    } else if (mode === 'signup' && !/[A-Za-z]/.test(password)) {
      next.password = 'Include at least one letter.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);
    setErrors({});

    if (!validate()) return;

    const supabase = tryCreateClient();
    if (!supabase) {
      setErrors({
        form: 'Sign-in is not configured on this deployment yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
      });
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          // Send the viewer straight back to the app if the address is already
          // confirmed; otherwise they land on the confirmation notice.
          options: { emailRedirectTo: `${window.location.origin}/login` },
        });

        if (error) throw error;

        /*
          * No error but no session means Supabase is waiting on email
          * confirmation (the default when "Confirm email" is on). Saying
          * "account created" here would send them straight to a sign-in that
          * cannot succeed yet.
         */
        if (data.session) {
          router.push('/');
          router.refresh();
          return;
        }

        setNotice('Account created. Check your email for the confirmation link, then sign in.');
        setMode('signin');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        router.push('/');
        router.refresh();
      }
    } catch (err) {
      setErrors({
        form: err instanceof Error ? err.message : 'Something went wrong. Try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setErrors({});
    setNotice(null);
  };

  const signingUp = mode === 'signup';

  return (
    <AuthCard>
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/45 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to browsing
      </Link>

      <h1 className="text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
        {signingUp ? (
          <>
            Create your <span className="text-crimson-bright">account</span>
          </>
        ) : (
          <>
            Sign <span className="text-crimson-bright">in</span>
          </>
        )}
      </h1>
      <p className="mt-2 text-sm text-white/50">
        {signingUp
          ? 'One account for your pass, downloads and continue watching.'
          : 'Welcome back. Your Access Pass and progress are waiting.'}
      </p>

      {!configured && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Supabase is not configured on this deployment. Add{' '}
            <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable sign-in.
          </p>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="mt-6 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{notice}</p>
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-white/55">
            Email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'email-error' : undefined}
              placeholder="you@example.com"
              className={`w-full rounded-xl border bg-black/40 py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/25 outline-none transition-colors focus:border-crimson/60 ${
                errors.email ? 'border-crimson/70' : 'border-white/10'
              }`}
            />
          </div>
          {errors.email && (
            <p id="email-error" className="mt-1.5 text-xs text-crimson-bright">
              {errors.email}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-white/55">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-error' : undefined}
            placeholder={signingUp ? 'At least 8 characters' : '••••••••'}
            className={`w-full rounded-xl border bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/25 outline-none transition-colors focus:border-crimson/60 ${
              errors.password ? 'border-crimson/70' : 'border-white/10'
            }`}
          />
          {errors.password && (
            <p id="password-error" className="mt-1.5 text-xs text-crimson-bright">
              {errors.password}
            </p>
          )}
        </div>

        {errors.form && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-crimson/40 bg-crimson/10 px-4 py-3 text-xs text-red-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{errors.form}</p>
          </div>
        )}

        <button type="submit" disabled={busy} className="btn-glow flex w-full items-center justify-center gap-2 disabled:opacity-60">
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {signingUp ? 'Creating account…' : 'Signing in…'}
            </>
          ) : signingUp ? (
            <>
              <UserPlus className="h-4 w-4" />
              Create account
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4" />
              Sign in
            </>
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-white/45">
        {signingUp ? 'Already have an account?' : 'New to MovieShop?'}{' '}
        <button
          type="button"
          onClick={() => switchMode(signingUp ? 'signin' : 'signup')}
          className="font-bold text-crimson-bright transition-colors hover:text-white"
        >
          {signingUp ? 'Sign in' : 'Create one'}
        </button>
      </p>
    </AuthCard>
  );
}