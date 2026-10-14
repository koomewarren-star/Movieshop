'use client';

import { useEffect, useState } from 'react';
import { Check, HardDriveDownload, Loader2, TriangleAlert } from 'lucide-react';
import { isDownloadable, mediaKey, type MediaKeyKind } from '@/lib/downloads';
import { useSupabaseUser } from '@/hooks/useSupabaseUser';

/**
 * Save-to-library control.
 *
 * Saving records one row against the viewer's account. The file never moves: it
 * already lives on the server and streams through /api/media, so this is
 * instant however large the film is.
 *
 * The client sends only the catalogue key. The filename is resolved server-side
 * from the private manifest, so the browser never learns or supplies it.
 *
 * Renders nothing unless the title is actually downloadable.
 */
interface SaveButtonProps {
  id: number | string;
  kind: MediaKeyKind;
  title: string;
  poster?: string | null;
  season?: number;
  episode?: number;
  className?: string;
}

export default function SaveButton({
  id,
  kind,
  title,
  poster,
  season,
  episode,
  className = '',
}: SaveButtonProps) {
  const { user } = useSupabaseUser();
  const key = mediaKey(id, kind, season, episode);

  const [available, setAvailable] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setAvailable(false);
    setSaved(false);

    void isDownloadable(id, kind, season, episode).then((hit) => {
      if (!active) return;
      setAvailable(hit);
      if (!hit || !user) return;
      fetch('/api/downloads', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { downloads?: Array<{ key: string }> } | null) => {
          if (active && data?.downloads) {
            setSaved(data.downloads.some((d) => d.key === key));
          }
        })
        .catch(() => undefined);
    });

    return () => {
      active = false;
    };
  }, [id, kind, season, episode, key, user]);

  const save = async () => {
    if (!user) {
      window.location.href = '/login';
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/downloads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, tmdbId: Number(id), kind, title, season, episode, poster }),
      });
      if (res.ok) {
        setSaved(true);
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? 'Could not save this title.');
      }
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  };

  if (!available) return null;

  return (
    <div className={`flex flex-col items-start gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          void save();
        }}
        disabled={busy || saved}
        aria-busy={busy}
        title={saved ? 'Saved to your library. Find it on the Downloads page.' : 'Save to your library'}
        className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-white/80 transition-all hover:border-crimson/50 hover:bg-crimson/10 hover:text-white active:scale-95 disabled:pointer-events-none disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : saved ? (
          <Check className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <HardDriveDownload className="h-3.5 w-3.5" />
        )}
        <span className="hidden sm:inline">{busy ? 'Saving' : saved ? 'Saved' : 'Save'}</span>
      </button>

      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-[11px] text-red-300">
          <TriangleAlert className="mt-px h-3 w-3 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}