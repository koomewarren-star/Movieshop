'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { adsConfigured, adsenseScriptUrl, markAdsReady, pushAd, whenAdsReady } from '@/lib/adLoader';

/**
 * Display ad unit.
 *
 * Scoped deliberately. This renders only in components this application owns.
 * The video surface is a cross-origin third-party embed and cannot host an ad
 * from here, and nothing here should be rendered inside the player modal:
 * doing so would put third-party script in the same frame as the video and
 * reintroduce the redirect and pop-under problems the player is built to avoid.
 *
 * Page weight: the loader is deferred until after hydration and while the
 * browser is idle, so an ad never competes with the catalogue for a viewer's
 * first paint or bandwidth.
 *
 * Layout stability: the container reserves its height before any ad arrives, so
 * a slow or blocked ad cannot shift the rows underneath it. That reservation is
 * the whole reason the min-height is declared here rather than left to whatever
 * size the network eventually returns, which is what produces CLS.
 */

/** Reserved height per placement, so nothing reflows when an ad loads. */
const MIN_HEIGHT: Record<AdBannerVariant, string> = {
  leaderboard: 'min-h-[90px]',
  inFeed: 'min-h-[250px]',
  footer: 'min-h-[90px]',
};

export type AdBannerVariant = 'leaderboard' | 'inFeed' | 'footer';

interface AdBannerProps {
  /** Ad unit id from the AdSense dashboard. Distinct per placement. */
  slot: string;
  variant?: AdBannerVariant;
  className?: string;
  /** Set false to suppress a slot in a specific context. Defaults to true. */
  enabled?: boolean;
}

export default function AdBanner({
  slot,
  variant = 'inFeed',
  className = '',
  enabled = true,
}: AdBannerProps) {
  const [requested, setRequested] = useState(false);

  /*
    Request this unit once the loader exists.

    Two orderings happen in practice and both need handling: a unit can mount
    before the loader has arrived, and a deferred catalogue row can mount long
    after it has. `whenAdsReady` covers the second; its immediate branch covers
    the first.
   */
  useEffect(() => {
    if (requested || !enabled || !slot) return;
    const off = whenAdsReady(() => {
      pushAd();
      setRequested(true);
    });
    return off;
  }, [requested, enabled, slot]);

  /*
    Bail out when there is no zone id or no client id.

    Rendering nothing is the correct behaviour: a labelled empty box is worse
    than no ad, and getting this wrong produces a hydration mismatch that takes
    down the whole browse page rather than just one slot.
   */
  if (!enabled || !adsConfigured() || !slot) return null;

  const scriptUrl = adsenseScriptUrl();

  return (
    <div className={`w-full ${className}`} role="complementary" aria-label="Advertisement">
      {/*
        Outside the container, so it sits above the ad rather than inside the
        ad's own box. That is where networks expect the disclosure label, and it
        stops the label being mistaken for part of the creative.
      */}
      <p className="mb-1.5 text-center text-[10px] font-semibold uppercase tracking-widest text-white/25">
        Advertisement
      </p>

      <div
        className={`w-full overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/50 p-2 text-center ${MIN_HEIGHT[variant]}`}
      >
        {/*
          The shared `id` keeps this to a single tag. next/script renders one
          script when several components declare the same id, so four ad units
          on a page still produce one request rather than four, and impressions
          are counted once per page view instead of once per slot.

          A module-level "who owns the script" flag was tried here first and was
          not reliable: React double-invokes effects in development, so the
          first mount can claim ownership and the second pass then early-out
          before ever rendering the tag.
        */}
        {scriptUrl && (
          <Script
            id="movieshop-adsense-loader"
            src={scriptUrl}
            strategy="afterInteractive"
            onLoad={() => {
              markAdsReady();
              pushAd();
            }}
          />
        )}

        <ins
          className="adsbygoogle block w-full"
          style={{ display: 'block' }}
          data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_CLIENT}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
}