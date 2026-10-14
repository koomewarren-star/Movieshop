import { promises as fs } from 'node:fs';
import path from 'node:path';
import 'server-only';

/**
 * Server-side media catalogue and file streaming.
 *
 * Files live in `storage/media/`, outside `public/`, so Next never serves them
 * as static assets. The only way to reach one is the `/api/media` route, which
 * requires a Supabase session. That is the point: with the files in `public/`
 * and a published manifest, anyone who guessed or scraped a filename could pull
 * a full film without ever signing in.
 *
 * The catalogue is read from disk rather than a database. It is a small JSON
 * file, it changes only when someone adds a film, and it must be readable
 * before a viewer is known - the route checks the session first and the
 * catalogue second.
 */

const MEDIA_DIR = path.join(process.cwd(), 'storage', 'media');
const MANIFEST_PATH = path.join(MEDIA_DIR, 'manifest.json');

export interface CatalogEntry {
  fileName: string;
  title?: string;
}

type Catalog = Record<string, CatalogEntry>;

let cache: Catalog | null = null;

/**
 * Resolves a bare filename to an absolute path inside the media directory.
 *
 * Traversal is blocked twice over: the name is rejected if it contains a parent
 * segment, a separator or a leading slash, and the resolved path is then
 * confirmed to still sit inside MEDIA_DIR. Either check alone would be
 * sufficient; both together mean a mistake in one is not a vulnerability.
 */
function resolveInsideMedia(fileName: string): string | null {
  if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    return null;
  }
  const resolved = path.resolve(MEDIA_DIR, fileName);
  const root = path.resolve(MEDIA_DIR);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

/** The catalogue, or an empty one if it is missing or malformed. */
export async function loadCatalog(): Promise<Catalog> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(MANIFEST_PATH, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    cache = parsed && typeof parsed === 'object' ? (parsed as Catalog) : {};
  } catch {
    cache = {};
  }
  return cache;
}

/** Test seam: drops the in-process cache so an edited manifest is picked up. */
export function resetCatalog(): void {
  cache = null;
}

/**
 * Full path to a media file, or null when it is not in the catalogue or is
 * missing from disk. The catalogue is the authority: a file sitting in the
 * directory but absent from the manifest is not downloadable.
 */
export async function mediaFilePath(fileName: string): Promise<string | null> {
  const catalog = await loadCatalog();
  const known = Object.values(catalog).some((entry) => entry.fileName === fileName);
  if (!known) return null;

  const resolved = resolveInsideMedia(fileName);
  if (!resolved) return null;

  try {
    const stat = await fs.stat(resolved);
    if (!stat.isFile()) return null;
    return resolved;
  } catch {
    return null;
  }
}

/** Size in bytes, for the Range maths. */
export async function mediaFileSize(filePath: string): Promise<number> {
  const stat = await fs.stat(filePath);
  return stat.size;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
};

export function mediaMimeType(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  const ext = dot > -1 ? fileName.slice(dot).toLowerCase() : '';
  return MIME_BY_EXTENSION[ext] ?? 'application/octet-stream';
}

/**
 * Parses a single-range `Range: bytes=a-b` header.
 *
 * Video playback depends on this: without range support a browser cannot seek,
 * and Safari refuses to play a progressive download at all. Multi-range
 * requests are deliberately not honoured - no mainstream player sends them for
 * progressive media, and honouring them properly is a lot of machinery for no
 * real benefit. A multi-range request falls through to the whole file.
 */
export function parseRange(header: string | null, size: number): { start: number; end: number } | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  if (rawStart === '' && rawEnd === '') return null;

  let start: number;
  let end: number;

  if (rawStart === '') {
    // Suffix form: the last N bytes.
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === '' ? size - 1 : Number(rawEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  }

  if (start > end || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

/**
 * Opens a read stream for a byte range.
 *
 * Returns a Node readable, which Next accepts directly as a Response body. The
 * file descriptor is closed when the stream ends, and closing it twice is
 * harmless, so the aborted-response case cannot leak one.
 */
export function createMediaStream(filePath: string, start: number, end: number) {
  return fs.open(filePath, 'r').then((handle) => {
    const stream = handle.createReadStream({ start, end });
    stream.on('close', () => {
      void handle.close().catch(() => undefined);
    });
    return stream;
  });
}