import {
  ROW_DEFS,
  ROW_INITIAL,
  VISIBLE_ROWS,
  getRowDef,
  resolveParams,
} from './rows';
import type {
  CastMember,
  HomeData,
  MediaDetails,
  MediaItem,
  MediaKind,
  MediaRow,
  SearchHit,
} from './types';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p';

/**
 * Keys are read server-side. The v3 key is also exposed as
 * NEXT_PUBLIC_TMDB_API_KEY per the spec, but nothing in this module runs in the
 * browser — the API routes proxy instead, so the key never reaches the bundle.
 */
const API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY?.trim() ?? '';
const BEARER = process.env.TMDB_BEARER_TOKEN?.trim() ?? '';

export const HAS_TMDB_KEY = API_KEY.length > 0 || BEARER.length > 0;

const GENRE_NAMES: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
  10759: 'Action & Adventure',
  10765: 'Sci-Fi & Fantasy',
};

/* ------------------------------------------------------------------ *
 * Raw TMDB payload shapes (only the fields we consume)
 * ------------------------------------------------------------------ */
interface TmdbListItem {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  runtime?: number;
  episode_run_time?: number[];
  genre_ids?: number[];
  popularity?: number;
}

interface TmdbListResponse<T = TmdbListItem> {
  results: T[];
  total_pages: number;
  total_results: number;
}

interface TmdbCredits {
  cast?: Array<{
    id: number;
    name: string;
    character?: string;
    profile_path?: string | null;
  }>;
}

interface TmdbVideos {
  results?: Array<{ site: string; key: string; type: string; official?: boolean }>;
}

interface TmdbDetailResponse extends TmdbListItem {
  tagline?: string | null;
  genres?: Array<{ id: number; name: string }>;
  number_of_seasons?: number;
}

/* ------------------------------------------------------------------ *
 * Fetch plumbing
 * ------------------------------------------------------------------ */
async function tmdbFetch<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
  attempt = 0,
): Promise<T | null> {
  if (!HAS_TMDB_KEY) return null;

  const search = new URLSearchParams();
  if (BEARER) {
    search.set('language', 'en-US');
  } else {
    search.set('api_key', API_KEY);
  }
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }

  const headers: Record<string, string> = { accept: 'application/json' };
  if (BEARER) headers.Authorization = `Bearer ${BEARER}`;

  // Callers pass paths inconsistently (some leading slash, some not), so
  // normalise here rather than relying on every call site.
  const suffix = path.startsWith('/') ? path : `/${path}`;

  try {
    const res = await fetch(`${TMDB_BASE}${suffix}?${search.toString()}`, {
      headers,
      next: { revalidate: 60 * 30 },
    });

    if (!res.ok) {
      // getHomeData fans out a dozen requests at once, so an isolated 429 or
      // 5xx would otherwise silently empty a whole discovery row. Back off and
      // retry before giving up.
      const transient = res.status === 429 || res.status >= 500;
      if (transient && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 350 * 2 ** attempt));
        return tmdbFetch<T>(path, params, attempt + 1);
      }
      return null;
    }

    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const img = (path: string | null | undefined, size: string): string | null =>
  path ? `${IMG_BASE}/${size}${path}` : null;

/**
 * Resolves the P2P magnet URI for a title.
 *
 * TMDB knows nothing about torrents, so this reads your own catalogue instead.
 * Two sources, in order:
 *
 *   1. A manifest file at MAGNET_MANIFEST_URL, mapping `kind:id` -> magnet.
 *      Fetched once per process and cached, so it costs one request rather than
 *      one per title.
 *   2. A template in MAGNET_TEMPLATE, for catalogues stored by convention.
 *
 * Returns null when neither is configured, which is what disables the download
 * button rather than surfacing a broken download.
 */
let manifestCache: Map<string, string> | null = null;

