import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const DESCRIPTION =
  'Cinema-grade streaming for Kenya. Trending films, TV series and anime in 4K. One flat M-Pesa Access Pass.';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MovieShop — Unlimited HD Movies & TV',
    short_name: 'MovieShop',
    description: DESCRIPTION,
    id: '/',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone', 'browser'],
    orientation: 'portrait',
    background_color: '#000000',
    theme_color: '#000000',
    categories: ['entertainment', 'video', 'multimedia'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      // Maskable variants get cropped to a circle/squircle by Android launchers,
      // so artwork has to survive losing its corners.
      {
        src: '/icons/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Trailer Reels',
        short_name: 'Reels',
        description: 'Jump straight to the 9:16 trailer feed',
        url: '/?source=shortcut#reels',
      },
      {
        name: 'Browse Catalogue',
        short_name: 'Browse',
        description: 'Browse all discovery rows',
        url: '/?source=shortcut#browse',
      },
    ],
  };
}
