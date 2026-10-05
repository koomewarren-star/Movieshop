# MovieShop

Cinema-grade streaming and discovery for Kenya. Trending films, TV series and anime
in 4K, behind one flat **50 Bob / month** M-Pesa Access Pass.

Built with **Next.js 14 (App Router)**, **Tailwind CSS**, **Lucide Icons** and
**TypeScript**.

---

## Quick start

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

That's it — the TMDB key is already wired up in `.env.local`.

### Other scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint via `next/core-web-vitals` |
| `npm run typecheck` | `tsc --noEmit` |

---

## Environment variables

Configured in `.env.local` (git-ignored). `.env.example` is the template.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_TMDB_API_KEY` | Yes | TMDB v3 API key. Free at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) |
| `NEXT_PUBLIC_NEXSTREAM_KEY` | Yes | NexStream embed key. Falls back to `DEMO_36bed89b` when empty |
| `NEXT_PUBLIC_PLAYBACK_PROVIDER` | No | Default playback provider: `nexstream` or `cc`. Overridable per viewer |
| `TMDB_BEARER_TOKEN` | No | Optional TMDB v4 read token, used **server-side** |

### A note on the two TMDB keys

Your spec asked for both keys as `NEXT_PUBLIC_*` variables. I wrote the v4 bearer
token as plain `TMDB_BEARER_TOKEN` instead, because:

- Anything prefixed `NEXT_PUBLIC_` is **inlined into the JavaScript bundle** and
  served to every visitor. It is not a secret and cannot be kept secret.
- A TMDB v3 key is designed to be public and is low-stakes.
- A v4 **bearer token is a real account credential**, and exposing one invites
  quota abuse against your account.

So the v3 key (which is all MovieShop needs) stays public, and the bearer token
is read only in server code as an `Authorization: Bearer` header. If you want the
bearer path, set `TMDB_BEARER_TOKEN` and leave `NEXT_PUBLIC_TMDB_API_KEY` blank —
`lib/tmdb.ts` prefers the bearer when present.

Either way, all TMDB traffic goes through the `/api/search` and `/api/details`
route handlers, so the key is never sent from the browser.

### Running without a TMDB key

If `NEXT_PUBLIC_TMDB_API_KEY` is empty, MovieShop falls back to a bundled demo
catalogue (real TMDB ids, real YouTube trailer keys) so the UI is never empty.
`HomeData.source` is `'tmdb'` or `'demo'` accordingly.

---

## Features

### Navigation
- **MovieShop logo** with a crimson play icon and bold white type
- **Instant search** — 280 ms debounced TMDB autocomplete, arrow-key navigation,
  `/` to focus, stale requests aborted via `AbortController`
- **Live subscription pill** — reads `50 Bob / Month` or `Subscribed`

### Hero billboard carousel
- Rotates the top 5 trending titles every 8 s, pausing on hover
- Muted auto-playing trailer preview behind the backdrop
- Gradient cinema grading, glowing crimson **Watch Now** CTA
- Badges: IMDb rating (`8.5+` gets a `+`), 4K Ultra HD, release year, genres
- Dot indicators and prev/next arrows

### Trailer Reels
- Vertical **9:16** story-style cards in a snap-scrolling strip
- **Auto-plays the trailer on hover** (or tap the play chip on touch devices)
- Unmounting the iframe on mouse-leave is what stops the audio — a paused
  YouTube iframe keeps playing

### Discovery rows
Horizontal swipeable rows with hover-zoom poster cards, snap scrolling, edge
fades, and arrow controls that disable at each end:

- 🔥 Trending Today in Kenya — `discover/movie?region=KE`
- 💥 Action & Blockbusters — genres 28, 12
- 📺 Top TV Series & Anime — genres 16, 10765
- ✨ Recently Released — release-date window, last 45 days

### Details modal & player
- High-res backdrop, tagline, genre tags, cast carousel
- **Season / episode selector** for TV, bounded by the real season count
- Two interchangeable playback providers, switchable in the player header and
  persisted in `localStorage` under `movieshop:provider`:

  | Provider | Plays | Ads | Verification |
  | --- | --- | --- | --- |
  | **NexStream** | The real browsed title | Provider-injected; AdSense is *required* | May prompt for human checks |
  | **CC Open Movies** | Substitute open-licensed footage | None | None |

  Default comes from `NEXT_PUBLIC_PLAYBACK_PROVIDER` (`nexstream` | `cc`).

  NexStream embeds are:
  - `https://api.codespecters.com/embed/movie/{tmdbId}?apikey={key}`
  - `https://api.codespecters.com/embed/tv/{tmdbId}/{season}/{episode}?apikey={key}`

  It is a third-party iframe: it loads ad networks, runs an adblock detector
  that refuses playback when ads are blocked, and hands off to a
  Cloudflare-challenged page. None of that is controllable from this side.

  The `cc` provider maps each title deterministically onto Blender Foundation
  open movies (CC BY) via hls.js, and **labels what is actually on screen** — the
  provenance bar names the real footage and the CC BY credit renders underneath
  as the licence requires. Selection is biased towards the HLS ladders
  (`HLS_WEIGHT`) since they start fast, whereas the Internet Archive MP4s are
  whole films (Sintel is ~92 MB) and can stall on a slow connection.

  To serve licensed content instead, set `NEXT_PUBLIC_PLAYBACK_PROVIDER` and
  route it through a server-side proxy so the provider's credentials never
  reach the browser.

