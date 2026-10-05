/**
 * Type declarations for webtorrent.
 *
 * The package ships no .d.ts and @types/webtorrent is unmaintained and
 * inaccurate for the 3.x line. These cover only what P2PDownloader uses, so the
 * surface stays honest instead of falling back to `any` everywhere.
 */

declare module 'webtorrent' {
  interface TorrentFile {
    name: string;
    length: number;
    path: string;
    /** Resolves with the complete file once every piece has arrived. */
    getBlob(callback: (err: Error | null, blob?: Blob) => void): void;
  }

  interface TorrentOptions {
    /** Tracker announce URLs, including wss:// WebRTC trackers. */
    announce?: string[];
    path?: string;
    store?: unknown;
  }

  interface Torrent {
    infoHash: string;
    magnetURI: string;
    name: string;
    files: TorrentFile[];
    /** 0..1 */
    progress: number;
    downloaded: number;
    total: number;
    /** Bytes per second. */
    downloadSpeed: number;
    uploadSpeed: number;
    /** True once every piece is present. */
    done: boolean;
    numPeers: number;
    timeRemaining: number;
    destroy(callback?: (err?: Error) => void): void;
    on(event: 'done', callback: () => void): void;
    on(event: 'error', callback: (err: Error) => void): void;
    on(event: 'warning', callback: (err: Error) => void): void;
    on(event: string, callback: (...args: unknown[]) => void): void;
  }

  interface ClientOptions {
    tracker?: {
      rtcConfig?: {
        iceServers?: Array<{ urls: string | string[] }>;
      };
    };
  }

  export default class WebTorrent {
    constructor(options?: ClientOptions);
    add(
      uri: string,
      options?: TorrentOptions,
      callback?: (torrent: Torrent) => void,
    ): Torrent;
    remove(uri: string, callback?: (err?: Error) => void): void;
    destroy(callback?: (err?: Error) => void): void;
    on(event: 'error', callback: (err: Error) => void): void;
    on(event: 'warning', callback: (err: Error) => void): void;
    on(event: string, callback: (...args: unknown[]) => void): void;
  }
}