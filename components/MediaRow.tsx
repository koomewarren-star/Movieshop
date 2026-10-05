'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import MediaCard from '@/components/MediaCard';
import type { MediaItem, MediaRow as MediaRowType } from '@/lib/types';

interface MediaRowProps {
  row: MediaRowType;
  onSelect: (item: MediaItem) => void;
  locked?: boolean;
  /** True while the first page of this row is being fetched. */
  loading?: boolean;
}

/**
 * Cards mounted initially, and the batch size added as the row is scrolled.
 *
 * A viewport shows roughly ten posters, so mounting a screenful plus overscan
 * and appending on scroll keeps the DOM small. Append-only and never trimming,
 * so nothing can pop out of view mid-scroll.
 */
const INITIAL_CARDS = 14;
const BATCH_CARDS = 12;

export default function MediaRow({
  row,
  onSelect,
  locked = false,
  loading = false,
}: MediaRowProps) {
  const scrollerRef = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [mounted, setMounted] = useState(INITIAL_CARDS);
  /** Items fetched on demand, appended after the server-rendered ones. */
  const [extra, setExtra] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(row.nextPage ?? 2);
  const [exhausted, setExhausted] = useState(false);
  const fetching = useRef(false);

  // Memoised because it is a dependency of loadMore: rebuilding it every render
  // would make that callback a new function every render, so the scroll listener
  // would detach and reattach continuously while the viewer scrolls.
  const items = useMemo(
    () => (extra.length > 0 ? [...row.items, ...extra] : row.items),
    [row.items, extra],
  );
  const total = items.length;
  const canLoadMore = !exhausted && total > 0;

  /**
   * Pulls the next page from /api/row.
   *
   * This is the piece that decouples catalogue size from document size: the row
   * only ever holds what has been asked for, and the browser is already near the
   * end of what it has when the request goes out.
   */
  const loadMore = useCallback(async () => {
    if (fetching.current || exhausted || loading) return;
    fetching.current = true;
    try {
      const res = await fetch(`/api/row?row=${encodeURIComponent(row.id)}&page=${page}`);
      if (!res.ok) {
        setExhausted(true);
        return;
      }
      const data = (await res.json()) as { items?: MediaItem[]; hasMore?: boolean };
      const incoming = (data.items ?? []).filter(
        (item) => !items.some((seen) => seen.id === item.id && seen.kind === item.kind),
      );
      if (incoming.length === 0) {
        setExhausted(true);
        return;
      }
      setExtra((current) => [...current, ...incoming]);
      setPage((current) => current + 1);
      if (data.hasMore === false) setExhausted(true);
    } catch {
      setExhausted(true);
    } finally {
      fetching.current = false;
    }
  }, [exhausted, loading, page, row.id, items]);

  const syncEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;

    setAtStart(el.scrollLeft <= 8);

    // Only treat the right arrow as exhausted once every card is mounted and no
    // further pages are outstanding, otherwise the arrow reads "end" while more
    // titles are still unloaded.
    const settled = mounted >= total && exhausted;
    if (settled) {
      setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8);
    } else {
      setAtEnd(false);
    }
  }, [mounted, total, exhausted]);

  /** Grows the window once the scroller is within half a viewport of the end. */
  const maybeGrow = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const nearEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - el.clientWidth * 0.5;
    if (nearEnd) {
      if (mounted < total) {
        setMounted((current) => current + BATCH_CARDS);
      } else if (canLoadMore) {
        // Everything we hold is mounted, so go and get the next page.
        void loadMore();
      }
    }
  }, [mounted, total, canLoadMore, loadMore]);

  useEffect(() => {
    syncEdges();
    const el = scrollerRef.current;
    if (!el) return;

    el.addEventListener('scroll', syncEdges, { passive: true });
    el.addEventListener('scroll', maybeGrow, { passive: true });
    window.addEventListener('resize', syncEdges);

    return () => {
      el.removeEventListener('scroll', syncEdges);
      el.removeEventListener('scroll', maybeGrow);
      window.removeEventListener('resize', syncEdges);
    };
  }, [syncEdges, maybeGrow]);

  const scrollBy = (direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({
      left: Math.max(240, el.clientWidth * 0.85) * direction,
      behavior: 'smooth',
    });
  };

  // Paging state is per row; switching rows must start from a clean slate or the
  // previous row's fetched pages bleed into the next one.
  useEffect(() => {
    setExtra([]);
    setMounted(INITIAL_CARDS);
    setPage(row.nextPage ?? 2);
    setExhausted(false);
  }, [row.id, row.nextPage]);

  if (items.length === 0) {
    /*
      Two distinct empty states, and the difference matters at catalogue scale.

      Not yet requested: heading only. Sixty-odd deferred rows exist in the
      document, so emitting a skeleton per row was ~100 KB of placeholder markup
      the viewer paid for on first paint before scrolling anywhere.

      Requested and in flight: skeleton, so the row reserves its height and the
      page does not jump when the cards land.
    */
    return (
      <section className="relative scroll-mt-24 py-2">
        <div className="mx-auto max-w-[100rem] px-4 sm:px-6 lg:px-10">
          <div className="mb-3.5 flex items-center gap-3">
            <span
              className={`text-lg font-black uppercase tracking-tight sm:text-2xl ${
                loading ? 'text-white/55' : 'text-white/30'
              }`}
            >
              <span className="mr-1.5">{row.emoji}</span>
              {row.title}
            </span>
            {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-crimson-bright" />}
          </div>
          {loading && (
            <div className="flex gap-3 overflow-hidden sm:gap-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="aspect-[2/3] w-[38vw] shrink-0 animate-pulse rounded-xl bg-white/[0.04] sm:w-[22vw] md:w-[18vw] lg:w-[13.5vw] xl:w-[12rem]"
                />
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  const visible = items.slice(0, mounted);

  return (
    <section id={row.id} className="relative scroll-mt-24 py-2">
      <div className="mx-auto max-w-[100rem] px-4 sm:px-6 lg:px-10">
        <div className="mb-3.5 flex items-end justify-between gap-4">
          <h2 className="text-lg font-black uppercase tracking-tight text-white sm:text-2xl">
            <span className="mr-1.5">{row.emoji}</span>
            {row.title}
          </h2>

          <div className="flex items-center gap-2">
            <span className="hidden text-[11px] font-semibold uppercase tracking-widest text-white/30 sm:inline">
              {/* Only reports what has been fetched so far - the row grows as the
                  viewer scrolls, so a fixed total would be a lie. */}
              {items.length}+ titles
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => scrollBy(-1)}
                disabled={atStart}
                aria-label={`Scroll ${row.title} left`}
                className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-charcoal/80 text-white/70 backdrop-blur-md transition-all duration-200 hover:border-crimson/60 hover:bg-crimson/15 hover:text-white disabled:pointer-events-none disabled:opacity-25"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollBy(1)}
                disabled={atEnd}
                aria-label={`Scroll ${row.title} right`}
                className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-charcoal/80 text-white/70 backdrop-blur-md transition-all duration-200 hover:border-crimson/60 hover:bg-crimson/15 hover:text-white disabled:pointer-events-none disabled:opacity-25"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="relative">
        <div
          className={`pointer-events-none absolute inset-y-0 left-0 z-20 w-8 bg-gradient-to-r from-obsidian to-transparent transition-opacity duration-300 lg:w-16 ${
            atStart ? 'opacity-0' : 'opacity-100'
          }`}
        />
        <div
          className={`pointer-events-none absolute inset-y-0 right-0 z-20 w-8 bg-gradient-to-l from-obsidian to-transparent transition-opacity duration-300 lg:w-16 ${
            atEnd ? 'opacity-0' : 'opacity-100'
          }`}
        />

        <ul
          ref={scrollerRef}
          className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-3 sm:gap-4 sm:px-6 lg:px-10"
        >
          {visible.map((item, index) => (
            <li
              key={`${row.id}-${item.kind}-${item.id}`}
              className="w-[38vw] shrink-0 snap-start sm:w-[22vw] md:w-[18vw] lg:w-[13.5vw] xl:w-[12rem]"
            >
              <MediaCard
                item={item}
                onSelect={onSelect}
                /* Only the first couple load eagerly; the browser lazy-loads the
                   rest, which keeps a large catalogue from issuing hundreds of
                   image requests on first paint. */
                priority={index < 2}
                locked={locked}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
