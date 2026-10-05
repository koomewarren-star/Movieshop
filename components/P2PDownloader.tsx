'use client';

/**
 * Isolated P2P file downloader.
 *
 * SCOPE — deliberately narrow. This component is a standalone file fetcher. It
 * does not touch the player, the HLS/DASH pipeline, or any online playback path,
 * and it deliberately does NOT render a video element or stream to one. Files are
 * accumulated in memory and written to storage only once complete.
 *
 * That separation is the point: a background download can run, fail or be
 * cancelled without any possibility of disturbing what the viewer is watching.
 *
 * Why no native dependencies: webtorrent's package.json `browser` field
 * disables every Node-only module (`utp`, `nat-api`, `bittorrent-dht`, `net`,
 * `os`, `http`, `crypto`) and swaps `fs-chunk-store` for `fsa-chunk-store`. In
 * the browser it uses the platform's native WebRTC. Install with
 * `--ignore-scripts`, otherwise npm tries to compile the Node variant and the
 * postinstall is blocked by npm's script policy.
 *
 * Storage backends, chosen at runtime:
 *   - Web:        IndexedDB, via the same idb-keyval store the rest of the app
 *                 uses, so downloads appear alongside everything else.
 *   - Capacitor: @capacitor/filesystem, written to the app's private data
 *                 directory so the OS cannot garbage-collect it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Download, HardDrive, Loader2, Radio, TriangleAlert, X } from 'lucide-react';
import { saveMovieOffline } from '@/lib/p2pStore';

export type P2PPhase =
  | 'idle'
  | 'connecting'
  | 'downloading'
  | 'seeding'
  | 'saving'
  | 'done'
  | 'error';

export interface P2PDownloaderProps {
  /**
   * Magnet URI, supplied by the parent from the title record.
   *
   * Never derived from an env template: a template with a fixed btih would hand
   * the same torrent to every title.
   */
  magnetUri: string;
  /** Title for the saved record and the native filename. */
  title: string;
  /** Stable id, so re-downloading a title replaces rather than duplicates. */
  id: string;
  poster?: string | null;
  className?: string;
}

/**
 * Extracts WebRTC-over-WebSocket trackers from the magnet's `tr=` parameters.
 *
 * Parsed from the incoming magnet rather than hardcoded so each title's own
 * tracker list is honoured. Public defaults are used only when the magnet
 * carries none.
 */
export function trackersFromMagnet(magnet: string): string[] {
  const found: string[] = [];
  for (const match of magnet.matchAll(/[?&]tr=([^&]+)/g)) {
    try {
      const decoded = decodeURIComponent(match[1]);
      if (/^wss?:\/\//i.test(decoded)) found.push(decoded);
    } catch {
      /* malformed tracker parameter, skip it */
    }
  }
  if (found.length > 0) return [...new Set(found)];
  return [
    'wss://tracker.openwebtorrent.com',
    'wss://tracker.webtorrent.io',
    'wss://tracker.btorrent.xyz',
  ];
}

/** Detects a Capacitor runtime. */
function isCapacitor(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      Platform?: { isNative?: () => boolean };
    };
  };
  try {
    return Boolean(
      w.Capacitor?.isNativePlatform?.() || w.Capacitor?.Platform?.isNative?.(),
    );
  } catch {
    return false;
  }
}

