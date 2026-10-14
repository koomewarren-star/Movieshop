/**
 * Client-side view of the download catalogue.
 *
 * The catalogue itself lives in `storage/media/manifest.json` and is never
 * served: it maps keys to real filenames, and publishing that would let anyone
 * enumerate the library without signing in. What the browser gets instead is a
 * list of which titles are downloadable, from /api/catalog. That is harmless
 * metadata - the titles are public via TMDB anyway - and it is enough for the
 * Save button to decide whether to render itself.
 *
 * The filename is resolved server-side when saving, so the client never needs
 * to know or send it.
 */

/** Series are keyed per episode; films have no season or episode. */
export type MediaKeyKind = 'movie' | 'tv';

let available: Promise<Set<string>> | null = null;

/** Every catalogue key, e.g. `movie:969681` or `tv:1396:1:1`. */
export async function listAvailableKeys(): Promise<Set<string>> {
  if (available) return available;

  available = (async () => {
    try {
      const res = await fetch('/api/catalog', { cache: 'no-store' });
      if (!res.ok) return new Set<string>();
      const data = (await res.json()) as { keys?: unknown };
      const keys = Array.isArray(data.keys) ? data.keys : [];
      return new Set(keys.filter((k): k is string => typeof k === 'string'));
    } catch {
      // Offline or the route is unavailable. Nothing is downloadable, which is
      // the safe answer: no button rather than one that fails on click.
      return new Set<string>();
    }
  })();

  return available;
}

/** Drops the cache, so a newly added title is noticed without a hard refresh. */
export function resetCatalogue(): void {
  available = null;
}

/** Builds the catalogue key for a title. */
export function mediaKey(
  id: number | string,
  kind: MediaKeyKind,
  season?: number,
  episode?: number,
): string {
  const base = `${kind}:${id}`;
  return kind === 'tv' && season && episode ? `${base}:${season}:${episode}` : base;
}

/** True when this exact title has a file. */
export async function isDownloadable(
  id: number | string,
  kind: MediaKeyKind,
  season?: number,
  episode?: number,
): Promise<boolean> {
  const keys = await listAvailableKeys();
  return keys.has(mediaKey(id, kind, season, episode));
}