/**
 * Storage for P2P-downloaded files.
 *
 * Intentionally separate from any other persistence in the app. The P2P
 * downloader is an isolated feature, so its records live under their own key
 * rather than being merged into a shared library — a failure or a cleanup here
 * cannot affect anything else.
 *
 * Backed by idb-keyval, which uses the browser's IndexedDB and therefore works
 * offline and survives reloads with no server involved.
 */

import { get, set } from 'idb-keyval';

const STORE_KEY = 'movieshop:p2p-downloads';

/** How many records to keep before dropping the oldest. */
const MAX_ENTRIES = 20;

export interface P2PDownloadRecord {
  id: string;
  title: string;
  poster?: string;
  blob: Blob;
  sizeMb: number;
  /** True when also written to native storage via Capacitor. */
  alsoOnDevice?: boolean;
  downloadedAt: number;
}

async function read(): Promise<P2PDownloadRecord[]> {
  try {
    const raw = await get<P2PDownloadRecord[]>(STORE_KEY);
    return Array.isArray(raw) ? raw : [];
  } catch {
    // Private mode or a corrupted payload - treat as nothing stored.
    return [];
  }
}

/** Saves a completed download, replacing any existing record with the same id. */
export async function saveMovieOffline(record: P2PDownloadRecord): Promise<void> {
  const entries = await read();
  const index = entries.findIndex((entry) => entry.id === record.id);

  if (index >= 0) {
    entries[index] = record;
  } else {
    entries.unshift(record);
  }

  try {
    await set(STORE_KEY, entries.slice(0, MAX_ENTRIES));
  } catch {
    // Most likely a quota error on a large video. Surfaced to the caller as a
    // failed save rather than silently pretending it worked.
    throw new Error('Could not save to browser storage — storage may be full.');
  }
}

/** All stored P2P downloads, newest first. */
export async function getP2PDownloads(): Promise<P2PDownloadRecord[]> {
  const entries = await read();
  return entries.sort((a, b) => b.downloadedAt - a.downloadedAt);
}

/** Removes a stored download by id. */
export async function deleteMovieOffline(id: string): Promise<void> {
  const entries = await read();
  await set(
    STORE_KEY,
    entries.filter((entry) => entry.id !== id),
  );
}