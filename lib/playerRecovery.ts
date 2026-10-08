import type { MediaItem, MediaKind } from './types';

/**
 * Recovery state for an interrupted player session.
 *
 * If the upstream embed navigates the tab, the viewer lands on a third-party
 * page and this app is reloaded fresh with the modal gone and nothing on
 * screen. Storing the intended title lets the app put the player back on the
 * next load instead of dropping the viewer on the home page with no context.
 *
 * `sessionStorage`, not `localStorage`, deliberately:
 *
 *   - It is scoped to the tab, so a recovery never resurfaces in a different
 *     tab the next day.
 *   - It is cleared when the tab closes, so a stale intent cannot sit around
 *     indefinitely and surprise someone later.
 *   - It is not shared with the rest of the app's persistence (watch progress,
 *     provider choice), so this cannot interfere with those.
 *
 * Only the fields needed to rebuild the player shell are stored. Nothing here
 * is sensitive and none of it is a stream URL - the embed URL is derived from
 * the id at render time.
 */

const KEY = 'movieshop:pending-playback';

export interface PendingPlayback {
  id: number;
  kind: MediaKind;
  title: string;
  poster: string | null;
  backdrop: string | null;
  year: string;
  rating: number;
  season: number;
  episode: number;
  /** Epoch ms, so an intent from hours ago can be discarded rather than restored. */
  at: number;
}

/** Intents older than this are discarded instead of restored. */
const MAX_AGE_MS = 30 * 60 * 1000;

export function savePendingPlayback(
  item: MediaItem,
  season = 1,
  episode = 1,
): PendingPlayback | null {
  const record: PendingPlayback = {
    id: item.id,
    kind: item.kind,
    title: item.title,
    poster: item.poster,
    backdrop: item.backdrop,
    year: item.year,
    rating: item.rating,
    season,
    episode,
    at: Date.now(),
  };

  try {
    sessionStorage.setItem(KEY, JSON.stringify(record));
    return record;
  } catch {
    // Private mode or a full quota. Recovery is a convenience, never a
    // requirement, so a failure here is deliberately silent.
    return null;
  }
}

export function readPendingPlayback(): PendingPlayback | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingPlayback;
    if (!parsed || typeof parsed.id !== 'number' || typeof parsed.kind !== 'string') {
      clearPendingPlayback();
      return null;
    }
    if (Date.now() - parsed.at > MAX_AGE_MS) {
      clearPendingPlayback();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingPlayback() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* non-fatal */
  }
}

/**
 * Rebuilds a renderable MediaItem from a stored intent.
 *
 * Metadata fields that were not stored are filled with neutral placeholders
 * rather than fetched. The player only needs the id, kind, title and season to
 * build the embed URL; the details modal behind it is not opened by recovery,
 * so an incomplete record is acceptable and avoids a network round trip during
 * what may already be a degraded moment.
 */
export function pendingToMediaItem(record: PendingPlayback): MediaItem {
  return {
    id: record.id,
    kind: record.kind,
    title: record.title,
    overview: '',
    poster: record.poster,
    backdrop: record.backdrop,
    rating: record.rating,
    year: record.year,
    genres: [],
    popularity: 0,
  };
}