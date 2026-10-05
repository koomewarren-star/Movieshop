'use client';

import Image from 'next/image';
import { LockGlyph, PlayGlyph, StarGlyph, TvGlyph } from '@/components/Glyphs';
import type { MediaItem } from '@/lib/types';

interface MediaCardProps {
  item: MediaItem;
  onSelect: (item: MediaItem) => void;
  priority?: boolean;
  /** Shows a lock hint while browsing without a pass. */
  locked?: boolean;
}

export default function MediaCard({
  item,
  onSelect,
  priority = false,
  locked = false,
}: MediaCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      /* No parentheses here: Lighthouse's label-content-name-mismatch wants the
         accessible name to literally contain the visible text, and the year is
         rendered as a separate visible line. */
      aria-label={`${item.title}, ${item.year}`}
      className="group relative block w-full overflow-hidden rounded-xl bg-charcoal text-left ring-1 ring-white/10 transition-all duration-300 hover:z-10 hover:-translate-y-1.5 hover:shadow-glow focus-visible:-translate-y-1.5 focus-visible:shadow-glow"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden">
        {item.poster ? (
          <Image
            src={item.poster}
            alt={item.title}
            fill
            priority={priority}
            loading={priority ? undefined : 'lazy'}
            sizes="(max-width: 640px) 40vw, (max-width: 1024px) 24vw, 15vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.12]"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-white/25">
            <TvGlyph />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/10 to-transparent opacity-90" />

        {item.rating > 0 && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/80 px-1.5 py-1 text-[11px] font-bold text-amber-300 backdrop-blur-sm">
            <StarGlyph className="fill-crimson text-crimson" size={11} />
            {item.rating.toFixed(1)}
          </span>
        )}

        <span className="absolute right-2 top-2 rounded-md border border-white/15 bg-black/75 px-1.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/80 backdrop-blur-sm">
          {item.kind === 'tv' ? 'Series' : 'Film'}
        </span>

        {/* Quick play overlay */}
        <span className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-crimson shadow-glow-lg">
            <PlayGlyph className="translate-x-px text-white" size={20} />
          </span>
        </span>

        {locked && (
          <span className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-black/80 text-crimson-bright opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <LockGlyph />
          </span>
        )}

        <span className="absolute inset-x-0 bottom-0 p-2.5">
          <span className="block truncate text-[13px] font-bold leading-tight text-white">
            {item.title}
          </span>
          <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-wider text-white/50">
            {item.year}
          </span>
        </span>
      </div>
    </button>
  );
}
