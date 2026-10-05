'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { ResolvedPlayback } from '@/lib/playback';

interface CcPlayerProps {
  playback: ResolvedPlayback;
  /** Bumping this remounts the element, which is how we recover from a stall. */
  attempt: number;
  onError: (message: string) => void;
}

/**
 * Plays the CC pool with hls.js for adaptive manifests, native <video> for
 * progressive MP4. A stall watchdog fails over to the caller's retry path,
 * mirroring the original reference implementation — a dead CDN should
 * degrade, not black-screen.
 */
export default function CcPlayer({ playback, attempt, onError }: CcPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<import('hls.js').default | null>(null);
  const [ready, setReady] = useState(false);
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    setReady(false);
    setStalled(false);

    const teardown = () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };

    // Generous, because the progressive MP4s are whole films and a slow
    // connection can sit in readyState 0 well past any tight watchdog without
    // being dead. Genuine failures are caught by onError instead.
    const guard = setTimeout(() => {
      if (!cancelled && video.readyState < 3) setStalled(true);
    }, 30000);

    const onMeta = () => {
      clearTimeout(guard);
      setReady(true);
      setStalled(false);
    };
    video.addEventListener('loadedmetadata', onMeta);

    if (playback.hls) {
      // Native HLS only exists on Safari; hls.js covers everything else.
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = playback.url;
      } else {
        void import('hls.js').then(({ default: Hls }) => {
          if (cancelled) return;
          if (!Hls.isSupported()) {
            onError('HLS is not supported in this browser.');
            return;
          }
          const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
          hlsRef.current = hls;
          hls.loadSource(playback.url);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (cancelled) return;
            setReady(true);
            setStalled(false);
            void video.play().catch(() => undefined);
          });
          hls.on(Hls.Events.ERROR, (_evt, data) => {
            if (cancelled || !data.fatal) return;
            teardown();
            onError(`Stream failed: ${data.details ?? 'unknown error'}`);
          });
        });
      }
    } else {
      video.src = playback.url;
    }

    return () => {
      cancelled = true;
      clearTimeout(guard);
      video.removeEventListener('loadedmetadata', onMeta);
      teardown();
    };
  }, [playback.url, playback.hls, attempt, onError]);

  return (
    <div className="relative h-full w-full bg-black">
      <video
        ref={videoRef}
        key={`${playback.url}-${attempt}`}
        controls
        playsInline
        preload="metadata"
        poster={playback.url.endsWith('.m3u8') ? undefined : undefined}
        className="h-full w-full bg-black"
        onError={() => onError('This stream could not be loaded.')}
      >
        <track kind="captions" />
      </video>

      {!ready && !stalled && (
        <div className="absolute inset-0 grid place-items-center bg-black">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-9 w-9 animate-spin text-crimson-bright" />
            <p className="text-xs font-semibold uppercase tracking-widest text-white/45">
              Starting stream… this can take a moment on slow connections
            </p>
          </div>
        </div>
      )}

      {stalled && !ready && (
        <div className="absolute inset-0 grid place-items-center bg-black/90 px-6 text-center">
          <div className="flex flex-col items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-amber-400" />
            <p className="text-sm font-semibold text-white/85">Stream is not responding</p>
            <p className="text-xs text-white/45">
              This open-movie CDN may be rate limiting or offline.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
