/**
 * Shared download types and formatting.
 *
 * Deliberately NOT `server-only`, because both the server routes and the
 * `/downloads` client page need these. Putting them behind `server-only` and
 * importing from a client component is a build error - the compiler treats the
 * whole module as server-only the moment it sees the marker, so a shared helper
 * has to live in its own file.
 */

export type MediaKeyKind = 'movie' | 'tv';

export interface SavedDownload {
  id: string;
  key: string;
  tmdb_id: number;
  kind: MediaKeyKind;
  title: string;
  season: number | null;
  episode: number | null;
  poster: string | null;
  file_name: string;
  size_bytes: number | null;
  created_at: string;
}

export interface SaveDescriptor {
  key: string;
  tmdbId: number;
  kind: MediaKeyKind;
  title: string;
  season?: number;
  episode?: number;
  poster?: string | null;
  fileName: string;
  sizeBytes?: number;
}

/** Builds the catalogue key used by the manifest, the API and the table. */
export function downloadKey(
  id: number | string,
  kind: MediaKeyKind,
  season?: number,
  episode?: number,
): string {
  const base = `${kind}:${id}`;
  return kind === 'tv' && season && episode ? `${base}:${season}:${episode}` : base;
}

export function formatBytes(bytes: number | null | undefined): string {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return 'size unknown';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function savedLabel(row: {
  title: string;
  kind: MediaKeyKind;
  season?: number | null;
  episode?: number | null;
}): string {
  if (row.kind !== 'tv' || !row.season || !row.episode) return row.title;
  return `${row.title} - S${row.season} E${row.episode}`;
}