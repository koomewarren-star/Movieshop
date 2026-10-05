/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /*
   * Transpile webtorrent for the client bundle.
   *
   * webtorrent ships both a Node entry and a browser entry, selected by the
   * `browser` field in its package.json. Next's bundler does not honour that
   * field for dynamically imported packages, so without this the browser
   * receives a bare `import('webtorrent')` it cannot resolve. The failure is at
   * runtime — "Failed to resolve module specifier" — not at build time.
   */
  transpilePackages: ['webtorrent'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'image.tmdb.org' },
    ],
    /*
     * Serve TMDB artwork straight from their CDN instead of proxying it
     * through `/_next/image`.
     *
     * The optimizer made this app look broken. Every poster became a
     * server-side fetch of `image.tmdb.org`, and when that request timed out
     * the route logged `Error: failed to pipe response` and the browser got a
     * broken image. With ~700 poster cards in the document that is up to 700
     * serialised upstream round trips on one flaky connection.
     *
     * It was also redundant work: TMDB's CDN already resizes via its own path
     * segment (`/t/p/w500/`, `/t/p/original/`), so the proxy was re-doing work
     * the origin had already done, only slower.
     *
     * Re-enable `unoptimized` if you move hosting somewhere with a reliable
     * route to TMDB and want the bandwidth savings.
     */
    unoptimized: true,
  },
};

export default nextConfig;
