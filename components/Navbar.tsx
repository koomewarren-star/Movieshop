'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { HardDriveDownload, Menu, PlayCircle, X } from 'lucide-react';
import SearchBar from '@/components/SearchBar';
import AuthButton from '@/components/AuthButton';
import type { SearchHit } from '@/lib/types';

interface NavbarProps {
  onSearchSelect: (hit: SearchHit) => void;
}

const NAV_LINKS = [
  { href: '#trending', label: 'Trending' },
  { href: '#reels', label: 'Trailer Reels' },
  { href: '#browse', label: 'Browse' },
  { href: '#toprated', label: 'Top Rated' },
];

export default function Navbar({ onSearchSelect }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled
          ? 'border-b border-white/[0.08] bg-obsidian/85 shadow-[0_10px_40px_-20px_rgba(220,38,38,0.5)] backdrop-blur-2xl'
          : 'border-b border-transparent bg-gradient-to-b from-black/80 to-transparent'
      }`}
    >
      <nav className="mx-auto flex h-[var(--header-h)] max-w-[100rem] items-center gap-4 px-4 sm:px-6 lg:px-10">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          <span className="relative grid h-10 w-10 place-items-center rounded-xl bg-crimson-sheen shadow-glow transition-transform duration-300 group-hover:scale-105">
            <PlayCircle className="h-6 w-6 text-white" strokeWidth={2.4} />
            <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/25" />
          </span>
          <span className="text-xl font-black uppercase tracking-tight text-white sm:text-2xl">
            Movie<span className="text-crimson-bright">Shop</span>
          </span>
        </Link>

        <ul className="ml-3 hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="rounded-full px-3.5 py-2 text-sm font-medium text-white/65 transition-colors hover:bg-white/[0.07] hover:text-white"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto hidden w-full max-w-md md:block">
          <SearchBar onSelect={onSearchSelect} />
        </div>

        {/* Account session control. Renders nothing until Supabase is configured. */}
        <AuthButton />

        {/*
          Downloads is a route, not an in-page anchor, so it is kept out of
          NAV_LINKS: those are hash links for sections of the storefront, and
          mixing the two would scroll instead of navigating.
        */}
        <Link
          href="/downloads"
          title="Your saved downloads"
          className="hidden shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-white/80 transition-all duration-300 hover:border-crimson/50 hover:bg-crimson/10 hover:text-white sm:inline-flex"
        >
          <HardDriveDownload className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Downloads</span>
        </Link>

        <button
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-white transition-colors hover:border-crimson/50 hover:bg-crimson/10 lg:hidden"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {menuOpen && (
        <div className="animate-fade-up border-t border-white/[0.08] bg-obsidian/95 px-4 pb-5 pt-4 backdrop-blur-2xl lg:hidden">
          <div className="mb-4 md:hidden">
            <SearchBar
              onSelect={(hit) => {
                onSearchSelect(hit);
                setMenuOpen(false);
              }}
            />
          </div>
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-xl px-3 py-3 text-base font-semibold text-white/80 transition-colors hover:bg-white/[0.07] hover:text-white"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <Link
            href="/downloads"
            onClick={() => setMenuOpen(false)}
            className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-base font-semibold text-white/80 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            <HardDriveDownload className="h-4 w-4" />
            My Downloads
          </Link>

          <Link
            href="/login"
            onClick={() => setMenuOpen(false)}
            className="btn-glow mt-3 flex w-full items-center justify-center"
          >
            Sign In — Free Access
          </Link>
        </div>
      )}
    </header>
  );
}
