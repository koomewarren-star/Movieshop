'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, HardDrive, Loader2, LogIn, Play, Trash2, TriangleAlert } from 'lucide-react';
import { useSupabaseUser } from '@/hooks/useSupabaseUser';
import type { SavedDownload } from '@/lib/downloadTypes';
import { formatBytes, savedLabel } from '@/lib/downloadTypes';

/**
 * The viewer's download library.
 *
 * Reads from the account, not the device: the list follows the viewer across
 * browsers and phones, and the file itself is streamed from the server rather
 * than held in the browser. That matters for a feature-length film, which no
 * phone would have had the space for.
 */
export default function DownloadsPage() {
  const { user, ready } = useSupabaseUser();
  const [items, setItems] = useState<SavedDownload[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/downloads', { cache: 'no-store' });
      if (!res.ok) {
        setItems([]);
        setError(res.status === 401 ? 'Sign in to see your downloads.' : 'Could not load your library.');
        return;
      }
      const data = (await res.json()) as { downloads: SavedDownload[] };
      setItems(Array.isArray(data.downloads) ? data.downloads : []);
      setError(null);
    } catch {
      setItems([]);
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      setLoading(false);
      return;
    }
    void load();
  }, [ready, user, load]);

  const remove = useCallback(
    async (key: string) => {
      setBusy(key);
      setError(null);
      if (playing === key) setPlaying(null);
      try {
        const res = await fetch(`/api/downloads?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(data?.error ?? 'Could not remove that title.');
        } else {
          setItems((current) => current.filter((item) => item.key !== key));
        }
      } catch {
        setError('Could not reach the server.');
      } finally {
        setBusy(null);
      }
    },
    [playing],
  );

  const streamUrl = (item: SavedDownload) =>
    `/api/media?file=${encodeURIComponent(item.file_name)}`;

  return (
    <main className="min-h-svh bg-obsidian px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/45 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to browsing
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
            My <span className="text-crimson-bright">Downloads</span>
          </h1>
          <p className="mt-1 text-sm text-white/45">
            {user ? `Saved to ${user.email}` : 'Saved to your account.'}
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-xl border border-crimson/40 bg-crimson/10 px-4 py-3 text-xs text-red-200"
          >
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {ready && !user ? (
          <div className="rounded-2xl border border-dashed border-white/12 bg-charcoal/30 px-6 py-16 text-center">
            <LogIn className="mx-auto h-9 w-9 text-white/20" />
            <h2 className="mt-4 text-base font-bold uppercase tracking-wide text-white/85">
              Sign in to see your downloads
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-white/45">
              Your library is tied to your account, so it follows you to any device.
            </p>
            <Link href="/login" className="btn-glow mt-6 inline-flex items-center gap-2">
              Sign in
            </Link>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center gap-3 py-24 text-white/45">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading your library…</span>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/12 bg-charcoal/30 px-6 py-16 text-center">
            <HardDrive className="mx-auto h-9 w-9 text-white/20" />
            <h2 className="mt-4 text-base font-bold uppercase tracking-wide text-white/85">
              Nothing saved yet
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-white/45">
              Press <strong className="text-white/70">Save</strong> on a title and it will
              appear here on every device you sign in on.
            </p>
            <Link href="/" className="btn-glow mt-6 inline-flex items-center gap-2">
              Find something to save
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const isPlaying = playing === item.key;
              return (
                <li key={item.key} className="overflow-hidden rounded-xl border border-white/10 bg-charcoal/50">
                  <div className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
                    <div className="h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-black/60 sm:h-20 sm:w-14">
                      {item.poster ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.poster} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="grid h-full w-full place-items-center text-white/20">
                          <Play className="h-4 w-4" />
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-bold text-white sm:text-base">
                        {savedLabel(item)}
                      </h3>
                      <p className="mt-0.5 text-[11px] text-white/40">
                        {formatBytes(item.size_bytes)} · saved{' '}
                        {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPlaying(isPlaying ? null : item.key)}
                        aria-label={isPlaying ? 'Stop playing' : 'Play'}
                        className="grid h-10 w-10 place-items-center rounded-lg bg-crimson/20 text-crimson-bright transition-all hover:bg-crimson/30 hover:text-white active:scale-95"
                      >
                        <Play className="h-4 w-4 fill-current" />
                      </button>
                      <a
                        href={`${streamUrl(item)}&download=1`}
                        aria-label={`Download ${savedLabel(item)} to this device`}
                        title="Download to this device"
                        className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 text-white/70 transition-colors hover:border-crimson hover:bg-crimson/15 hover:text-white"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                      <button
                        type="button"
                        onClick={() => void remove(item.key)}
                        disabled={busy === item.key}
                        aria-label={`Remove ${savedLabel(item)}`}
                        className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 text-white/60 transition-colors hover:border-crimson hover:bg-crimson/15 hover:text-white disabled:opacity-40"
                      >
                        {busy === item.key ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isPlaying && (
                    <video src={streamUrl(item)} controls autoPlay playsInline className="w-full bg-black" />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}