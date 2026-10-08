import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import InstallPrompt from '@/components/InstallPrompt';
import ActivityTracker from '@/components/ActivityTracker';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MovieShop — Unlimited HD Movies & TV Series, Free',
  description:
    'Cinema-grade streaming for Kenya. Trending films, TV series and anime in 4K. Free with an account — no card, no M-Pesa, no subscription.',
  applicationName: 'MovieShop',
  manifest: '/manifest.webmanifest',
  keywords: ['MovieShop', 'streaming', 'movies', 'tv series', 'anime', 'free streaming', 'Kenya'],
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  // Lets search engines and link unfurlers pick up the install-friendly card.
  appleWebApp: {
    capable: true,
    title: 'MovieShop',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
  // Next maps appleWebApp to the apple-* tags. Android's equivalent is a plain
  // custom meta: not required by modern Chrome, but still respected by older
  // WebViews and some OEM launchers when deciding to fullscreen.
  other: {
    'mobile-web-app-capable': 'yes',
  },
  openGraph: {
    title: 'MovieShop — Stream Unlimited HD, Free',
    description: 'Trending films, series and anime in 4K. Free with an account. No card needed.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  // Standalone mode has no browser UI, so the status bar has to be drawn
  // manually on Android.
  viewportFit: 'cover',
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.variable}>
        {children}
        <ActivityTracker />
        <InstallPrompt />
      </body>
    </html>
  );
}