### M-Pesa paywall
Clicking **Watch Now** or **Play** while unsubscribed opens the *MovieShop Access
Pass* modal:

- Validates `07XXXXXXXX`, `01XXXXXXXX` or `2547XXXXXXXX`
- Simulates the STK push round trip: `authorizing → awaiting → processing → success`,
  showing the `*334*50#` prompt to enter on the handset
- On success grants access and persists `{ isSubscribed: true }` (plus phone,
  timestamp and receipt id) to `localStorage` under `movieshop:subscription`
- Once paid, the originally-requested title opens automatically
- "Reset demo subscription" in the footer clears it

---

## Installable as an app (PWA)

MovieShop is installable on Android from the browser — no app store, no APK
toolchain required. Chrome will offer the install prompt, or use the
**Install MovieShop** banner that appears once the app is considered
installable.

### What's there

| File | Purpose |
| --- | --- |
| `app/manifest.ts` | Web app manifest: `standalone` display, `portrait`, `#000000` theme, 4 icons (2 maskable), 2 shortcuts |
| `public/sw.js` | Service worker: offline shell, asset caching, poster revalidation |
| `app/offline/page.tsx` | Branded offline fallback |
| `components/InstallPrompt.tsx` | Service worker registration + custom install banner |
| `scripts/generate-icons.mjs` | Regenerates the icon set from one vector source |

```bash
node scripts/generate-icons.mjs   # after any brand change
```

### Caching rules, and why

The service worker is deliberately conservative, because a cache that is too
eager breaks the app:

- **`/api/*` is never cached.** Search and details go straight to the network, so
  the catalogue and cast lists are never stale.
- **Third-party playback is untouched.** YouTube trailers and the stream embeds
  are not intercepted at all.
- **Navigations are network-first**, falling back to cache and then the offline
  page. Content updates appear immediately.
- **`/_next/static/*` is cache-first.** Those filenames are content-hashed, so a
  changed asset always has a new URL.
- **TMDB posters are stale-while-revalidate** with a 120-entry cap, since poster
  paths are immutable.
- **Old caches are dropped on activate.** Bump `CACHE_VERSION` in `sw.js` to
  invalidate everything.

Registration is **gated to production**. A service worker in dev caches dev
chunks and reproduces the stale-asset blank page.

### Requirements