async function loadMagnetManifest(): Promise<Map<string, string>> {
  if (manifestCache) return manifestCache;
  manifestCache = new Map();

  const url = (process.env.MAGNET_MANIFEST_URL ?? '').trim();
  if (!url) return manifestCache;

  try {
    let body: Record<string, string>;

    if (url.startsWith('/')) {
      /*
       * Local manifest. A relative URL cannot be fetched server-side - `fetch`
       * has no origin to resolve it against - so it is read from disk instead.
       * This also means the manifest ships to the browser, which is acceptable
       * here because a magnet URI contains no secret; swap to an absolute URL
       * if that ever stops being true.
       */
      const { readFile } = await import('fs/promises');
      const { join } = await import('path');
      const raw = await readFile(join(process.cwd(), 'public', url), 'utf8');
      body = JSON.parse(raw) as Record<string, string>;
    } else {
      const res = await fetch(url, { next: { revalidate: 60 * 60 } });
      if (!res.ok) return manifestCache;
      body = (await res.json()) as Record<string, string>;
    }

    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string' && value.startsWith('magnet:')) {
        manifestCache.set(key.toLowerCase(), value);
      }
    }
  } catch {
    // A missing or unreachable manifest simply means no P2P downloads.
  }
  return manifestCache;
}

/**
 * Synchronous magnet lookup.
 *
 * Called from the item mapper, which is synchronous by design because it runs
 * inside `.map()` over TMDB results. The manifest is therefore populated
 * asynchronously beforehand and read from cache here; until it arrives the
 * button stays disabled rather than guessing.
 */
function magnetFor(id: number, kind: MediaKind): string | null {
  const key = `${kind}:${id}`;
  // Looked up lowercased to match the normalisation applied on load.
  const cached = manifestCache?.get(key.toLowerCase());
  if (cached) return cached;

  const template = (process.env.MAGNET_TEMPLATE ?? '').trim();
  if (!template) return null;

  return (
    template
      .replace(/\{id\}/g, String(id))
      .replace(/\{kind\}/g, kind)
      // wss tracker required for a browser swarm to find peers.
      .replace(
        /\{tracker\}/g,
        encodeURIComponent(process.env.MAGNET_TRACKER ?? 'wss://tracker.openwebtorrent.com'),
      ) || null
  );
}

const yearOf = (date?: string): string => (date?.slice(0, 4) || '—');

function runtimeLabel(minutes?: number): string | null {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function toItem(raw: TmdbListItem, kind: MediaKind, trending = false): MediaItem {
  const date = kind === 'movie' ? raw.release_date : raw.first_air_date;
  return {
    id: raw.id,
    kind,
    title: raw.title ?? raw.name ?? 'Untitled',
    overview: raw.overview?.trim() || 'No synopsis available for this title yet.',
    poster: img(raw.poster_path, 'w500'),
    backdrop: img(raw.backdrop_path, 'original') ?? img(raw.poster_path, 'original'),
    rating: Math.round((raw.vote_average ?? 0) * 10) / 10,
    year: yearOf(date),
    magnetUri: magnetFor(raw.id, kind),
    genres: (raw.genre_ids ?? []).slice(0, 3).map((id) => GENRE_NAMES[id] ?? 'Featured'),
    popularity: raw.popularity ?? 0,
    trending,
  };
}

/**
 * Runs `fn` over `items` with at most `limit` in flight.
 *
 * Sequential paging avoided TMDB rate limits but serialised ~35 requests into a
 * multi-second cold start. Bounded concurrency keeps the parallelism without
 * tripping the 429s that previously emptied whole rows.
 */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await fn(items[index]);
      }
    },
  );

  await Promise.all(workers);
  return results;
}

async function listOf(
  path: string,
  kind: MediaKind,
  params: Record<string, string | number | boolean | undefined> = {},
  trending = false,
  pages = 1,
): Promise<MediaItem[]> {
  if (pages <= 1) {
    const data = await tmdbFetch<TmdbListResponse>(path, { ...params, page: 1 });
    if (!data?.results?.length) return [];
    return data.results
      .filter((raw) => raw.poster_path || raw.backdrop_path)
      .map((raw) => toItem(raw, kind, trending));
  }

  const pageNumbers = Array.from({ length: pages }, (_, i) => i + 1);
  const batches = await mapLimit(pageNumbers, 4, (page) =>
    tmdbFetch<TmdbListResponse>(path, { ...params, page }),
  );

  return batches.flatMap((data) =>
    (data?.results ?? [])
      .filter((raw) => raw.poster_path || raw.backdrop_path)
      .map((raw) => toItem(raw, kind, trending)),
  );
}

