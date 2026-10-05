'use client';

import Link from 'next/link';
import { CloudOff, PlayCircle, RefreshCw } from 'lucide-react';

/**
 * Served by the service worker when a navigation fails with no cached copy.
 * A client component so Retry can force a genuine network round trip rather
 * than a navigation the worker might answer from cache.
 */
export default function OfflinePage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-8 bg-obsidian px-6 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50rem_30rem_at_50%_30%,rgba(220,38,38,0.16),transparent_65%)]" />

      <div className="relative flex flex-col items-center gap-5">
        <span className="grid h-16 w-16 place-items-center rounded-2xl border border-crimson/40 bg-crimson/10 text-crimson-bright shadow-glow">
          <CloudOff className="h-8 w-8" />
        </span>

        <h1 className="text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">
          You&rsquo;re offline
        </h1>

        <p className="max-w-sm text-sm leading-relaxed text-white/55">
          MovieShop needs a connection to load the catalogue and stream. Reconnect and
          your pass will still be active.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-glow"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
          <Link href="/" className="btn-ghost">
            <PlayCircle className="h-4 w-4" />
            Back to MovieShop
          </Link>
        </div>
      </div>
    </main>
  );
}