- **HTTPS.** Service workers and install prompts are unavailable over plain
  HTTP. `localhost` is exempt, which is why it works locally but will not on a
  LAN IP. Deploy behind TLS (Vercel's free tier is the easy path) or use
  `ngrok`/`cloudflared` for a temporary HTTPS tunnel.
- **Chrome or Edge on Android.** Firefox and Safari do not support
  `beforeinstallprompt`, so the banner simply does not appear there.

### Verifying it works

1. `npm run build && npm run start` — dev mode never registers the worker
2. Open DevTools → Application → Manifest, confirm no errors
3. Application → Service Workers, confirm `sw.js` is **activated and running**
4. Application → Cache Storage, expect `movieshop-shell-*`, `-assets-*`, `-images-*`
5. Install from the banner or the browser menu, then confirm it launches fullscreen
6. Toggle Offline in DevTools → Network and reload: you should get the branded
   offline page, not a browser dinosaur

### Turning it into a real APK later

A PWA is installable but not a Play Store listing. For that, wrap the deployed
site with Capacitor and build in the cloud via EAS Build, which avoids
installing a local JDK and Android SDK:

```bash
npm i -D @capacitor/cli
npx cap init
npx cap add android
npx cap sync
npx eas build --platform android
```

Note that Capacitor must load the **deployed URL** rather than bundling the
build, because this app depends on `/api/*` routes and server-side TMDB
fetching — a fully bundled static shell has no server and search, details and
the catalogue would all break.

### Offline downloads

The player has a crimson **480p** button next to the server switcher. It streams
from `/api/download`, tracks progress, and saves the file to IndexedDB; open it
from **My Downloads** (`/downloads`) to play back with no network.

| File | Purpose |
| --- | --- |
| `app/api/download/route.ts` | Runs `yt-dlp`, pipes a 480p MP4 back as an attachment |
| `lib/offlineStorage.ts` | IndexedDB store via `idb-keyval` |
| `app/downloads/page.tsx` | Library page with offline `<video>` playback |

**Requirements on the server host:** `yt-dlp` **and** `ffmpeg` must be
installed. `ffmpeg` is not optional — `bestvideo+bestaudio` are two separate
streams, and without a merger `yt-dlp` downloads both, exits `0`, and leaves no
output file at all.

The route resolves both binaries by absolute path (Python `Scripts` dir and the
`imageio-ffmpeg` wheel are both probed), because a pm2/Node service does not
inherit the `PATH` a desktop shell has.

#### What is downloadable, honestly

`yt-dlp` reads a media page or a direct media file. It **cannot** read an iframe
embed, so the three embed providers are not downloadable:

| Provider | Downloadable | Why |
| --- | --- | --- |
| **CC Open Movies** | ✅ Yes | Direct `.mp4` / `.m3u8` URLs |
| **NexStream** | ❌ No | `api.codespecters.com/embed/...` is an embed page |
| **VidSrc** | ❌ No | `vidsrc.to/embed/...` is an embed page |
| **AutoEmbed** | ❌ No | `player.autoembed.co/embed/...` is an embed page |

yt-dlp answers `ERROR: Unsupported URL` for all three. Making them work needs a
per-provider source resolver, not a format string — see the button's failure
path in `NexstreamPlayer.tsx`, which surfaces the error instead of hanging.

Also note the 480p cap is best-effort. The mux Tears of Steel stream publishes
a 1920x800 variant only, so the route retries with the constraint relaxed rather
than failing.

## Project structure

```
app/
  layout.tsx              Root layout, metadata, Inter font
  page.tsx                Server component; fetches home data
  globals.css             Tailwind layers, crimson theme utilities
  api/
    search/route.ts       Proxies TMDB autocomplete
    details/route.ts      Proxies cast / genres / season counts
components/
  Navbar.tsx              Logo, search, subscription pill, mobile drawer
  HeroBanner.tsx          Rotating hero carousel with trailer preview
  MediaCard.tsx           Poster card with hover-zoom and play overlay
  MediaRow.tsx            Swipeable row with arrows and edge fades
  TrailerReels.tsx        9:16 hover-to-autoplay reel strip
  DetailsModal.tsx        Cast, genres, season/episode picker
  NexstreamPlayer.tsx     Player modal, provider A/B toggle
  CcPlayer.tsx            hls.js / native playback for the CC pool
  MpesaPaywall.tsx        Access Pass modal + STK state machine
  SearchBar.tsx           Debounced autocomplete
  SubscriptionProvider.tsx  localStorage-backed subscription context
  StoreShell.tsx          Client orchestrator; wires the paywall flow
  InstallPrompt.tsx       Service worker registration + install banner
lib/
  tmdb.ts                 TMDB client, mapping, demo catalogue
  nexstream.ts            Embed URL builders
  playback.ts             Provider selection + A/B switch
  cc-sources.ts           CC BY open-movie pool with attribution
  mpesa.ts                Plan, phone validation, STK simulation
  types.ts                Shared types
public/
  sw.js                   Service worker
  icons/                  Generated PWA icon set
scripts/
  generate-icons.mjs      Regenerates public/icons from vector source
```

---

## The subscription flow

```
User clicks Watch Now / Play
        │
        ▼
  isSubscribed?  ──yes──▶  open NexstreamPlayer
        │ no
        ▼
  open MpesaPaywall  (remember the title as `intent`)
        │
        ▼
  validate phone → stkPush() state machine
        │
        ▼
  subscribe() → localStorage → open NexstreamPlayer for that title
```

Every gate lives in `requestWatch()` in `components/StoreShell.tsx`, so a new
entry point gets the paywall for free.

---

## Design system

| Token | Value |
| --- | --- |
| Obsidian | `#000000` |
| Deep zinc | `#09090b` |
| Charcoal | `#18181b` |
| Crimson | `#DC2626` |
| Crimson bright | `#EF4444` |
| White | `#FFFFFF` |

Utilities: `btn-glow` (primary CTA with sweeping highlight), `btn-ghost`,
`chip` / `chip-red`, `glass` / `glass-strong`, `no-scrollbar`, `shadow-glow` /
`shadow-glow-lg`. Honours `prefers-reduced-motion`.

---

## Going live with real M-Pesa payments

`lib/mpesa.ts` contains a local simulation. To take real money, create
`app/api/mpesa/stkpush/route.ts` that posts to Safaricom Daraja:

```
POST https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest
  Authorization: Bearer <O_ACCESS_TOKEN>
```

Use the returned `CheckoutRequestID` and the Daraja **callback URL** to confirm
payment server-side, then call `subscribe()` only after the callback verifies the
amount (`50`) and MSISDN match. Never trust the client to confirm its own
payment — treat the local `localStorage` flag as a UI convenience, and gate real
entitlement on a server-side session.

---

## Licence & content

MovieShop is a UI and integration reference. You are responsible for holding the
rights to distribute any content you stream. TMDB is a metadata API — see
[their terms](https://www.themoviedb.org/faq) — and this project is not
affiliated with or endorsed by TMDB.