/** Fetches exactly one page of a TMDB list, for on-demand row paging. */
async function listPage(
  path: string,
  kind: MediaKind,
  params: Record<string, string | number | boolean | undefined>,
  trending = false,
  page: number,
  languages?: string[],
): Promise<MediaItem[]> {
  /*
    A multi-language row is several single-language queries merged together.
    TMDB rejects `with_original_language=ja,ko` outright (zero results), so the
    only way to cover several languages is to ask for each and interleave them.
    Interleaving - rather than appending - keeps all eight languages represented
    near the front of the row instead of burying Japanese at position 41.
  */
  if (languages && languages.length > 0) {
    const seen = new Set<number>();
    const merged: MediaItem[] = [];
    const batches = await Promise.all(
      languages.map((code) =>
        listPage(path, kind, { ...params, with_original_language: code }, trending, page),
      ),
    );
    for (let slot = 0; slot < ROW_INITIAL; slot += 1) {
      for (const batch of batches) {
        const item = batch[slot];
        if (!item || seen.has(item.id)) continue;
        seen.add(item.id);
        merged.push(item);
      }
    }
    return merged.slice(0, ROW_INITIAL);
  }

  const data = await tmdbFetch<TmdbListResponse>(path, { ...params, page });
  if (!data?.results?.length) return [];
  return data.results
    .filter((raw) => raw.poster_path || raw.backdrop_path)
    .map((raw) => toItem(raw, kind, trending));
}

async function trailerKeyFor(id: number, kind: MediaKind): Promise<string | null> {
  const data = await tmdbFetch<TmdbVideos>(`/${kind}/${id}/videos`);
  if (!data?.results?.length) return null;
  const yt = data.results.filter((video) => video.site === 'YouTube');
  const pick =
    yt.find((video) => video.type === 'Trailer' && video.official) ??
    yt.find((video) => video.type === 'Trailer') ??
    yt.find((video) => video.type === 'Teaser') ??
    yt[0];
  return pick?.key ?? null;
}

async function attachTrailers(items: MediaItem[]): Promise<MediaItem[]> {
  return Promise.all(
    items.map(async (item) => ({ ...item, trailerKey: await trailerKeyFor(item.id, item.kind) })),
  );
}

