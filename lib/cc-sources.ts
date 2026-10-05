/**
 * Creative Commons playback pool — the "cc" provider.
 *
 * These are openly-licensed films (Blender Foundation open movies and
 * Internet Archive copies), NOT the title the viewer browsed. That
 * distinction is surfaced in the UI: the player shows the real footage title
 * and its credit underneath, because CC BY requires attribution and because a
 * silent substitution would misrepresent what is playing.
 *
 * Purpose: a second provider for A/B comparison that carries no ad load, no
 * captcha, and no third-party network calls. It is a reference/demo path — it
 * does not put the browsed title on screen.
 *
 * To serve real licensed content, set a provider template instead; see
 * `lib/playback.ts`.
 */

export interface CcSource {
  id: string;
  /** Title of the footage that actually plays. */
  title: string;
  src: string;
  hls: boolean;
  /** Rendered under the player. */
  credit: string;
  /** Advertised resolution, for the quality picker. */
  quality: string;
}

const BLENDER = '© Blender Foundation — CC BY';

export const CC_SOURCES: CcSource[] = [
  {
    id: 'steel-hls',
    title: 'Tears of Steel',
    src: 'https://test-streams.mux.dev/tos_ismc/main.m3u8',
    hls: true,
    credit: `Tears of Steel ${BLENDER}, via Mux test streams`,
    quality: 'Adaptive',
  },
  {
    id: 'sintel-mp4',
    title: 'Sintel',
    src: 'https://archive.org/download/Sintel_201809/Sintel.mp4',
    hls: false,
    credit: `Sintel ${BLENDER}, via Internet Archive`,
    quality: '720p',
  },
  {
    id: 'dream-mp4',
    title: 'Elephants Dream',
    // 480p derivative rather than the 1080p original: the original is ~494 MB
    // with its index at the end, so it cannot start until it has downloaded
    // most of itself.
    src: 'https://archive.org/download/ed-1080p-h-264_265_266-aac/outputfile_h264_lossless.mp4-muxed.ia.mp4',
    hls: false,
    credit: `Elephants Dream ${BLENDER}, via Internet Archive`,
    quality: '480p',
  },
  {
    id: 'cosmos-mp4',
    title: 'Cosmos Laundromat',
    src: 'https://archive.org/download/CosmosLaundromatFirstCycle/Cosmos%20Laundromat%20-%20First%20Cycle%20(1080p).mp4',
    hls: false,
    credit: `Cosmos Laundromat ${BLENDER}, via Internet Archive`,
    quality: '1080p',
  },
  {
    id: 'bunny-mp4',
    title: 'Big Buck Bunny',
    src: 'https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4',
    hls: false,
    credit: `Big Buck Bunny ${BLENDER}, via Internet Archive`,
    quality: '720p',
  },
];

/**
 * FNV-1a. Must stay pure and deterministic: a given title has to resolve to the
 * same clip on the server and in the browser, or hydration breaks and the
 * footage changes on every reload.
 */
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}

/** Share of titles served over HLS rather than a progressive file. */
const HLS_WEIGHT = 70;

/**
 * Picks a source deterministically, biased towards HLS.
 *
 * The HLS ladders fetch a small manifest plus short segments, so they start
 * playing quickly. The Internet Archive MP4s are whole films (Sintel alone is
 * ~92 MB) and a slow connection can sit in `readyState 0` long enough to trip
 * any sane stall watchdog. Both paths stay reachable, HLS is just the default.
 */
export function resolveCcSource(seed: string): CcSource {
  const preferHls = hash(`${seed}:transport`) % 100 < HLS_WEIGHT;
  const pool = CC_SOURCES.filter((source) => source.hls === preferHls);
  const fallback = CC_SOURCES.filter((source) => source.hls !== preferHls);
  const candidates = pool.length > 0 ? pool : fallback;
  return candidates[hash(seed) % candidates.length];
}

/** The HLS entries expose a real bitrate ladder; the MP4s are single-rendition. */
export const QUALITY_CHOICES = ['Auto', '1080p', '720p', '480p', '360p'] as const;
