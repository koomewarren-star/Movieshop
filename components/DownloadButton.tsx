'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { isDownloadable, mediaKey, type MediaKeyKind } from '@/lib/downloads';

/**
 * Download-to-device control.
 *
 * Writes a copy to the viewer's own downloads folder. Separate from
 * `SaveButton`, which adds the title to the account library - different
 * destinations with different outcomes, so two buttons rather than one with a
 * mode switch.
 *
 * The link is by catalogue key, not by filename. Filenames live in a private
 * manifest and are resolved server-side, so the browser never learns them.
 * The route still requires a session: files are no longer static assets, so an
 * anonymous click gets a 401 rather than a film.
 *
 * Renders nothing unless the title is actually downloadable.
 */
interface DownloadButtonProps {
  id: number | string;
  kind: MediaKeyKind;
  title: string;
  season?: number;
  episode?: number;
  className?: string;
}

export default function DownloadButton({
  id,
  kind,
  title,
  season,
  episode,
  className = '',
}: DownloadButtonProps) {
  const key = mediaKey(id, kind, season, episode);
  const [available, setAvailable] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;
    setChecked(false);
    setAvailable(false);

    void isDownloadable(id, kind, season, episode).then((hit) => {
      if (!active) return;
      setAvailable(hit);
      setChecked(true);
    });

    return () => {
      active = false;
    };
  }, [id, kind, season, episode]);

  // Rendering nothing while the catalogue loads avoids a flash of a button that
  // may turn out not to exist.
  if (!checked || !available) return null;

  return (
    <a
      href={`/api/media/download?key=${encodeURIComponent(key)}`}
      onClick={(event) => {
        event.stopPropagation();
      }}
      title={`Download ${title} to this device`}
      className={`inline-flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-white/80 transition-all hover:border-crimson/50 hover:bg-crimson/10 hover:text-white active:scale-95 ${className}`}
    >
      <Download className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Download</span>
    </a>
  );
}