function dedupe(...lists: MediaItem[][]): MediaItem[] {
  const seen = new Set<number>();
  return lists.flat().filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

/* ------------------------------------------------------------------ *
 * Bundled demo catalogue
 *
 * Used only when no TMDB key is configured, so a fresh clone still renders a
 * complete, interactive UI. Ids and trailer keys are real TMDB / YouTube data.
 * ------------------------------------------------------------------ */
const DEMO: Array<{
  id: number;
  kind: MediaKind;
  title: string;
  overview: string;
  rating: number;
  year: string;
  runtime: string;
  poster: string;
  trailer: string | null;
  trending: boolean;
}> = [
  {
    id: 693134, kind: 'movie', title: 'Dune: Part Two',
    overview: 'Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.',
    rating: 8.6, year: '2024', runtime: '2h 46m',
    poster: '/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg', trailer: 'Way9Dexny3w', trending: true,
  },
  {
    id: 872585, kind: 'movie', title: 'Oppenheimer',
    overview: 'The story of J. Robert Oppenheimer and his role in the development of the atomic bomb.',
    rating: 8.4, year: '2023', runtime: '3h 01m',
    poster: '/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg', trailer: 'uYPbbksJxIg', trending: true,
  },
  {
    id: 157336, kind: 'movie', title: 'Interstellar',
    overview: "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.",
    rating: 8.5, year: '2014', runtime: '2h 49m',
    poster: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', trailer: 'zSWdZVtXT7E', trending: true,
  },
  {
    id: 569094, kind: 'movie', title: 'Spider-Man: Across the Spider-Verse',
    overview: 'Miles Morales catapults across the Multiverse, where he encounters a team of Spider-People charged with protecting its existence.',
    rating: 8.5, year: '2023', runtime: '2h 20m',
    poster: '/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg', trailer: 'cqGjhVJWtEg', trending: true,
  },
  {
    id: 414906, kind: 'movie', title: 'The Batman',
    overview: 'In his second year of fighting crime, Batman uncovers corruption in Gotham City while facing a serial killer known as the Riddler.',
    rating: 7.8, year: '2022', runtime: '2h 56m',
    poster: '/74xTEgt7R26FtyUrobn4ISawwKp.jpg', trailer: 'mqqft2x_Aa4', trending: true,
  },
  {
    id: 545611, kind: 'movie', title: 'Everything Everywhere All at Once',
    overview: 'An aging Chinese immigrant is swept up in an insane adventure, where she alone can save the world.',
    rating: 8.0, year: '2022', runtime: '2h 19m',
    poster: '/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg', trailer: 'wxN1T1uxQ2g', trending: true,
  },
  {
    id: 361743, kind: 'movie', title: 'Top Gun: Maverick',
    overview: 'After thirty years of service, Maverick is called back to train a group of graduates for a specialised mission.',
    rating: 8.3, year: '2022', runtime: '2h 11m',
    poster: '/62HCnUTziyWcpDaBO2i1DX17ljH.jpg', trailer: 'qSqVVswa420', trending: true,
  },
  {
    id: 385383, kind: 'movie', title: 'Furiosa: A Mad Max Saga',
    overview: 'The origin story of renegade warrior Furiosa before her encounter and team-up with Mad Max.',
    rating: 8.1, year: '2024', runtime: '2h 29m',
    poster: '/iADOJ8Zymht2JPMoy3R7xceZprc.jpg', trailer: 'ygo9Fs4wlEM', trending: true,
  },
  {
    id: 76600, kind: 'movie', title: 'Avatar: The Way of Water',
    overview: 'The Sully family struggles to adjust to life on Pandaria after the events of the first film.',
    rating: 7.7, year: '2022', runtime: '3h 12m',
    poster: '/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg', trailer: '1df65zTcg-8', trending: false,
  },
  {
    id: 823464, kind: 'movie', title: 'Godzilla x Kong: The New Empire',
    overview: 'Godzilla and Kong must reunite against a colossal undiscovered threat hidden within our world.',
    rating: 7.3, year: '2024', runtime: '1h 55m',
    poster: '/z1p34vh7dEOnLDmyCrlUVLuoDzd.jpg', trailer: 'qqrpMRDuPfc', trending: false,
  },
  {
    id: 27205, kind: 'movie', title: 'Inception',
    overview: 'A thief who steals corporate secrets through dream-sharing technology is given the inverse task of planting an idea.',
    rating: 8.4, year: '2010', runtime: '2h 28m',
    poster: '/9gk7adHYeDvHkCSEqAvQNLV5Oge.jpg', trailer: 'YoHD9XEInc0', trending: false,
  },
  {
    id: 155, kind: 'movie', title: 'The Dark Knight',
    overview: 'Batman raises the stakes in his war on crime with the help of Lt. Jim Gordon and DA Harvey Dent.',
    rating: 8.5, year: '2008', runtime: '2h 32m',
    poster: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg', trailer: 'EXeTwQWrcwY', trending: false,
  },
  {
    id: 94605, kind: 'tv', title: 'Arcane',
    overview: 'Two sisters fight on rival sides of a war between magic technologies and clashing convictions.',
    rating: 9.0, year: '2021', runtime: '41m',
    poster: '/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg', trailer: 'fXmAurh012s', trending: true,
  },
  {
    id: 100088, kind: 'tv', title: 'The Last of Us',
    overview: 'Twenty years after modern civilization has been destroyed, Joel is hired to smuggle Ellie out of an oppressive quarantine zone.',
    rating: 8.7, year: '2023', runtime: '50m',
    poster: '/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg', trailer: 'uLtkt8BonwM', trending: true,
  },
  {
    id: 1396, kind: 'tv', title: 'Breaking Bad',
    overview: 'A high school chemistry teacher turned methamphetamine producer battles a terminal diagnosis.',
    rating: 8.9, year: '2008', runtime: '47m',
    poster: '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg', trailer: 'HhesaQXLuRY', trending: false,
  },
  {
    id: 66732, kind: 'tv', title: 'Stranger Things',
    overview: "When a young boy vanishes, a small town uncovers a mystery involving secret experiments and strange supernatural forces.",
    rating: 8.6, year: '2016', runtime: '50m',
    poster: '/49WJfeN0moxb9IPfGn8AIqMGskD.jpg', trailer: 'b9EkMc79ZSU', trending: false,
  },
  {
    id: 87108, kind: 'tv', title: 'Chernobyl',
    overview: 'A dramatisation of the 1986 nuclear accident and the people who responded to it.',
    rating: 8.7, year: '2019', runtime: '60m',
    poster: '/hlLXt2tOPT6RRnjiUmoxyG1LTFi.jpg', trailer: 's9APLXM9Ei8', trending: false,
  },
  {
    id: 126308, kind: 'tv', title: 'Shōgun',
    overview: 'In Japan in the year 1600, Lord Yoshii Toranaga fights for his life as his enemies unite against him.',
    rating: 8.5, year: '2024', runtime: '59m',
    poster: '/7O4iVfOMQmdCSxhOg1WnzG1AgYT.jpg', trailer: null, trending: false,
  },
];

function demoItems(): MediaItem[] {
  return DEMO.map((entry, index) => ({
    id: entry.id,
    kind: entry.kind,
    title: entry.title,
    overview: entry.overview,
    poster: `${IMG_BASE}/w500${entry.poster}`,
    backdrop: `${IMG_BASE}/original${entry.poster}`,
    rating: entry.rating,
    year: entry.year,
    genres: entry.kind === 'tv' ? ['Animation', 'Drama'] : ['Action', 'Sci-Fi'],
    popularity: 1000 - index * 9,
    trailerKey: entry.trailer,
    trending: entry.trending,
  }));
}

function rotate(items: MediaItem[], start: number, count: number): MediaItem[] {
  return Array.from({ length: count }, (_, i) => items[(start + i) % items.length]);
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */
/**
 * De-duplicates concurrent identical TMDB reads.
 *
 * Essential now that the client pages rows on demand: several rows that scroll
 * into view together can ask for the same page at the same moment, and without
 * this each one becomes its own upstream request and its own chance of a 429.
 */
const inFlight = new Map<string, Promise<MediaItem[]>>();

/**
 * Metadata for every registered row, without any items.
 *
 * The client needs this to render the rows that were not part of first paint:
 * it shows the heading immediately and fills the cards from /api/row, so a much
 * larger catalogue appears without waiting on the server round trip.
 */
export function allRowDefs(): Array<{ id: string; emoji: string; title: string }> {
  return ROW_DEFS.map(({ id, emoji, title }) => ({ id, emoji, title }));
}

/** One page of a discovery row, for /api/row. Shared via `inFlight` dedupe. */
export async function getRowPage(rowId: string, page: number): Promise<MediaItem[]> {
  const def = getRowDef(rowId);
  if (!def || page < 1) return [];

  // Ensure magnet URIs resolve for paged rows too, not just first paint.
  await loadMagnetManifest();

  const cacheKey = `${rowId}:${page}`;
  const existing = inFlight.get(cacheKey);
  if (existing) return existing;

  const task = listPage(
    def.path,
    def.kind,
    resolveParams(def.params),
    def.trending ?? false,
    page,
    def.languages,
  )
    .then((items) => items.slice(0, ROW_INITIAL))
    .finally(() => inFlight.delete(cacheKey));

  inFlight.set(cacheKey, task);
  return task;
}

/** Whether a row has any pages beyond `page`. Cheap: re-reads the same page. */
async function rowHasMore(rowId: string, page: number): Promise<boolean> {
  const def = getRowDef(rowId);
  if (!def) return false;
  const data = await tmdbFetch<TmdbListResponse>(def.path, {
    ...resolveParams(def.params),
    page,
  });
  return (data?.total_pages ?? 0) > page;
}

export async function getHomeData(): Promise<HomeData> {
  // Warm the magnet manifest before any items are mapped, so toItem can resolve
  // magnet URIs synchronously.
  await loadMagnetManifest();

  if (!HAS_TMDB_KEY) return demoHome();

  /*
    Only the rows needed for first paint are fetched here. The remaining rows
    are defined in ROW_DEFS and materialised client-side from /api/row, so the
    catalogue can grow without the initial document growing with it.
  */
  const firstRows = ROW_DEFS.slice(0, VISIBLE_ROWS);

  const settled = await mapLimit(firstRows, 4, async (def) => {
    const [items, hasMore] = await Promise.all([
      getRowPage(def.id, 1),
      rowHasMore(def.id, 1).catch(() => false),
    ]);
    return {
      id: def.id,
      emoji: def.emoji,
      title: def.title,
      items: items.map(forRow),
      hasMore,
      nextPage: 2,
    } satisfies MediaRow;
  });

  const rows = settled.filter((row) => row.items.length > 0);
  if (rows.length === 0) return demoHome();

  /*
    Hero and reels are seeded from the trending rows rather than a dedicated
    fan-out, which removes the extra duplicate requests the old code made for
    the same trending data.
  */
  const trendingIds = ROW_DEFS.filter((d) => d.trending).map((d) => d.id);
  const trendingPool = dedupe(
    ...rows.filter((r) => trendingIds.includes(r.id)).map((r) => r.items),
  );
  const heroSeed = trendingPool.slice(0, 5);
  if (heroSeed.length === 0) return demoHome();

  // Trailer keys cost one extra request per title, so only fetch them for the
  // hero carousel and the reel strip.
  const [hero, reels] = await Promise.all([
    attachTrailers(heroSeed),
    attachTrailers(trendingPool.slice(0, 10)),
  ]);

  return { hero, reels, rows, allRows: allRowDefs(), source: 'tmdb' };
}

/**
 * Strips `overview` from row items.
 *
 * It is the largest field by far — up to ~250 characters per title — and no
 * poster card renders it. The details modal fetches the full record from
 * /api/details on demand, so dropping it here costs nothing visible.
 */
function forRow(item: MediaItem): MediaItem {
  return { ...item, overview: '' };
}

function demoHome(): HomeData {
  const all = demoItems();
  return {
    hero: all.filter((item) => item.trending).slice(0, 5),
    reels: all.filter((item) => item.trailerKey).slice(0, 10),
    rows: [
      { id: 'kenya', emoji: '🔥', title: 'Trending Today in Kenya', items: rotate(all, 0, 16) },
      { id: 'action', emoji: '💥', title: 'Action & Blockbusters', items: rotate(all, 3, 16) },
      { id: 'tv', emoji: '📺', title: 'Top TV Series & Anime', items: rotate(all, 12, 6) },
      { id: 'recent', emoji: '✨', title: 'Recently Released', items: rotate(all, 6, 16) },
    ],
    source: 'demo',
  };
}

export async function getDetails(kind: MediaKind, id: number): Promise<MediaDetails | null> {
  if (!HAS_TMDB_KEY) {
    const entry = DEMO.find((item) => item.id === id);
    if (!entry) return null;
    const base = demoItems().find((item) => item.id === id);
    if (!base) return null;
    return {
      ...base,
      tagline: null,
      runtime: entry.runtime,
      cast: [],
      numberOfSeasons: kind === 'tv' ? 2 : null,
      trailerKey: entry.trailer,
    };
  }

  const path = kind === 'movie' ? `movie/${id}` : `tv/${id}`;
  const [details, credits, videos] = await Promise.all([
    tmdbFetch<TmdbDetailResponse>(path),
    tmdbFetch<TmdbCredits>(`${path}/credits`),
    tmdbFetch<TmdbVideos>(`${path}/videos`),
  ]);

  if (!details) return null;

  const base = toItem(details, kind);
  const cast: CastMember[] = (credits?.cast ?? []).slice(0, 10).map((person) => ({
    id: person.id,
    name: person.name,
    character: person.character ?? '',
    profile: img(person.profile_path, 'w185'),
  }));

  const yt = (videos?.results ?? []).filter((video) => video.site === 'YouTube');
  const trailer =
    yt.find((video) => video.type === 'Trailer' && video.official) ?? yt.find((video) => video.type === 'Trailer');

  return {
    ...base,
    poster: img(details.poster_path, 'w500') ?? base.poster,
    backdrop: img(details.backdrop_path, 'original') ?? base.backdrop,
    genres: details.genres?.map((genre) => genre.name) ?? base.genres,
    tagline: details.tagline?.trim() || null,
    runtime: runtimeLabel(details.runtime ?? details.episode_run_time?.[0]),
    cast,
    numberOfSeasons: details.number_of_seasons ?? null,
    trailerKey: trailer?.key ?? null,
  };
}

export async function searchMulti(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  if (!HAS_TMDB_KEY) {
    return demoItems()
      .filter((item) => item.title.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 8)
      .map((item) => ({
        id: item.id,
        kind: item.kind,
        title: item.title,
        year: item.year,
        poster: item.poster,
        rating: item.rating,
      }));
  }

  const data = await tmdbFetch<TmdbListResponse>(`/search/multi`, {
    query: q,
    include_adult: false,
  });
  if (!data?.results) return [];

  return data.results
    .filter((raw) => raw.media_type === 'movie' || raw.media_type === 'tv')
    .filter((raw) => raw.poster_path)
    .slice(0, 10)
    .map((raw) => {
      const kind = raw.media_type as MediaKind;
      return {
        id: raw.id,
        kind,
        title: raw.title ?? raw.name ?? 'Untitled',
        year: yearOf(kind === 'movie' ? raw.release_date : raw.first_air_date),
        poster: img(raw.poster_path, 'w500'),
        rating: Math.round((raw.vote_average ?? 0) * 10) / 10,
      };
    });
}
