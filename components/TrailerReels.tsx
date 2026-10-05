'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Play, Smartphone, Zap } from 'lucide-react';
import { trailerEmbedUrl } from '@/lib/nexstream';
import type { MediaItem } from '@/lib/types';

interface TrailerReelsProps {
  items: MediaItem[];
  onSelect: (item: MediaItem) => void;
}

/**
 * TikTok-style 9:16 story cards. Hovering (or tapping the play chip on touch)
 * swaps the poster for a muted, looping YouTube trailer iframe. Unmounting the
 * iframe on mouse-leave is what stops the audio — a paused iframe keeps playing.
 */
export default function TrailerReels({ items, onSelect }: TrailerReelsProps) {
  const scrollerRef = useRef<HTMLUListElement>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);

  const scrollBy = (direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: Math.max(200, el.clientWidth * 0.7) * direction, behavior: 'smooth' });
  };

  if (items.length === 0) return null;

  return (
    <section id="reels" className="relative py-10 sm:py-14">
      <div className="mx-auto max-w-[100rem] px-4 sm:px-6 lg:px-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="mb-2 inline-flex items-center gap-2 rounded-full border border-crimson/40 bg-crimson/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-crimson-bright">
              <Smartphone className="h-3.5 w-3.5" />
              9:16 Story Feed
            </span>
            <h2 className="text-2xl font-black uppercase tracking-tight text-white sm:text-4xl">
              Quick Clips <span className="text-crimson-bright">/ Trailer Reels</span>
            </h2>
            <p className="mt-2 max-w-md text-sm text-white/50">
              Hover a reel to auto-play its trailer. Tap to open the full stream.
            </p>
          </div>

          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => scrollBy(-1)}
              aria-label="Scroll reels left"
              className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-charcoal/80 text-white/70 backdrop-blur-md transition-all hover:border-crimson/60 hover:bg-crimson/15 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollBy(1)}
              aria-label="Scroll reels right"
              className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-charcoal/80 text-white/70 backdrop-blur-md transition-all hover:border-crimson/60 hover:bg-crimson/15 hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <ul className="no-scrollbar flex snap-x snap-mandatory gap-3.5 overflow-x-auto scroll-smooth px-4 pb-2 sm:gap-5 sm:px-6 lg:px-10">
        {items.map((item) => {
          const previewing = previewId === item.id;
          const art = item.backdrop ?? item.poster;
          const hasTrailer = Boolean(item.trailerKey);

          return (
            <li
              key={`reel-${item.kind}-${item.id}`}
              className="w-[42vw] shrink-0 snap-start sm:w-[24vw] md:w-[19vw] lg:w-[15vw] xl:w-[13.5rem]"
            >
              <div
                className="group relative aspect-[9/16] w-full overflow-hidden rounded-2xl bg-charcoal ring-1 ring-white/10 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-glow"
                onMouseEnter={() => hasTrailer && setPreviewId(item.id)}
                onMouseLeave={() =>
                  setPreviewId((current) => (current === item.id ? null : current))
                }
              >
                {art && (
                  <Image
                    src={art}
                    alt={item.title}
                    fill
                    loading="lazy"
                    sizes="(max-width: 640px) 42vw, (max-width: 1024px) 20vw, 14vw"
                    className={`object-cover transition-all duration-500 ${
                      previewing ? 'scale-105 opacity-0' : 'opacity-80 group-hover:scale-105'
                    }`}
                  />
                )}

                {hasTrailer && previewing && item.trailerKey && (
                  <iframe
                    title={`${item.title} trailer`}
                    src={trailerEmbedUrl(item.trailerKey, true)}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    className="absolute inset-0 h-full w-full scale-[1.05] border-0 object-cover"
                    tabIndex={-1}
                  />
                )}

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/25 to-obsidian/50" />

                <div className="absolute inset-x-0 top-0 flex items-center justify-between p-2.5">
                  <span className="inline-flex items-center gap-1 rounded-md bg-crimson px-1.5 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-glow">
                    <Zap className="h-3 w-3 fill-white" />
                    Reel
                  </span>
                  {item.rating > 0 && (
                    <span className="rounded-md bg-black/75 px-1.5 py-1 text-[10px] font-bold text-amber-300 backdrop-blur-sm">
                      ★ {item.rating.toFixed(1)}
                    </span>
                  )}
                </div>

                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="line-clamp-2 text-sm font-bold leading-tight text-white">
                    {item.title}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-crimson-bright">
                    {item.kind === 'tv' ? 'Series' : 'Film'} · {item.year}
                  </p>
                </div>

                {/* Centre play chip — also the touch affordance */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  {hasTrailer ? (
                    <span
                      role="button"
                      tabIndex={-1}
                      /* The chip's only content is an aria-hidden icon, so it
                         needs an explicit name or screen readers announce an
                         unlabelled button (Lighthouse aria-command-name). */
                      aria-label={
                        previewing
                          ? `Stop preview of ${item.title}`
                          : `Play trailer preview of ${item.title}`
                      }
                      onClick={(event) => {
                        event.stopPropagation();
                        setPreviewId(previewing ? null : item.id);
                      }}
                      className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-white/15 ring-1 ring-white/30 backdrop-blur-md transition-all duration-200 hover:scale-110 hover:bg-crimson hover:ring-crimson"
                    >
                      <Play className={`h-4 w-4 fill-white text-white ${previewing ? 'hidden' : ''}`} />
                      {previewing && <span className="text-[10px] font-bold uppercase">On</span>}
                    </span>
                  ) : (
                    <span className="rounded-md bg-black/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/60">
                      Teaser soon
                    </span>
                  )}
                </div>

                {/* Whole-card tap target for opening the title */}
                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  aria-label={`Open ${item.title}`}
                  className="absolute inset-0 h-full w-full"
                />

                {previewing && (
                  <span className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-full bg-crimson shadow-glow" />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
