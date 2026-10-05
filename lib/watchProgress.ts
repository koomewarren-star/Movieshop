/**
 * Watch progress, for the Continue Watching row.
 *
 * Stored in localStorage rather than a server-side table because there are no
 * accounts yet. That is a deliberate limitation, not an oversight: progress
 * follows the browser, not the person, so clearing site data or switching
 * devices loses it. When auth lands this becomes a write-through to the account
 * and the read path here becomes a cache.
 *
 * Only titles the viewer actually started are recorded. An unwatched title is
 * not progress, and filling the row with everything they ever opened would be
 * noise.
 */

import type { MediaItem, MediaKind } from './types';

const STORAGE_KEY = 'movieshop:watch-progress';

/** How many titles the row keeps. Beyond this the oldest entries are dropped. */
export const MAX_ENTRIES = 12;

/** Below this a title counts as barely started, so the row is not littered. */
const MIN_PROGRESS = 0.01;

/** At or above this the title is finished and leaves the row. */
const COMPLETE_AT = 0.95;

export interface WatchEntry {
  /** `kind:id`, so a film and a series sharing a numeric id stay distinct. */
  key: string;
  id: number;
  kind: MediaKind;
  title: string;
  poster: string | null;
  /** 0..1 */
  progress: number;
  /** Epoch ms, used to order the row most-recent-first. */
  updatedAt: number;
  /** Series only. */
  season?: number;
  episode?: number;
  episodeLabel?: string;
}

export function entryKey(kind: MediaKind, id: number, season?: number, episode?: number): string {
  if (kind === 'tv') return `tv:${id}:s${season ?? 1}e${episode ?? 1}`;
  return `movie:${id}`;
}

function read(): WatchEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as WatchEntry[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Private mode or corrupted payload - treat as nothing watched.
    return [];
  }
}

function write(entries: WatchEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Quota or private mode - progress is a convenience, never load-bearing.
  }
}

/**
 * Records progress for a title.
 *
 * Finished titles are removed rather than stored as 100%, so a viewer who
 * watches something through does not keep seeing it in Continue Watching.
 */
export function recordProgress(
  item: Pick<MediaItem, 'id' | 'kind' | 'title' | 'poster'>,
  progress: number,
  extra: { season?: number; episode?: number; episodeLabel?: string } = {},
): void {
  const clamped = Math.max(0, Math.min(1, progress));
  if (clamped < MIN_PROGRESS) return;

  const key = entryKey(item.kind, item.id, extra.season, extra.episode);
  const entries = read().filter((entry) => entry.key !== key);

  if (clamped >= COMPLETE_AT) {
    write(entries);
    return;
  }

  entries.unshift({
    key,
    id: item.id,
    kind: item.kind,
    title: item.title,
    poster: item.poster,
    progress: clamped,
    updatedAt: Date.now(),
    ...extra,
  });

  write(entries.slice(0, MAX_ENTRIES));
}

/** All in-progress titles, most recent first. */
export function getContinueWatching(): WatchEntry[] {
  return read()
    .filter((entry) => entry.progress >= MIN_PROGRESS && entry.progress < COMPLETE_AT)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Forgets a single title, e.g. when the viewer removes it from the row. */
export function removeProgress(key: string): void {
  write(read().filter((entry) => entry.key !== key));
}

/** Clears all progress. */
export function clearProgress(): void {
  write([]);
}

/** Rehydrates a stored entry back into a catalogue item for the player. */
export function entryToItem(entry: WatchEntry): MediaItem {
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