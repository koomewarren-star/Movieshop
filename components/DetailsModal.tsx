'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Loader2, Play, Star, Users, X } from 'lucide-react';
import P2PDownloader from '@/components/P2PDownloader';
// P2P download is temporarily disabled; the import is parked so the control
// can be restored with a single revert. See NexstreamPlayer.tsx.
import type { MediaDetails, MediaItem } from '@/lib/types';

interface DetailsModalProps {
  item: MediaItem | null;
  open: boolean;
  onClose: () => void;
  onPlay: (item: MediaItem, season: number, episode: number) => void;
}

export default function DetailsModal({ item, open, onClose, onPlay }: DetailsModalProps) {
  const [details, setDetails] = useState<MediaDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);

  useEffect(() => {
    if (!open || !item) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    setSeason(1);
    setEpisode(1);
    setLoading(true);
    setDetails(null);

    const controller = new AbortController();
    fetch(`/api/details?id=${item.id}&kind=${item.kind}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data: { details?: MediaDetails | null }) => {
        setDetails(data.details ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      controller.abort();
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, item, onClose]);

  if (!open || !item) return null;

  const isTv = item.kind === 'tv';
  const art = details?.backdrop ?? item.backdrop;
  const title = details?.title ?? item.title;
  const rating = details?.rating ?? item.rating;
  const runtime = details?.runtime;
  const cast = details?.cast ?? [];
  const genres = details?.genres?.length ? details.genres : item.genres;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} details`}
      className="fixed inset-0 z-[60] flex items-end justify-center overflow-y-auto bg-black/90 p-0 backdrop-blur-md animate-scale-in sm:items-center sm:p-6"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-4xl overflow-hidden rounded-t-3xl border border-white/10 bg-obsidian shadow-panel sm:rounded-3xl">
        {/* Backdrop */}
        <div className="relative h-56 w-full sm:h-72">
          {art ? (
            <Image
              src={art}
              alt=""
              fill
              sizes="(max-width: 1024px) 100vw, 56rem"
              className="object-cover opacity-60"
              priority
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/60 to-obsidian/30" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-obsidian to-transparent" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="absolute right-4 top-4 z-20 grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-black/50 text-white/70 backdrop-blur-md transition-colors hover:border-crimson hover:bg-crimson/20 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative -mt-14 px-5 pb-6 sm:px-8 sm:pb-8">
          {item.poster && (
            <div className="relative hidden h-40 w-28 shrink-0 overflow-hidden rounded-xl shadow-panel ring-1 ring-white/10 sm:block">
              <Image src={item.poster} alt={title} fill sizes="112px" className="object-cover" />
            </div>
          )}

          <div className="sm:-mt-24 sm:ml-36">
            <h2 className="text-2xl font-black uppercase leading-tight tracking-tight text-white sm:text-4xl">
              {title}
            </h2>
            {details?.tagline && (
              <p className="mt-1.5 text-sm italic text-white/45">{details.tagline}</p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {rating > 0 && (
                <span className="chip">
                  <Star className="h-3.5 w-3.5 fill-crimson text-crimson" />
                  {rating.toFixed(1)}
                </span>
              )}
              <span className="chip border-crimson/35 bg-crimson/10 text-crimson-bright">
                4K Ultra HD
              </span>
              <span className="chip">{item.year}</span>
              {runtime && <span className="chip">{runtime}</span>}
              <span className="chip">{isTv ? 'Series' : 'Film'}</span>
              {isTv && details?.numberOfSeasons && (
                <span className="chip">{details.numberOfSeasons} seasons</span>
              )}
            </div>

            {genres.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {genres.map((genre) => (
                  <span
                    key={genre}
                    className="rounded-md border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/60"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}

            {(details?.overview ?? item.overview) && (
              <p className="mt-5 max-w-2xl text-sm leading-relaxed text-white/65">
                {details?.overview ?? item.overview}
              </p>
            )}

            {/* Season / episode selector */}
            {isTv && (
              <div className="mt-6 flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                    Season
                  </span>
                  <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/40 p-1">
                    <button
                      type="button"
                      onClick={() => setSeason((value) => Math.max(1, value - 1))}
                      disabled={season <= 1}
                      aria-label="Previous season"
                      className="grid h-7 w-7 place-items-center rounded-md text-white/70 transition-colors hover:bg-crimson/20 hover:text-white disabled:pointer-events-none disabled:opacity-30"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-bold tabular-nums text-white">
                      {season}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSeason((value) =>
                          details?.numberOfSeasons
                            ? Math.min(details.numberOfSeasons, value + 1)
                            : value + 1,
                        )
                      }
                      disabled={Boolean(details?.numberOfSeasons && season >= details.numberOfSeasons)}
                      aria-label="Next season"
                      className="grid h-7 w-7 place-items-center rounded-md text-white/70 transition-colors hover:bg-crimson/20 hover:text-white disabled:pointer-events-none disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                    Episode
                  </span>
                  <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/40 p-1">
                    <button
                      type="button"
                      onClick={() => setEpisode((value) => Math.max(1, value - 1))}
                      disabled={episode <= 1}
                      aria-label="Previous episode"
                      className="grid h-7 w-7 place-items-center rounded-md text-white/70 transition-colors hover:bg-crimson/20 hover:text-white disabled:pointer-events-none disabled:opacity-30"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-bold tabular-nums text-white">
                      {episode}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEpisode((value) => value + 1)}
                      aria-label="Next episode"
                      className="grid h-7 w-7 place-items-center rounded-md text-white/70 transition-colors hover:bg-crimson/20 hover:text-white"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onPlay(item, season, episode)}
                className="btn-glow"
              >
                <Play className="h-5 w-5 fill-white" />
                Play {isTv ? `S${season} E${episode}` : 'Now'}
              </button>

              {/* P2P download temporarily disabled alongside the player's control.
                  See the note in NexstreamPlayer.tsx; restoring both means
                  restoring both imports. */}
              {loading && (
                <span className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/40">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading cast
                </span>
              )}
            </div>

            {/* Cast */}
            {cast.length > 0 && (
              <div className="mt-8">
                <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-white/40">
                  <Users className="h-3.5 w-3.5" />
                  Cast
                </h3>
                <ul className="mt-3 flex gap-3 overflow-x-auto pb-2">
                  {cast.map((person) => (
                    <li key={person.id} className="w-24 shrink-0 text-center">
                      <div className="relative mx-auto h-24 w-24 overflow-hidden rounded-full bg-charcoal ring-1 ring-white/10">
                        {person.profile ? (
                          <Image
                            src={person.profile}
                            alt={person.name}
                            fill
                            sizes="96px"
                            className="object-cover"
                          />
                        ) : null}
                      </div>
                      <p className="mt-2 truncate text-[11px] font-bold text-white">{person.name}</p>
                      <p className="truncate text-[10px] text-white/40">{person.character}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