/** Blob -> base64 for Capacitor's Filesystem.writeFile. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Could not read blob as base64.'));
        return;
      }
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Blob read failed.'));
    reader.readAsDataURL(blob);
  });
}

/** Filename-safe form of the title. */
function safeName(id: string, title: string): string {
  const slug = title
    .replace(/[^\w\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return `${id}-${slug || 'video'}.mp4`;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export default function P2PDownloader({
  magnetUri,
  title,
  id,
  poster,
  className = '',
}: P2PDownloaderProps) {
  const [phase, setPhase] = useState<P2PPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [peers, setPeers] = useState(0);
  const [downloaded, setDownloaded] = useState(0);
  const [total, setTotal] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [savedWhere, setSavedWhere] = useState<'browser' | 'device' | null>(null);

  const clientRef = useRef<import('webtorrent').default | null>(null);
  const torrentRef = useRef<import('webtorrent').Torrent | null>(null);
  const cancelledRef = useRef(false);

  const teardown = useCallback(() => {
    cancelledRef.current = true;
    try {
      torrentRef.current?.destroy();
    } catch {
      /* already destroyed */
    }
    torrentRef.current = null;
    try {
      clientRef.current?.destroy();
    } catch {
      /* already destroyed */
    }
    clientRef.current = null;
  }, []);

  // Cancel on unmount so a download never outlives the component.
  useEffect(() => () => teardown(), [teardown]);

  const reset = useCallback(() => {
    setPhase('idle');
    setProgress(0);
    setPeers(0);
    setDownloaded(0);
    setTotal(0);
    setSpeed(0);
    setMessage(null);
    setSavedWhere(null);
  }, []);

  /**
   * Starts the swarm.
   *
   * WebTorrent is imported lazily so it never enters the server render path — it
   * touches `window` at module scope, which would break SSR.
   */
  const start = useCallback(async () => {
    if (!magnetUri || !magnetUri.startsWith('magnet:')) {
      setPhase('error');
      setMessage('No magnet URI supplied for this title.');
      return;
    }

    cancelledRef.current = false;
    reset();
    setPhase('connecting');

    try {
      const mod = await import('webtorrent');
      const WebTorrent = mod.default;

      const client = new WebTorrent({
        tracker: {
          // Public STUN keeps the ICE handshake working on most networks. TURN
          // would be needed behind symmetric NAT, which the catalogue can supply
          // via credentials if that proves to be an issue.
          rtcConfig: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
            ],
          },
        },
      });
      clientRef.current = client;

      client.on('error', (err: Error) => {
        if (cancelledRef.current) return;
        setPhase('error');
        setMessage(err.message || 'Could not start the swarm.');
      });

      // Trackers come from the magnet itself.
      client.add(magnetUri, { announce: trackersFromMagnet(magnetUri) }, (torrent) => {
        if (cancelledRef.current) {
          torrent.destroy();
          return;
        }
        torrentRef.current = torrent;

        const file = torrent.files.reduce(
          (best, candidate) => (candidate.length > best.length ? candidate : best),
          torrent.files[0],
        );
        if (!file) {
          setPhase('error');
          setMessage('This torrent contains no playable file.');
          return;
        }

        setPhase('downloading');
        setTotal(file.length);

        const tick = setInterval(() => {
          if (cancelledRef.current) {
            clearInterval(tick);
            return;
          }
          setProgress(Math.round(torrent.progress * 100));
          setDownloaded(torrent.downloaded);
          setPeers(torrent.numPeers);
          setSpeed(torrent.downloadSpeed);
          if (torrent.done) {
            clearInterval(tick);
            setPhase('seeding');
          }
        }, 500);

        torrent.on('done', () => {
          clearInterval(tick);
          setProgress(100);
          setDownloaded(torrent.total);
          setPhase('seeding');
        });

        torrent.on('error', (err: Error) => {
          clearInterval(tick);
          if (cancelledRef.current) return;
          setPhase('error');
          setMessage(err.message || 'Torrent error.');
        });

        torrent.on('warning', (err: Error) => {
          // Warnings are non-fatal (e.g. a tracker being unreachable) so they
          // surface as a note rather than replacing the progress display.
          setMessage(err.message || 'Swarm warning.');
        });
      });
    } catch (error) {
      setPhase('error');
      setMessage(error instanceof Error ? error.message : 'Could not load WebTorrent.');
    }
  }, [magnetUri, reset]);

  /**
   * Writes the completed file to storage.
   *
   * Only ever called once the torrent reports done, so nothing is persisted
   * while incomplete and there is no partial file to clean up later.
   */
  const save = useCallback(async () => {
    const torrent = torrentRef.current;
    if (!torrent || !torrent.done) {
      setPhase('error');
      setMessage('Wait for the download to finish before saving.');
      return;
    }

    setPhase('saving');
    setMessage(null);

    try {
      const file = torrent.files.reduce(
        (best, candidate) => (candidate.length > best.length ? candidate : best),
        torrent.files[0],
      );
      if (!file) throw new Error('No file in torrent.');

      // Assembled fully in memory by getBlob, then handed straight to storage.
      const blob: Blob = await new Promise((resolve, reject) => {
        file.getBlob((err, result) => (err ? reject(err) : resolve(result as Blob)));
      });

      let where: 'browser' | 'device' = 'browser';

      if (isCapacitor()) {
        const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
        await Filesystem.writeFile({
          path: safeName(id, title),
          data: await blobToBase64(blob),
          directory: Directory.Data,
          encoding: Encoding.UTF8,
          recursive: true,
        });
        where = 'device';
      }

      await saveMovieOffline({
        id,
        title,
        poster: poster ?? undefined,
        blob,
        sizeMb: Math.round((blob.size / (1024 * 1024)) * 10) / 10,
        downloadedAt: Date.now(),
      });

      setSavedWhere(where);
      setPhase('done');
    } catch (error) {
      setPhase('error');
      setMessage(error instanceof Error ? error.message : 'Could not save the file.');
    }
  }, [id, title, poster]);

  const cancel = useCallback(() => {
    teardown();
    reset();
  }, [teardown, reset]);

  const busy = phase === 'connecting' || phase === 'downloading' || phase === 'saving';
  const progressLabel = phase === 'connecting' ? 'Connecting…' : phase === 'downloading' || phase === 'seeding' ? `${progress}%` : 'Download';

  return (
    <div className={`relative flex flex-col gap-2 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={start}
          disabled={busy}
          aria-label={`Download ${title} over P2P`}
          title={magnetUri ? 'Download from the peer swarm' : 'No magnet for this title'}
          className="inline-flex items-center gap-1.5 rounded-lg border border-crimson/40 bg-crimson/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-crimson-bright transition-all hover:bg-crimson/20 hover:shadow-glow disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Radio className="h-3 w-3" />}
          {progressLabel}
        </button>

        <button
          type="button"
          onClick={save}
          disabled={!torrentRef.current?.done || busy}
          aria-label={`Save ${title} to storage`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70 transition-all hover:border-crimson/50 hover:bg-crimson/10 hover:text-white disabled:pointer-events-none disabled:opacity-30"
        >
          {phase === 'saving' ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : phase === 'done' ? (
            <Check className="h-3 w-3 text-emerald-400" />
          ) : (
            <HardDrive className="h-3 w-3" />
          )}
          {phase === 'saving' ? 'Saving…' : phase === 'done' ? 'Saved' : 'Save'}
        </button>

        {(busy || phase === 'seeding') && (
          <button
            type="button"
            onClick={cancel}
            aria-label={`Cancel download of ${title}`}
            className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 text-white/60 transition-colors hover:border-red-500/50 hover:text-red-400"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Lightweight stats, no video surface. */}
      {(phase === 'downloading' || phase === 'seeding') && (
        <div className="flex flex-col gap-1">
          <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-white/10">
            <span
              className="block h-full bg-crimson transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </span>
          <span className="flex flex-wrap gap-x-3 text-[10px] font-semibold uppercase tracking-widest text-white/40">
            <span>{progress}%</span>
            <span>
              {formatBytes(downloaded)}
              {total > 0 ? ` / ${formatBytes(total)}` : ''}
            </span>
            {speed > 0 && <span>{formatBytes(speed)}/s</span>}
            <span>
              {peers} peer{peers === 1 ? '' : 's'}
            </span>
          </span>
        </div>
      )}

      {phase === 'done' && (
        <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
          Saved to {savedWhere === 'device' ? 'device storage' : 'browser storage'}
        </span>
      )}

      {phase === 'error' && message && (
        <span className="flex items-start gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-red-300">
          <TriangleAlert className="mt-px h-3 w-3 shrink-0" />
          {message}
        </span>
      )}
    </div>
  );
}