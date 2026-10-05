'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Flame,
  Info,
  Play,
  Star,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { trailerEmbedUrl } from '@/lib/nexstream';
import type { MediaItem } from '@/lib/types';

interface HeroBannerProps {
  items: MediaItem[];
  onWatch: (item: MediaItem) => void;
  onDetails: (item: MediaItem) => void;
}

const ROTATE_MS = 8000;

export default function HeroBanner({ items, onWatch, onDetails }: HeroBannerProps) {
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);

  const count = items.length;

  const go = useCallback(
    (direction: 1 | -1) => {
      if (count === 0) return;
      setIndex((value) => (value + direction + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (paused || count <= 1) return;
    const timer = setInterval(() => {
      setIndex((value) => (value + 1) % count);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [paused, count]);

  if (count === 0) return null;

  const item = items[index];
  const isTv = item.kind === 'tv';
  const year = item.year;

  return (
    <section
      id="trending"
      className="relative isolate min-h-[88svh] w-full overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="absolute inset-0 -z-10 bg-obsidian">
        {item.backdrop ? (
          <Image
            key={item.id}
            src={item.backdrop}
            alt=""
            fill
            priority={index === 0}
            sizes="100vw"
            className="animate-fade-up object-cover object-center opacity-55"
          />
        ) : null}

        {/* Muted trailer preview */}
        {item.trailerKey && (
          <div className="absolute inset-0 overflow-hidden">
            <iframe
              key={`${item.id}-${muted}`}
              title={`${item.title} preview`}
              src={trailerEmbedUrl(item.trailerKey, true)}
              allow="autoplay; encrypted-media; picture-in-picture"
              className={`h-full w-full border-0 object-cover transition-opacity duration-700 ${
                muted ? 'opacity-25' : 'opacity-0'
              }`}
              tabIndex={-1}
            />
          </div>
        )}

        {/* Cinema grading */}
        <div className="absolute inset-0 bg-gradient-to-r from-obsidian via-obsidian/80 to-obsidian/15" />
        <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/20 to-obsidian/70" />
        <div className="absolute inset-0 bg-[radial-gradient(75rem_45rem_at_18%_60%,rgba(220,38,38,0.28),transparent_65%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-obsidian to-transparent" />
      </div>

      <div className="mx-auto flex min-h-[88svh] max-w-[100rem] flex-col justify-end px-4 pb-20 pt-28 sm:px-6 lg:px-10 lg:pb-28">
        <div key={item.id} className="max-w-2xl animate-fade-up">
          <div className="mb-5 flex flex-wrap items-center gap-2.5">
            <span className="chip chip-red">
              <Flame className="h-3.5 w-3.5" />
              #{index + 1} Trending on TMDB
            </span>
            <span className="chip">
              <Clapperboard className="h-3.5 w-3.5 text-crimson-bright" />
              {isTv ? 'TV Series' : 'Feature Film'}
            </span>
          </div>

          <h1 className="text-4xl font-black uppercase leading-[0.95] tracking-tight text-white drop-shadow-2xl sm:text-6xl lg:text-7xl">
            {item.title}
          </h1>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <span className="chip">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              IMDb {item.rating ? item.rating.toFixed(1) : '—'}
              {item.rating >= 8.5 ? '+' : ''}
            </span>
            <span className="chip border-crimson/35 bg-crimson/10 text-crimson-bright">
              4K Ultra HD
            </span>
            <span className="chip">
              <CalendarDays className="h-3.5 w-3.5" />
              {year === '—' ? 'Coming Soon' : year}
            </span>
            {item.genres.slice(0, 2).map((genre) => (
              <span key={genre} className="chip">
                {genre}
              </span>
            ))}
          </div>

          {item.overview && (
            <p className="mt-6 max-w-xl text-sm leading-relaxed text-white/65 sm:text-base">
              {item.overview.length > 250
                ? `${item.overview.slice(0, 250).trimEnd()}…`
                : item.overview}
            </p>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3.5">
            <button type="button" onClick={() => onWatch(item)} className="btn-glow">
              <Play className="h-5 w-5 fill-white" />
              Watch Now
            </button>
            <button type="button" onClick={() => onDetails(item)} className="btn-ghost">
              <Info className="h-4 w-4" />
              More Info
            </button>
            {item.trailerKey && (
              <button
                type="button"
                onClick={() => setMuted((value) => !value)}
                className="btn-ghost"
              >
                {muted ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                {muted ? 'Unmute Teaser' : 'Mute Teaser'}
              </button>
            )}
          </div>

          <p className="mt-4 text-xs uppercase tracking-[0.2em] text-white/35">
            One flat pass · {isTv ? 'Every episode' : 'Uncut'} · 4K HDR
          </p>
        </div>
      </div>

      {/* Carousel controls */}
      {count > 1 && (
        <div className="absolute bottom-7 left-4 flex items-center gap-4 sm:left-6 lg:left-10">
          <div className="flex gap-1.5">
            {items.map((slide, slideIndex) => (
              <button
                key={`dot-${slide.kind}-${slide.id}`}
                type="button"
                onClick={() => setIndex(slideIndex)}
                aria-label={`Show ${slide.title}`}
                aria-current={slideIndex === index}
                /* The visible bar is 1px tall, but the tap target wraps it in a
                   padded button. Without the padding these are 12x4 CSS px and
                   unusable on touch (Lighthouse target-size). */
                className="group flex h-8 w-6 items-center justify-center"
              >
                <span
                  className={`block h-1 w-3 rounded-full transition-all duration-300 group-hover:bg-white/50 ${
                    slideIndex === index
                      ? 'w-8 bg-crimson-bright shadow-glow'
                      : 'bg-white/25'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {count > 1 && (
        <div className="absolute bottom-7 right-4 hidden gap-2 sm:flex sm:right-6 lg:right-10">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous title"
            className="grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-charcoal/70 text-white/70 backdrop-blur-md transition-all hover:border-crimson/60 hover:bg-crimson/15 hover:text-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next title"
            className="grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-charcoal/70 text-white/70 backdrop-blur-md transition-all hover:border-crimson/60 hover:bg-crimson/15 hover:text-white"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </section>
  );
}
