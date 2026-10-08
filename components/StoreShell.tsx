'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Crown, Heart, Lock, Smartphone, Sparkles } from 'lucide-react';
import DetailsModal from '@/components/DetailsModal';
import ContinueWatching from '@/components/ContinueWatching';
import HeroBanner from '@/components/HeroBanner';
import MediaRow from '@/components/MediaRow';
import Navbar from '@/components/Navbar';
import NexstreamPlayer from '@/components/NexstreamPlayer';
import SignInGate from '@/components/SignInGate';
import TrailerReels from '@/components/TrailerReels';
import { useSupabaseUser } from '@/hooks/useSupabaseUser';
import { playerEvent } from '@/hooks/usePlayerDiagnostics';
import { pendingToMediaItem, readPendingPlayback } from '@/lib/playerRecovery';
import type { WatchEntry } from '@/lib/watchProgress';
import type { HomeData, MediaItem, SearchHit } from '@/lib/types';

function Store({ data }: { data: HomeData }) {
  /*
    A free Supabase account is now the only key. There is no paid tier, so
    there is nothing to check beyond "is there a session".
   */
  const { user, ready: authReady } = useSupabaseUser();
  const isSignedIn = Boolean(user);

  const [playerItem, setPlayerItem] = useState<MediaItem | null>(null);
  const [playerSeason, setPlayerSeason] = useState(1);
  const [playerEpisode, setPlayerEpisode] = useState(1);
  const [playerOpen, setPlayerOpen] = useState(false);

  const [detailsItem, setDetailsItem] = useState<MediaItem | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [gateOpen, setGateOpen] = useState(false);
  const [intent, setIntent] = useState<string | null>(null);

  /*
    Redirect recovery.

    If the upstream embed navigates the tab, the app reloads with no modal and
    no context. `NexstreamPlayer` stores the intended title before playback
    starts; this restores it once, on mount. Restoration is deliberately one
    shot and gated on the viewer being signed in, because a recovered player for
    a signed-out visitor would open straight back into the sign-in gate, and
    repeatedly re-opening a modal on a loop of navigations would be worse than
    dropping the viewer on the home page.
   */
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !authReady || !isSignedIn) return;
    restored.current = true;
    const pending = readPendingPlayback();
    if (!pending) return;
    playerEvent('player recovery restored', { id: String(pending.id), kind: pending.kind });
    setPlayerItem(pendingToMediaItem(pending));
    setPlayerSeason(pending.season);
    setPlayerEpisode(pending.episode);
    setPlayerOpen(true);
  }, [authReady, isSignedIn]);

  /*
    Deferred rows: registered in lib/rows.ts but not part of first paint.
    Their headings render immediately from metadata alone, and page 1 arrives
    from /api/row once the row is anywhere near the viewport.
  */
  const initialRowIds = new Set(data.rows.map((row) => row.id));
  const deferred = (data.allRows ?? []).filter((meta) => !initialRowIds.has(meta.id));
  const [deferredItems, setDeferredItems] = useState<
    Record<string, { items: MediaItem[] }>
  >({});

  /**
   * Loads each deferred row's first page when it approaches the viewport.
   *
   * `rootMargin` is deliberately generous — a screen and a half of lead time —
   * so the row is normally populated by the time the viewer scrolls to it. The
   * in-flight guard matters because IntersectionObserver can fire twice for the
   * same row while a slow request is still running.
   */
  const pending = useRef(new Set<string>());
  /*
    Which rows have actually been requested. A row that has not been approached
    yet renders as a heading alone; only once a request is genuinely in flight
    does it get a skeleton. Rendering skeletons for all 60-odd deferred rows up
    front was ~100 KB of placeholder markup before the viewer had scrolled.
  */
  const [requested, setRequested] = useState<Record<string, true>>({});

  useEffect(() => {
    if (deferred.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = entry.target.getAttribute('data-row-id');
          if (!id || pending.current.has(id)) continue;
          pending.current.add(id);
          setRequested((current) => ({ ...current, [id]: true }));

          void (async () => {
            try {
              const res = await fetch(`/api/row?row=${encodeURIComponent(id)}&page=1`);
              if (!res.ok) return;
              const data = (await res.json()) as { items?: MediaItem[] };
              setDeferredItems((current) => ({
                ...current,
                [id]: { items: data.items ?? [] },
              }));
            } catch {
              /* leave the skeleton in place; the row is not critical */
            }
          })();
        }
      },
      { rootMargin: '1200px 0px' },
    );

    const nodes = document.querySelectorAll('[data-row-id]');
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [deferred, deferredItems]);

  /**
   * Every entry point funnels through here: signed-in viewers go straight to
   * the player, everyone else gets the sign-in gate.
   *
   * `authReady` matters. Before the session resolves we do not know whether
   * this viewer is signed in, so blocking on it would bounce an already-signed-in
   * viewer who clicked during first paint. Gating on it means a signed-out
   * viewer may briefly be able to reach the player on a fast first click;
   * that is the lesser failure compared with locking people out of their own
   * account.
   */
  const requestWatch = useCallback(
    (item: MediaItem, season = 1, episode = 1) => {
      setPlayerItem(item);
      setPlayerSeason(season);
      setPlayerEpisode(episode);
      if (isSignedIn || !authReady) {
        setDetailsOpen(false);
        setPlayerOpen(true);
      } else {
        setIntent(item.title);
        setDetailsOpen(false);
        setGateOpen(true);
      }
    },
    [isSignedIn, authReady],
  );

  const openDetails = useCallback((item: MediaItem) => {
    setDetailsItem(item);
    setDetailsOpen(true);
  }, []);

  const openGate = useCallback(() => {
    setIntent(null);
    setGateOpen(true);
  }, []);

  /**
   * Opens a title from Continue Watching at the season/episode it was left on.
   *
   * Films ignore the season/episode entirely, so they go straight through to the
   * gate exactly like any other title. Series carry them through so the
   * viewer lands on the episode they were watching rather than S1E1.
   */
  const resumeFromProgress = useCallback(
    (item: MediaItem, entry: WatchEntry) => {
      requestWatch(item, entry.season ?? 1, entry.episode ?? 1);
    },
    [requestWatch],
  );

  const onSearchSelect = useCallback(
    (hit: SearchHit) => {
      openDetails({
        id: hit.id,
        kind: hit.kind,
        title: hit.title,
        overview: '',
        poster: hit.poster,
        backdrop: hit.poster ? hit.poster.replace('/w500', '/original') : null,
        rating: hit.rating,
        year: hit.year,
        genres: [],
        popularity: 0,
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [openDetails],
  );

  const closeGate = useCallback(() => {
    setGateOpen(false);
    if (!isSignedIn) setIntent(null);
  }, [isSignedIn]);

  const footerColumns = [
    { title: 'Browse', links: data.rows.map((row) => row.title) },
    {
      title: 'Account',
      links: isSignedIn
        ? [user?.email ?? 'Signed in', 'Your watch progress', 'Sign out']
        : ['Sign in', 'Create a free account', 'Help centre'],
    },
    { title: 'Legal', links: ['Terms of use', 'Privacy policy', 'Content notice'] },
  ];

  return (
    <div className="min-h-screen">
      <Navbar onSearchSelect={onSearchSelect} />

      <main>
        <HeroBanner items={data.hero} onWatch={requestWatch} onDetails={openDetails} />

        <TrailerReels items={data.reels} onSelect={openDetails} />

        {/* Continue Watching sits directly below Quick Clips. Renders nothing
            until there is progress to show, so the gap closes rather than
            leaving an empty band on a fresh browser. */}
        <ContinueWatching onSelect={resumeFromProgress} locked={!isSignedIn} />

        {!isSignedIn && (
          <section className="px-4 pb-4 sm:px-6 lg:px-10">
            <div className="mx-auto flex max-w-[100rem] flex-col items-start gap-5 rounded-2xl border border-crimson/25 bg-gradient-to-r from-crimson/15 via-charcoal/60 to-transparent p-5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex items-start gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-crimson-sheen shadow-glow">
                  <Lock className="h-5 w-5 text-white" />
                </span>
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tight text-white sm:text-xl">
                    Everything is free
                  </h2>
                  <p className="mt-1 text-sm text-white/55">
                    Create a free account to unlock all movies, series and anime. No
                    card, no M-Pesa, no subscription.
                  </p>
                </div>
              </div>
              <Link
                href="/login"
                className="btn-glow inline-flex w-full shrink-0 items-center justify-center gap-2 sm:w-auto"
              >
                <Crown className="h-4 w-4" />
                Get Free Access
              </Link>
            </div>
          </section>
        )}

        <div id="browse" className="space-y-6 py-8 sm:space-y-9 sm:py-12">
          {data.rows.map((row) => (
            <MediaRow key={row.id} row={row} onSelect={openDetails} locked={!isSignedIn} />
          ))}

          {/*
            Rows beyond first paint.

            Only their headings ship in the document; each one fetches page 1
            from /api/row as it approaches the viewport. That is what allows the
            catalogue to grow several times over without making the first paint
            several times heavier - the initial HTML stays the size it is today.
          */}
          {deferred.map((meta) => (
            <div key={meta.id} data-row-id={meta.id}>
              <MediaRow
                row={{
                  id: meta.id,
                  emoji: meta.emoji,
                  title: meta.title,
                  items: deferredItems[meta.id]?.items ?? [],
                  nextPage: 2,
                }}
                onSelect={openDetails}
                locked={!isSignedIn}
                loading={Boolean(requested[meta.id]) && !deferredItems[meta.id]}
              />
            </div>
          ))}
        </div>

        <footer className="mt-10 border-t border-white/[0.08] bg-black/60">
          <div className="mx-auto max-w-[100rem] px-4 py-12 sm:px-6 lg:px-10">
            <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-crimson-sheen shadow-glow">
                    <Sparkles className="h-4 w-4 text-white" />
                  </span>
                  <span className="text-xl font-black uppercase tracking-tight text-white">
                    Movie<span className="text-crimson-bright">Shop</span>
                  </span>
                </div>
                <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/45">
                  Cinema-grade streaming for Kenya. Every title, every device, free
                  with an account.
                </p>
                <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/55">
                  <Smartphone className="h-3.5 w-3.5 text-crimson-bright" />
                  Free · No card needed
                </p>
              </div>

              {footerColumns.map((column) => (
                <div key={column.title}>
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/40">
                    {column.title}
                  </h3>
                  <ul className="mt-4 space-y-2.5">
                    {column.links.map((link) => (
                      <li key={link}>
                        {link === 'Sign in' || link === 'Create a free account' ? (
                          <Link
                            href="/login"
                            className="text-left text-sm text-white/60 transition-colors hover:text-crimson-bright"
                          >
                            {link}
                          </Link>
                        ) : (
                          <span className="text-left text-sm text-white/60">{link}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/[0.08] pt-6 text-xs text-white/30 sm:flex-row">
              <p>© {new Date().getFullYear()} MovieShop. All rights reserved.</p>
              <p className="flex items-center gap-1.5">
                Built with Next.js 14, Tailwind CSS and Lucide
                <Heart className="h-3.5 w-3.5 fill-crimson text-crimson" />
              </p>
            </div>
          </div>
        </footer>
      </main>

      <DetailsModal
        item={detailsItem}
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        onPlay={(item, season, episode) => requestWatch(item, season, episode)}
      />

      <NexstreamPlayer
        item={playerItem}
        open={playerOpen}
        onClose={() => setPlayerOpen(false)}
        initialSeason={playerSeason}
        initialEpisode={playerEpisode}
      />

      <SignInGate open={gateOpen} onClose={closeGate} intent={intent} />
    </div>
  );
}

export default function StoreShell({ data }: { data: HomeData }) {
  return <Store data={data} />;
}
