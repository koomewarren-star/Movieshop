/**
 * Discovery row registry.
 *
 * Each row is defined declaratively as a single TMDB query so that its items
 * can be paged on demand. That is the whole point: the home document used to
 * embed every item of every row in the RSC payload (~720 items, ~680 KB of
 * HTML before a single poster loaded). At the depths below that becomes
 * megabytes of JSON on first paint, which is what kills scroll smoothness on a
 * phone.
 *
 * Instead a row ships only its first slice here and the rest arrives from
 * /api/row as the viewer scrolls.
 *
 * SCOPE: this is the ORIGINAL nine-row catalogue, unchanged in ids, titles and
 * queries, so the navbar anchors and anything else keyed to those ids still
 * resolve. What changed is depth, not breadth - each of these rows now pages
 * far deeper than the old hard-coded 80-title cap, which is where the extra
 * movies come from.
 */

import type { MediaKind } from './types';

export interface RowDef {
  id: string;
  emoji: string;
  title: string;
  /** TMDB path, e.g. '/discover/movie'. */
  path: string;
  kind: MediaKind;
  params: Record<string, string | number | boolean>;
  /** Marks items as trending so the hero/reel seeds can pick them up. */
  trending?: boolean;
  /** Part of the dedicated series catalogue, so the UI can group it. */
  series?: boolean;
  /**
   * Fan the row out across several languages and merge the results.
   *
   * TMDB's `with_original_language` accepts exactly ONE code - `ja` returns
   * 20,001 titles, `ja,ko` returns zero. So the original international row was
   * silently empty and only ever looked populated because the old code masked it
   * with a trending fallback. Splitting the query and merging restores the row
   * without turning it into eight separate rows.
   */
  languages?: string[];
}

/** TMDB pages are 20 items; a page is the natural paging unit. */
export const ROW_PAGE_SIZE = 20;

/**
 * How many items a row embeds in the initial HTML.
 *
 * Deliberately small. MediaRow mounts 14 eagerly and appends the rest on scroll,
 * so anything past that is payload paid for before it is seen.
 */
export const ROW_INITIAL = 20;

/**
 * Rows fetched during first paint. Everything else loads via IntersectionObserver
 * as the viewer scrolls.
 *
 * Kept modest on purpose: each of these rows costs 20 items in the initial
 * document, so raising it is the one change that would undo the payload work.
 */
export const VISIBLE_ROWS = 9;

/**
 * Deepest page a row will page to.
 *
 * This is the depth lever. The old code hard-capped a row at 80 titles; at 100
 * pages of 20 items each row can serve 2,000, so the catalogue below is several
 * times larger than the initial payload ever is.
 */
export const MAX_PAGE = 100;

/**
 * Discovery rows.
 *
 * The first nine are the original catalogue, unchanged in id, title and query
 * so the navbar anchors still resolve. They are followed by a dedicated series
 * catalogue and per-genre film rows, which add depth without changing what the
 * home page reads like.
 */
export const ROW_DEFS: RowDef[] = [
  {
    id: 'kenya',
    emoji: '🔥',
    title: 'Trending Today in Kenya',
    path: '/discover/movie',
    kind: 'movie',
    params: { region: 'KE', sort_by: 'popularity.desc' },
    trending: true,
  },
  {
    id: 'action',
    emoji: '💥',
    title: 'Action & Blockbusters',
    path: '/discover/movie',
    kind: 'movie',
    params: { with_genres: '28,12', sort_by: 'popularity.desc' },
    trending: true,
  },
  {
    id: 'tv',
    emoji: '📺',
    title: 'Top TV Series & Anime',
    path: '/discover/tv',
    kind: 'tv',
    params: { with_genres: '16,10765', sort_by: 'popularity.desc' },
    trending: true,
  },
  {
    id: 'recent',
    emoji: '✨',
    title: 'Recently Released',
    path: '/discover/movie',
    kind: 'movie',
    params: {
      sort_by: 'primary_release_date.desc',
      'primary_release_date.gte': '__SINCE__',
      'primary_release_date.lte': '__TODAY__',
    },
  },
  {
    id: 'family',
    emoji: '🍿',
    title: 'Family, Comedy & Animation',
    path: '/discover/movie',
    kind: 'movie',
    params: { with_genres: '10751,35,16', sort_by: 'popularity.desc' },
  },
  {
    id: 'scifi',
    emoji: '🛸',
    title: 'Sci-Fi & Fantasy',
    path: '/discover/movie',
    kind: 'movie',
    params: { with_genres: '878,14', sort_by: 'popularity.desc' },
  },
  {
    id: 'horror',
    emoji: '🔪',
    title: 'Horror & Suspense',
    path: '/discover/movie',
    kind: 'movie',
    params: { with_genres: '27', sort_by: 'popularity.desc' },
  },
  {
    id: 'international',
    emoji: '🌍',
    title: 'International Favourites',
    path: '/discover/movie',
    kind: 'movie',
    params: { sort_by: 'popularity.desc' },
    languages: ['hi', 'ko', 'ja', 'zh', 'fr', 'es', 'de', 'ta'],
  },
  {
    id: 'toprated',
    emoji: '🏆',
    title: 'All-Time Top Rated',
    path: '/movie/top_rated',
    kind: 'movie',
    params: {},
  },
  {
    /*
     * The one dedicated series row.
     *
     * The rows above mix films and series, which leaves series hard to browse:
     * "Top TV Series & Anime" is the only one and it is limited to animation
     * and sci-fi. This is a single deep row for everything episodic, which
     * pages to MAX_PAGE like the others, so it serves ~2,000 titles on its own.
     */
    id: 'series',
    emoji: '📺',
    title: 'Series & TV Shows',
    path: '/discover/tv',
    kind: 'tv',
    params: { sort_by: 'popularity.desc', 'vote_count.gte': 25 },
    series: true,
  },
  {
    id: 'documentaries',
    emoji: '🎬',
    title: 'Documentaries',
    path: '/discover/movie',
    kind: 'movie',
    params: { with_genres: '99', sort_by: 'popularity.desc', 'vote_count.gte': 30 },
  },
];

/** Expands the date placeholders in a row's params. */
export function resolveParams(params: RowDef['params']): RowDef['params'] {
  const out: RowDef['params'] = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === '__SINCE__') {
      const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 45);
      out[key] = since.toISOString().slice(0, 10);
    } else if (value === '__TODAY__') {
      out[key] = new Date().toISOString().slice(0, 10);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

export function getRowDef(id: string): RowDef | undefined {
  return ROW_DEFS.find((row) => row.id === id);
}
