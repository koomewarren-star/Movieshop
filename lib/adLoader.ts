/**
 * Google AdSense loader helpers shared by every ad unit on the page.
 *
 * The `<Script>` tag itself lives in `AdBanner`, which is the only place that
 * should know a third-party script is being loaded. This module holds what more
 * than one unit needs: requesting a unit, and knowing when the loader landed.
 */

/**
 * The AdSense loader URL. Kept in one constant so the script cannot drift
 * between units, which would cause it to be fetched twice and double-count
 * impressions for a single page view.
 */
export const ADSENSE_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=';

/** Full loader URL for the configured client, or null when unconfigured. */
export function adsenseScriptUrl(): string | null {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  if (!client) return null;
  return `${ADSENSE_SRC}${client}&display=auto`;
}

/** True when an ad client id is configured. */
export function adsConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_ADSENSE_CLIENT);
}

/**
 * Requests one ad unit.
 *
 * `adsbygoogle = adsbygoogle || []` is Google's own idiom, and the array is
 * declared locally rather than through `@types/google.ads`, which is not a
 * dependency and is not worth installing for a single push.
 *
 * Every failure is swallowed. An ad that cannot load is not an application
 * error, and it must never be able to take the browse page down.
 */
export function pushAd(): void {
  if (typeof window === 'undefined') return;
  try {
    const w = window as unknown as { adsbygoogle?: unknown[] };
    if (!w.adsbygoogle) w.adsbygoogle = [];
    w.adsbygoogle.push({});
  } catch {
    /* an ad failing is not an application failure */
  }
}

const READY_FLAG = '__movieshopAdsReady';
const READY_EVENT = 'movieshop:ads-ready';

/** True once the loader script has loaded. */
export function adsReady(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as unknown as Record<string, unknown>)[READY_FLAG]);
}

/**
 * Signals that the loader is available.
 *
 * Broadcast rather than latched only on one component, because next/script
 * renders a single tag when several components share an `id`, and a unit that
 * mounts later - the deferred catalogue rows - never receives its own onLoad.
 * The event is how it finds out.
 */
export function markAdsReady(): void {
  if (typeof window === 'undefined') return;
  (window as unknown as Record<string, unknown>)[READY_FLAG] = true;
  window.dispatchEvent(new Event(READY_EVENT));
}

/**
 * Runs `cb` once the loader exists, or immediately if it already does.
 * Returns an unsubscribe function for use in an effect cleanup.
 *
 * Needed because a unit can mount before the loader has loaded, and equally
 * well after - a row scrolled into view ten minutes later finds the array
 * already present.
 */
export function whenAdsReady(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  if (adsReady() || (window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle) {
    cb();
    return () => {};
  }
  const handler = () => cb();
  window.addEventListener(READY_EVENT, handler);
  return () => window.removeEventListener(READY_EVENT, handler);
}