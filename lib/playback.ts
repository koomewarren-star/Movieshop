/**
 * Playback provider selection.
 *
 * Four providers sit behind one interface so they can be switched:
 *
 *   nexstream — the NexStream embed (`api.codespecters.com`). Plays the real
 *     title, but the provider injects ad networks, force-requires AdSense
 *     (it refuses to play if ad-blocking is detected) and gates playback
 *     behind a human-verification challenge. Nothing can be done about those
 *     from this side of the embed.
 *
 *   vidsrc — VidSrc v2 embed. Primary fallback, no API key required.
 *
 *   autoembed — AutoEmbed alternative stream. No API key required.
 *
 *   cc — openly-licensed footage from `lib/cc-sources.ts`. No ads, no
 *     challenge, no third-party calls. It does NOT play the browsed title, so
 *     the player labels what is actually on screen.
 *
 * The comparison is only meaningful if each path says what it is, so the
 * player surfaces the active provider and, for `cc`, the real footage credit.
 *
 * Default comes from NEXT_PUBLIC_PLAYBACK_PROVIDER, and the viewer can
 * override it in the player header; the choice persists.
 */

import { resolveCcSource, type CcSource } from './cc-sources';
import { movieEmbedUrl, tvEmbedUrl, NEXSTREAM_KEY } from './nexstream';
import type { MediaItem, MediaKind } from './types';

/**
 * A single server: AutoEmbed, presented as MovieShop.
 *
 * The other embeds (NexStream, VidSrc) are still resolvable so old saved
 * preferences do not break, but they are no longer offered in the player. One
 * provider means one thing to debug and one label for the viewer to recognise.
 *
 * The `autoembed` id is kept as the internal key because it is what appears in
 * `movieshop:provider` in localStorage and in NEXT_PUBLIC_PLAYBACK_PROVIDER.
 * Renaming the id would silently orphan every returning viewer's saved choice.
 */
export type ProviderId = 'autoembed' | 'nexstream' | 'vidsrc' | 'cc';

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  autoembed: 'MovieShop',
  nexstream: 'MovieShop',
  vidsrc: 'MovieShop',
  cc: 'MovieShop',
};

export const PROVIDER_STORAGE_KEY = 'movieshop:provider';

/**
 * Display order in the player's server tab bar.
 *
 * One entry, so the tab bar shows a single "MovieShop" server rather than a
 * row of third-party provider names.
 */
export const PROVIDER_ORDER: ProviderId[] = ['autoembed'];

/** Tooltips shown on hover. */
export const PROVIDER_NOTES: Record<ProviderId, string> = {
  autoembed: 'Streaming via MovieShop',
  nexstream: 'Streaming via MovieShop',
  vidsrc: 'Streaming via MovieShop',
  cc: 'Streaming via MovieShop',
};

export const DEFAULT_PROVIDER: ProviderId = 'autoembed';

/**
 * Accepts the retired provider ids on purpose.
 *
 * A viewer who previously chose NexStream has that stored in localStorage. If
 * this rejected the old value it would fall through to `null`, and the player
 * would render with no provider selected. Accepting and aliasing it to
 * autoembed keeps those sessions working without a migration.
 */
export function isProviderId(value: unknown): value is ProviderId {
  return (
    value === 'autoembed' || value === 'nexstream' || value === 'vidsrc' || value === 'cc'
  );
}

export interface ResolvedPlayback {
  provider: ProviderId;
  /** For `nexstream`: the embed URL. For `cc`: the manifest or file URL. */
  url: string;
  /** hls.js is required for the cc HLS entries; false for MP4 and embeds. */
  hls: boolean;
  /** Title of the footage actually on screen — may differ from the browsed title. */
  playingTitle: string;
  /** Attribution line. Always shown for cc; null when there is nothing to credit. */
  credit: string | null;
  /** True when the footage is a substitute rather than the browsed title. */
  isSubstitute: boolean;
  quality: string | null;
  /** The browsed title, for contrast with `playingTitle`. */
  requestedTitle: string;
}

export function resolvePlayback(
  provider: ProviderId,
  item: MediaItem,
  season = 1,
  episode = 1,
): ResolvedPlayback {
  if (provider === 'nexstream') {
    return {
      provider,
      url:
        item.kind === 'movie'
          ? movieEmbedUrl(item)
          : tvEmbedUrl(item.id, season, episode),
      hls: false,
      playingTitle: item.title,
      credit: null,
      isSubstitute: false,
      quality: null,
      requestedTitle: item.title,
    };
  }

  if (provider === 'vidsrc') {
    const url =
      item.kind === 'movie'
        ? `https://vidsrc.to/embed/movie/${item.id}`
        : `https://vidsrc.to/embed/tv/${item.id}/${season}/${episode}`;
    return {
      provider,
      url,
      hls: false,
      playingTitle: item.title,
      credit: null,
      isSubstitute: false,
      quality: null,
      requestedTitle: item.title,
    };
  }

  if (provider === 'autoembed') {
    const url =
      item.kind === 'movie'
        ? `https://player.autoembed.co/embed/movie/${item.id}`
        : `https://player.autoembed.co/embed/tv/${item.id}/${season}/${episode}`;
    return {
      provider,
      url,
      hls: false,
      playingTitle: item.title,
      credit: null,
      isSubstitute: false,
      quality: null,
      requestedTitle: item.title,
    };
  }

  /*
    Legacy aliases.
 *
    A returning viewer may still have `nexstream`, `vidsrc` or `cc` saved from a
    previous build. Those now all resolve to the same MovieShop embed, so an old
    saved preference cannot leave the player pointing at a provider the tab bar
    no longer offers - which previously rendered a video surface for a provider
    the viewer had no visible way to select.
  */
  const url =
    item.kind === 'movie'
      ? `https://player.autoembed.co/embed/movie/${item.id}`
      : `https://player.autoembed.co/embed/tv/${item.id}/${season}/${episode}`;

  return {
    provider: 'autoembed',
    url,
    hls: false,
    playingTitle: item.title,
    credit: null,
    isSubstitute: false,
    quality: null,
    requestedTitle: item.title,
  };
}

/** Short description shown in the player's provenance bar. */
export function providerNote(playback: ResolvedPlayback): string {
  return 'Streaming via MovieShop';
}

export { NEXSTREAM_KEY };
export type { MediaKind };
