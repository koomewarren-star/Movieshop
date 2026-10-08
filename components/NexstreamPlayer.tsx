'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Expand,
  Info,
  Loader2,
  Minimize,
  Minus,
  Play,
  Plus,
  RotateCcw,
  ShieldAlert,
  Star,
  X,
} from 'lucide-react';
import CcPlayer from '@/components/CcPlayer';
import {
  DEFAULT_PROVIDER,
  PROVIDER_LABELS,
  PROVIDER_NOTES,
  PROVIDER_ORDER,
  PROVIDER_STORAGE_KEY,
  isProviderId,
  providerNote,
  resolvePlayback,
  type ProviderId,
} from '@/lib/playback';
import type { MediaItem } from '@/lib/types';
import PlayerShield from '@/components/PlayerShield';
import { useAdRedirectBlocker } from '@/hooks/useAdRedirectBlocker';
import { recordProgress } from '@/lib/watchProgress';

interface NexstreamPlayerProps {
  item: MediaItem | null;
  open: boolean;
  onClose: () => void;
  initialSeason?: number;
  initialEpisode?: number;
}

/** Retries a stalled cc stream this many times before giving up. */
const MAX_ATTEMPTS = 2;

export default function NexstreamPlayer({
  item,
  open,
  onClose,
  initialSeason = 1,
  initialEpisode = 1,
}: NexstreamPlayerProps) {
  const [provider, setProvider] = useState<ProviderId>(DEFAULT_PROVIDER);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState(initialSeason);
  const [episode, setEpisode] = useState(initialEpisode);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  /* Restore the viewer's chosen provider. */
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PROVIDER_STORAGE_KEY);
      if (isProviderId(saved)) setProvider(saved);
    } catch {
      /* private mode — keep the default */
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!open || !item) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, item]);

  useEffect(() => {
    if (!open || !item) return;
    setLoading(true);
    setSeason(initialSeason);
    setEpisode(initialEpisode);
    setAttempt(0);
    setError(null);
  }, [open, item, initialSeason, initialEpisode]);

  /*
    Feed the Continue Watching row.
 *
    Progress is read from the provider iframe by polling it on a timer, since a
    cross-origin embed gives us no events. The iframe is polled only while it
    actually exists, and the last known good position is kept in a ref so
    closing the player can record a final value even if the iframe is already
    gone by then.

    With a single provider there is exactly one iframe to watch, so this is a
    narrow piece of work rather than a general multi-provider event bridge.
  */
  const progressRef = useRef({ time: 0, duration: 0 });

  useEffect(() => {
    if (!open || !item) return;

    progressRef.current = { time: 0, duration: 0 };
    let lastRecorded = -1;

    const commit = (time: number, duration: number) => {
      if (!duration || !Number.isFinite(time) || !Number.isFinite(duration)) return;
      const ratio = time / duration;
      if (ratio <= 0 || ratio >= 1) return;
      progressRef.current = { time, duration };
      // Throttled to whole percent so localStorage is not written on every tick.
      const pct = Math.floor(ratio * 100);
      if (pct === lastRecorded) return;
      lastRecorded = pct;
      recordProgress(
        { id: item.id, kind: item.kind, title: item.title, poster: item.poster },
        ratio,
        {
          season,
          episode,
          episodeLabel:
            item.kind === 'tv' ? `S${season} · E${episode}` : undefined,
        },
      );
    };

    const timer = setInterval(() => {
      const frame = document.querySelector<HTMLIFrameElement>(
        '#movieshop-player iframe',
      );
      let inner: HTMLVideoElement | null = null;
      try {
        inner = frame?.contentDocument?.querySelector('video') ?? null;
      } catch {
        // Cross-origin: unreachable, which is the expected case for the embed.
        inner = null;
      }
      if (inner) {
        commit(inner.currentTime, inner.duration);
        return;
      }
      // Fallback for the CC provider, whose <video> is rendered by us and is
      // therefore same-origin and readable.
      const own = document.querySelector<HTMLVideoElement>('#movieshop-player video');
      if (own) commit(own.currentTime, own.duration);
    }, 2000);

    return () => {
      clearInterval(timer);
      const { time, duration } = progressRef.current;
      commit(time, duration);
    };
  }, [open, item, season, episode]);

  const onKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onKey]);

  /*
    Top-level navigation and pop-under defence.

    The iframe cannot be sandboxed — the provider refuses to initialise in a
    sandboxed frame, see the comment above the iframe — so this hook and
    `PlayerShield` are the only layers available. Both are mitigation, not
    prevention: the platform offers no way to cancel a `window.top.location`
    shift or to close a window the provider opened. See the hook for the full
    reasoning.

    `promptOnExit` is on because a click-triggered hijack is exactly the case
    where Chrome honours the `beforeunload` dialog. The viewer's own back button
    and tab close during playback prompt too; the page genuinely cannot tell
    those apart from a hijack.
  */
  const { popunderDetected, dismissPopunder } = useAdRedirectBlocker(open, {
    promptOnExit: true,
  });

  const playback = useMemo(() => {
    if (!item) return null;
    return resolvePlayback(provider, item, season, episode);
  }, [provider, item, season, episode]);

  const switchProvider = (next: ProviderId) => {
    setProvider(next);
    setLoading(true);
    setAttempt(0);
    setError(null);
    try {
      window.localStorage.setItem(PROVIDER_STORAGE_KEY, next);
    } catch {
      /* non-fatal */
    }
  };

  const onCcError = useCallback(
    (message: string) => {
      setLoading(false);
      if (attempt < MAX_ATTEMPTS) {
        setAttempt((value) => value + 1);
      } else {
        setError(message);
      }
    },
    [attempt],
  );

  /*
   * Fullscreen, including the parts the standard API does not cover on phones.
   *
   * iOS Safari predates the unprefixed API: it needs `webkitRequestFullscreen`
   * / `webkitExitFullscreen`, and on some versions it refuses element fullscreen
   * entirely for anything that is not a <video>, which is why there is an
   * iOS-only fallback to the video element itself further down.
   *
   * The orientation lock is the other half of "fill the whole screen": without
   * it Android keeps whatever orientation the phone was in, so a portrait-locked
   * device gets a tall black letterbox around a 16:9 video.
   */
  const goFullscreen = async () => {
    const el = document.getElementById('movieshop-player');
    if (!el) return;

    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void>;
    };
    const target = el as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    /*
     * `ScreenOrientation.lock()` is non-standard and deliberately absent from
     * lib.dom, so it is declared locally rather than cast at each call site.
     */
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (o: string) => Promise<void>;
      unlock?: () => void;
    };

    const active =
      document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;

    if (active) {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else {
          await doc.webkitExitFullscreen?.();
        }
      } catch {
        /* the user may have exited via the system UI already */
      }
      void orientation.unlock?.();
      return;
    }

    try {
      // Preferred: fill the whole viewport.
      if (target.requestFullscreen) {
        await target.requestFullscreen({ navigationUI: 'hide' });
      } else if (target.webkitRequestFullscreen) {
        await target.webkitRequestFullscreen();
      } else {
        // iOS fallback - only a real <video> can go fullscreen there.
        const video = el.querySelector('video') as
          | (HTMLVideoElement & { webkitEnterFullscreen?: () => void })
          | null;
        video?.webkitEnterFullscreen?.();
        return;
      }
    } catch {
      const video = el.querySelector('video') as
        | (HTMLVideoElement & { webkitEnterFullscreen?: () => void })
        | null;
      video?.webkitEnterFullscreen?.();
      return;
    }

    // Landscape suits a 16:9 frame; ignore failure, not every device supports it.
    try {
      await orientation.lock?.('landscape');
    } catch {
      /* lock is best-effort */
    }
  };

  /*
   * Track fullscreen so the header, server tabs and provenance bar can step out
   * of the way. Without this they stay on screen and the video is never actually
   * edge to edge.
   */
  useEffect(() => {
    const doc = document as Document & { webkitFullscreenElement?: Element | null };
    const onChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement ?? doc.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  if (!open || !item || !playback) return null;

  const isTv = item.kind === 'tv';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${item.title} player`}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-0 backdrop-blur-md animate-scale-in sm:p-6"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-obsidian sm:h-auto sm:max-h-[92svh] sm:max-w-[78rem] sm:rounded-2xl sm:border sm:border-white/10 sm:shadow-glow-lg">
        <div className="pointer-events-none absolute -inset-x-10 -top-24 h-64 bg-[radial-gradient(40rem_20rem_at_50%_0%,rgba(220,38,38,0.28),transparent_70%)]" />

        <header className="relative z-10 flex shrink-0 items-center gap-3 border-b border-white/[0.08] bg-obsidian/80 px-4 py-3 backdrop-blur-xl sm:px-5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-crimson-sheen shadow-glow">
            <Play className="h-4 w-4 translate-x-[1px] fill-white text-white" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-bold uppercase tracking-wide text-white sm:text-base">
              {item.title}
            </h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-white/45">
              <span className="text-crimson-bright">{isTv ? 'TV Series' : 'Film'}</span>
              <span>{item.year}</span>
              {item.rating > 0 && (
                <span className="flex items-center gap-1 text-amber-300/90">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {item.rating.toFixed(1)}
                </span>
              )}
              {isTv && (
                <span className="text-white/70">
                  S{season} · E{episode}
                </span>
              )}
            </p>
          </div>

          {/* Provider tab bar now lives in its own row below this header. */}

          <button
            type="button"
            onClick={goFullscreen}
            aria-label="Toggle fullscreen"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 text-white/70 transition-colors hover:border-crimson/50 hover:bg-crimson/10 hover:text-white"
          >
            <Expand className="h-4 w-4" />
          </button>

          {/*
            P2P download is temporarily disabled.

            The control was removed here rather than deleted so it can be
            restored with a single revert. `P2PDownloader`, `lib/p2pStore.ts`
            and `types/webtorrent.d.ts` are all still present and untouched;
            dropping the last import is what keeps webtorrent out of the client
            bundle, so the module is parked rather than dead weight on page
            weight.
          */}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close player"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 text-white/70 transition-colors hover:border-crimson hover:bg-crimson/20 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/*
          Server provider tab bar.

          This lives in its own full-width row rather than inside the header.
          It was previously `hidden sm:flex`, which meant the only control for
          choosing a provider was invisible on every phone — the header could
          not fit four labels next to the title and the fullscreen/close
          buttons. As its own row it is reachable at any viewport, and it
          scrolls horizontally when the labels do not fit.
        */}
        <div
          className="no-scrollbar relative z-10 flex shrink-0 items-center gap-2 overflow-x-auto border-b border-white/[0.08] bg-obsidian/90 px-3 py-2 backdrop-blur-xl sm:px-5"
          role="group"
          aria-label="Playback server"
        >
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-white/35">
            Server
          </span>
          <div className="flex min-w-max items-center gap-1 rounded-lg border border-white/10 bg-black/40 p-1">
            {PROVIDER_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => switchProvider(id)}
                aria-pressed={hydrated && provider === id}
                title={PROVIDER_NOTES[id]}
                className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${
                  hydrated && provider === id
                    ? 'bg-crimson text-white shadow-glow'
                    : 'text-white/50 hover:bg-white/5 hover:text-white'
                }`}
              >
                {PROVIDER_LABELS[id]}
              </button>
            ))}
          </div>

          </div>

        {/* Video surface */}
        <div
          id="movieshop-player"
          className="relative z-10 aspect-video w-full shrink-0 bg-black"
        >
          {/*
            `direct` plays a real media file, so it needs a <video> element just
            like `cc` does. Rendering it in an iframe (the embed path) silently
            fails: browsers do not play an MP4 served into a frame with no
            player chrome.
          */}
          {provider === 'cc' ? (
            <CcPlayer playback={playback} attempt={attempt} onError={onCcError} />
          ) : (
            <>
              {loading && (
                <div className="absolute inset-0 z-10 grid place-items-center bg-black">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-9 w-9 animate-spin text-crimson-bright" />
                    <p className="text-xs font-semibold uppercase tracking-widest text-white/45">
                      Buffering stream…
                    </p>
                  </div>
                </div>
              )}
              {/*
                NO `sandbox` ATTRIBUTE - DELIBERATE. DO NOT ADD ONE.

                This was implemented and then reverted, because the provider
                serves a page whose entire content is:

                    "Playback blocked - This player cannot be loaded inside a
                     restricted (sandboxed) frame."

                and refuses to play. It inspects its own sandbox flags, so there
                is no token combination that both sandboxes it and keeps
                playback working.

                The cost is that nothing in this file can stop the provider
                navigating the tab or opening a pop-under. Those are enforced
                only by the sandbox tokens `allow-top-navigation`, `allow-popups`
                and `allow-top-navigation-by-user-activation`. The `allow`
                attribute below is a Permissions Policy, which cannot express
                any of them - popups and top-level navigation are outside what
                Permissions Policy governs. Setting it would look like
                hardening while changing nothing about the hijack.

                What remains is the click shield below, which absorbs the first
                gesture - the moment such a provider arms its pop-under
                listener. So the common "pressed play and got sent to an ad
                site" case is defused, even though the capability survives.

                Real containment means not running the provider's JavaScript in
                a frame at all: resolve the stream server-side and play it from
                our own origin. See lib/playback.ts.
              */}
              <iframe
                key={playback.url}
                src={playback.url}
                title={`${item.title} video player`}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                onLoad={() => setLoading(false)}
                className="h-full w-full border-0"
              />

              {/*
                Absorbs the first gesture so the provider's pop-under listener
                never fires. Absolutely positioned inside the existing video
                surface, so dimensions and layout are unchanged, and it
                unmounts itself after one click.
              */}
              <PlayerShield />

              {/*
                Pop-under notice.

                Reachable because the provider opening a window leaves this
                document alive and focused-elsewhere. Dismissing it is explicit
                rather than timed, so a viewer mid-scene is not interrupted by
                something that auto-closes.
              */}
              {popunderDetected && (
                <div
                  role="status"
                  className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-3 bg-black/90 px-4 py-2.5 text-[11px] text-white backdrop-blur-md"
                >
                  <ShieldAlert className="h-4 w-4 shrink-0 text-crimson-bright" />
                  <p className="min-w-0 flex-1">
                    MovieShop blocked a pop-up attempt and kept you here. Your
                    video is still playing.
                  </p>
                  <button
                    type="button"
                    onClick={dismissPopunder}
                    aria-label="Dismiss pop-up notice"
                    className="shrink-0 rounded-md border border-white/15 px-2 py-1 font-bold uppercase tracking-wider transition-colors hover:border-crimson hover:text-white"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </>
          )}

          {/*
            Exit control for fullscreen.

            Only the video surface goes fullscreen, which is what makes the
            picture fill the screen - but it also means the header's own
            fullscreen button is no longer on screen to toggle back. Without
            this the viewer is left relying on the system gesture to get out.
            It lives inside the fullscreen element so it stays reachable, and it
            is `safe-area` padded so it clears the notch and the home indicator.
          */}
          {isFullscreen && (
            <button
              type="button"
              onClick={goFullscreen}
              aria-label="Exit fullscreen"
              className="absolute right-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white/85 backdrop-blur-md transition-colors hover:bg-crimson/70 hover:text-white"
              style={{
                top: 'max(0.75rem, env(safe-area-inset-top))',
                right: 'max(0.75rem, env(safe-area-inset-right))',
              }}
            >
              <Minimize className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Provenance + provider note */}
        <div className="relative z-10 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-white/[0.08] bg-obsidian/90 px-4 py-2.5 text-[10px] sm:px-5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-bold uppercase tracking-wider ${
              provider === 'cc'
                ? 'bg-emerald-500/12 text-emerald-300'
                : 'bg-crimson/15 text-crimson-bright'
            }`}
          >
            {PROVIDER_LABELS[provider]}
          </span>

          {playback.isSubstitute ? (
            <span className="flex items-center gap-1.5 text-amber-300/90">
              <Info className="h-3 w-3" />
              Now playing: <strong className="font-bold">{playback.playingTitle}</strong>
            </span>
          ) : (
            <span className="text-white/40">Playing the selected title</span>
          )}

          {playback.quality && (
            <span className="text-white/40">{playback.quality}</span>
          )}

          <span className="text-white/30">{providerNote(playback)}</span>

          {error && (
            <span className="ml-auto flex items-center gap-2 text-amber-300">
              {error}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setAttempt(0);
                }}
                className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 font-bold uppercase tracking-wider hover:border-crimson hover:text-white"
              >
                <RotateCcw className="h-3 w-3" />
                Retry
              </button>
            </span>
          )}
        </div>

        {playback.credit && (
          <p className="relative z-10 shrink-0 border-t border-white/[0.06] bg-black/50 px-4 py-2 text-[10px] text-white/35 sm:px-5">
            {playback.credit}
          </p>
        )}

        {/* Episode controls */}
        {isTv && (
          <div className="relative z-10 flex flex-wrap items-center gap-3 border-t border-white/[0.08] bg-obsidian/90 px-4 py-3 backdrop-blur-xl sm:px-5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                Season
              </span>
              <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
                <button
                  type="button"
                  onClick={() => setSeason((value) => Math.max(1, value - 1))}
                  disabled={season <= 1}
                  aria-label="Previous season"
                  className="grid h-7 w-7 place-items-center rounded-md text-white/70 transition-colors hover:bg-crimson/20 hover:text-white disabled:pointer-events-none disabled:opacity-30"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-7 text-center text-sm font-bold tabular-nums text-white">
                  {season}
                </span>
                <button
                  type="button"
                  onClick={() => setSeason((value) => value + 1)}
                  aria-label="Next season"
                  className="grid h-7 w-7 place-items-center rounded-md text-white/70 transition-colors hover:bg-crimson/20 hover:text-white"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                Episode
              </span>
              <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
                <button
                  type="button"
                  onClick={() => setEpisode((value) => Math.max(1, value - 1))}
                  disabled={episode <= 1}
                  aria-label="Previous episode"
                  className="grid h-7 w-7 place-items-center rounded-md text-white/70 transition-colors hover:bg-crimson/20 hover:text-white disabled:pointer-events-none disabled:opacity-30"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="w-7 text-center text-sm font-bold tabular-nums text-white">
                  {episode}
                </span>
                <button
                  type="button"
                  onClick={() => setEpisode((value) => value + 1)}
                  aria-label="Next episode"
                  className="grid h-7 w-7 place-items-center rounded-md text-white/70 transition-colors hover:bg-crimson/20 hover:text-white"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
