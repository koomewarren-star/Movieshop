'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, PlayCircle, X } from 'lucide-react';
import {
  getContinueWatching,
  removeProgress,
  type WatchEntry,
} from '@/lib/watchProgress';
import type { MediaItem } from '@/lib/types';

interface ContinueWatchingProps {
  onSelect: (item: MediaItem, entry: WatchEntry) => void;
  locked?: boolean;
}

/**
 * Continue Watching row.
 *
 * Reads progress from localStorage on mount rather than during render, because
 * the store is client-only. Until that first read completes the row renders
 * nothing at all - showing an empty shell then popping the row in would shift
 * everything below it.
 */
export default function ContinueWatching({ onSelect, locked = false }: ContinueWatchingProps) {
  const [entries, setEntries] = useState<WatchEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const load = useCallback(() => {
    setEntries(getContinueWatching());
    setReady(true);
  }, []);

  useEffect(() => {
    load();
    // Also refresh when the tab regains focus: progress recorded in the player
    // should appear here on return rather than after a full page reload.
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const syncEdges = useCallback(() => {
    const list = document.getElementById('movieshop-continue');
    if (!list) return;
    setAtStart(list.scrollLeft <= 8);
    setAtEnd(list.scrollLeft + list.clientWidth >= list.scrollWidth - 8);
  }, []);

  useEffect(() => {
    if (!ready || entries.length === 0) return;
    syncEdges();
    const list = document.getElementById('movieshop-continue');
    if (!list) return;
    list.addEventListener('scroll', syncEdges, { passive: true });
    window.addEventListener('resize', syncEdges);
    return () => {
      list.removeEventListener('scroll', syncEdges);
      window.removeEventListener('resize', syncEdges);
    };
  }, [ready, entries.length, syncEdges]);

  const scrollBy = (direction: 1 | -1) => {
    const list = document.getElementById('movieshop-continue');
    if (!list) return;
    list.scrollBy({
      left: Math.max(240, list.clientWidth * 0.85) * direction,
      behavior: 'smooth',
    });
  };

  if (!ready || entries.length === 0) return null;

  return (
    <section id="continue" className="relative scroll-mt-24 py-4">
      <div className="mx-auto max-w-[100rem] px-4 sm:px-6 lg:px-10">
        <div className="mb-3.5 flex items-end justify-between gap-4">
          <h2 className="text-lg font-black uppercase tracking-tight text-white sm:text-2xl">
            <span className="mr-1.5">▶</span>
            Continue Watching
          </h2>

          <div className="flex items-center gap-2">
            <span className="hidden text-[11px] font-semibold uppercase tracking-widest text-white/30 sm:inline">
              {entries.length} in progress
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => scrollBy(-1)}
                disabled={atStart}
                aria-label="Scroll Continue Watching left"
                className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-charcoal/80 text-white/70 backdrop-blur-md transition-all duration-200 hover:border-crimson/60 hover:bg-crimson/15 hover:text-white disabled:pointer-events-none disabled:opacity-25"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollBy(1)}
                disabled={atEnd}
                aria-label="Scroll Continue Watching right"
                className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-charcoal/80 text-white/70 backdrop-blur-md transition-all duration-200 hover:border-crimson/60 hover:bg-crimson/15 hover:text-white disabled:pointer-events-none disabled:opacity-25"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="relative">
        <div
          className={`pointer-events-none absolute inset-y-0 left-0 z-20 w-8 bg-gradient-to-r from-obsidian to-transparent transition-opacity duration-300 lg:w-16 ${
            atStart ? 'opacity-0' : 'opacity-100'
          }`}
        />
        <div
          className={`pointer-events-none absolute inset-y-0 right-0 z-20 w-8 bg-gradient-to-l from-obsidian to-transparent transition-opacity duration-300 lg:w-16 ${
            atEnd ? 'opacity-0' : 'opacity-100'
          }`}
        />

        <ul
          id="movieshop-continue"
          className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-3 sm:gap-4 sm:px-6 lg:px-10"
        >
          {entries.map((entry) => (
            <li
              key={entry.key}
              className="w-[38vw] shrink-0 snap-start sm:w-[22vw] md:w-[18vw] lg:w-[13.5vw] xl:w-[12rem]"
            >
              <div className="group relative">
                <button
                  type="button"
                  onClick={() => onSelect(entryToMediaItem(entry), entry)}
                  aria-label={`Continue watching ${entry.title}`}
                  className="relative block aspect-[2/3] w-full overflow-hidden rounded-xl bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson"
                >
                  {entry.poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={entry.poster}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
                    />
                  ) : (
                    <span className="grid h-full w-full place-items-center bg-gradient-to-br from-deep-zinc to-black">
                      <PlayCircle className="h-9 w-9 text-white/25" />
                    </span>
                  )}

                  {/* Progress bar along the bottom of the poster. */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 block h-[3px] bg-white/20"
                  >
                    <span
                      className="block h-full bg-crimson shadow-glow"
                      style={{ width: `${Math.round(entry.progress * 100)}%` }}
                    />
                  </span>

                  <span className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-crimson shadow-glow">
                      <PlayCircle className="h-6 w-6 fill-white text-white" />
                    </span>
                  </span>
                </button>

                {/*
                  Removing an entry is a deliberate action, so the X only appears
                  on hover/focus rather than sitting on every poster permanently.
                */}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeProgress(entry.key);
                    load();
                  }}
                  aria-label={`Remove ${entry.title} from Continue Watching`}
                  className="absolute -right-1.5 -top-1.5 z-10 grid h-7 w-7 place-items-center rounded-full border border-white/20 bg-obsidian/90 text-white/80 opacity-0 backdrop-blur-md transition-all hover:border-crimson hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <p className="mt-2 truncate text-xs font-semibold text-white/85">
                {entry.title}
              </p>
              <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-widest text-white/40">
                {entry.kind === 'tv' && entry.episodeLabel
                  ? entry.episodeLabel
                  : `${Math.round(entry.progress * 100)}% watched`}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Rebuilds a catalogue item from a stored entry. */
function entryToMediaItem(entry: WatchEntry): MediaItem {
  return {
    id: entry.id,
    kind: entry.kind,
    title: entry.title,
    overview: '',
    poster: entry.poster,
    backdrop: entry.poster,
    rating: 0,
    year: '',
    genres: [],
    popularity: 0,
  };
}