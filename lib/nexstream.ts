import type { MediaItem, MediaKind } from './types';

const NEXSTREAM_BASE = 'https://api.codespecters.com/embed';
const FALLBACK_KEY = 'DEMO_36bed89b';

export const NEXSTREAM_KEY =
  process.env.NEXT_PUBLIC_NEXSTREAM_KEY?.trim() || FALLBACK_KEY;

export interface EpisodeRef {
  season: number;
  episode: number;
}

/**
 * Builds a NexStream embed URL.
 *
 *   movie: /embed/movie/{tmdbId}?apikey={key}
 *   tv:    /embed/tv/{tmdbId}/{season}/{episode}?apikey={key}
 */
export function nexstreamUrl(
  kind: MediaKind,
  tmdbId: number,
  key: string = NEXSTREAM_KEY,
  episode?: EpisodeRef,
): string {
  if (kind === 'movie') {
    return `${NEXSTREAM_BASE}/movie/${tmdbId}?apikey=${key}`;
  }
  const season = episode?.season ?? 1;
  const number = episode?.episode ?? 1;
  return `${NEXSTREAM_BASE}/tv/${tmdbId}/${season}/${number}?apikey=${key}`;
}

export function movieEmbedUrl(item: MediaItem, key?: string): string {
  return nexstreamUrl('movie', item.id, key);
}

export function tvEmbedUrl(
  tmdbId: number,
  season: number,
  episode: number,
  key?: string,
): string {
  return nexstreamUrl('tv', tmdbId, key, { season, episode });
}

/** Muted, looping, autoplay-capable embed used by the trailer reels. */
export function trailerEmbedUrl(key: string, autoplay: boolean): string {
  const params = new URLSearchParams({
    autoplay: autoplay ? '1' : '0',
    mute: '1',
    controls: '0',
    modestbranding: '1',
    rel: '0',
    playsinline: '1',
    loop: '1',
    playlist: key,
  });
  return `https://www.youtube.com/embed/${key}?${params.toString()}`;
}
