'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Loader2, Search, Tv, X } from 'lucide-react';
import type { SearchHit } from '@/lib/types';

interface SearchBarProps {
  onSelect: (hit: SearchHit) => void;
}

export default function SearchBar({ onSelect }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(-1);

  const boxRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* Debounced instant autocomplete with stale-request cancellation. */
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      abortRef.current?.abort();
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as { results?: SearchHit[] };
        setResults(data.results ?? []);
        setCursor(-1);
        setOpen(true);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  /* "/" focuses the field, like a proper streaming app. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && /^(INPUT|TEXTAREA)$/.test(target.tagName);
      if (event.key === '/' && !typing) {
        event.preventDefault();
        boxRef.current?.querySelector('input')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const commit = (hit: SearchHit) => {
    onSelect(hit);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((value) => (value + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((value) => (value - 1 + results.length) % results.length);
    } else if (event.key === 'Enter' && cursor >= 0) {
      event.preventDefault();
      commit(results[cursor]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  const showPanel = open && (results.length > 0 || loading);

  return (
    <div ref={boxRef} className="relative w-full">
      <div
        className={`flex items-center gap-2.5 rounded-full border bg-white/[0.05] px-4 py-2.5 backdrop-blur-xl transition-colors duration-200 ${
          open
            ? 'border-crimson/60 bg-charcoal/70 shadow-glow'
            : 'border-white/10 hover:border-white/20'
        }`}
      >
        <Search className="h-4 w-4 shrink-0 text-white/50" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search movies, series, anime…   /"
          aria-label="Search titles"
          autoComplete="off"
          className="w-full bg-transparent text-sm text-white placeholder-white/35 outline-none"
        />
        {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-crimson-bright" />}
        {query && !loading && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setResults([]);
            }}
            aria-label="Clear search"
            className="shrink-0 rounded-full p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showPanel && (
        <div className="glass-strong absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 animate-scale-in overflow-hidden rounded-2xl shadow-panel">
          {results.length === 0 ? (
            <p className="px-4 py-5 text-center text-sm text-white/50">
              No titles match “{query.trim()}”
            </p>
          ) : (
            <ul role="listbox" className="max-h-[22rem] overflow-y-auto py-1.5">
              {results.map((hit, index) => (
                <li key={`${hit.kind}-${hit.id}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === cursor}
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => commit(hit)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                      index === cursor ? 'bg-crimson/15' : 'hover:bg-white/[0.06]'
                    }`}
                  >
                    <span className="relative h-12 w-9 shrink-0 overflow-hidden rounded-md bg-charcoal ring-1 ring-white/10">
                      {hit.poster ? (
                        <Image src={hit.poster} alt="" fill sizes="36px" className="object-cover" />
                      ) : (
                        <span className="grid h-full w-full place-items-center text-white/30">
                          <Tv className="h-4 w-4" />
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">
                        {hit.title}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-[11px] uppercase tracking-wider text-white/45">
                        <span className="text-crimson-bright">
                          {hit.kind === 'tv' ? 'Series' : 'Film'}
                        </span>
                        <span>{hit.year}</span>
                        {hit.rating > 0 && (
                          <span className="text-emerald-400/90">★ {hit.rating.toFixed(1)}</span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
