export type MediaKind = 'movie' | 'tv';

export interface MediaItem {
  id: number;
  kind: MediaKind;
  title: string;
  overview: string;
  poster: string | null;
  backdrop: string | null;
  /** TMDB vote_average on a 0-10 scale. */
  rating: number;
  /** Four-digit year string, or "—" when TMDB has no date. */
  year: string;
  genres: string[];
  popularity: number;
  trending?: boolean;
  /** YouTube key for the official trailer, when TMDB has one. */
  trailerKey?: string | null;
  /**
   * WebRTC magnet URI for the P2P downloader.
   *
   * Populated from your own catalogue record, not TMDB — TMDB has no knowledge of
   * torrents. Absent for any title without a catalogue entry, which is why the
   * download button renders disabled rather than failing on click.
   */
  magnetUri?: string | null;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile: string | null;
}

export interface MediaDetails extends MediaItem {
  tagline: string | null;
  /** Human-readable runtime, e.g. "2h 46m". */
  runtime: string | null;
  cast: CastMember[];
  numberOfSeasons: number | null;
}

export interface MediaRow {
  id: string;
  emoji: string;
  title: string;
  items: MediaItem[];
  /**
   * True when TMDB has further pages for this row, i.e. the client should
   * request /api/row as the viewer scrolls. Replaces shipping the whole row in
   * the initial payload.
   */
  hasMore?: boolean;
  /** Next page to request. Rows are 1-indexed, matching TMDB. */
  nextPage?: number;
}

export interface SearchHit {
  id: number;
  kind: MediaKind;
  title: string;
  year: string;
  poster: string | null;
  rating: number;
}

export interface HomeData {
  hero: MediaItem[];
  reels: MediaItem[];
  rows: MediaRow[];
  /**
   * Metadata for rows beyond first paint, so the client can render their
   * headings immediately and fill them from /api/row on approach. This is what
   * makes the catalogue larger without a larger initial document.
   */
  allRows?: Array<{ id: string; emoji: string; title: string }>;
  source: 'tmdb' | 'demo';
}
