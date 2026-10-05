/**
 * Generates the PWA icon set from one vector source.
 *
 * Keeping the icons scripted means they can be regenerated after any brand
 * change instead of being opaque binaries nobody can edit.
 *
 *   node scripts/generate-icons.mjs
 *
 * Outputs to `public/icons/`:
 *   icon-192.png          standard Android home-screen icon
 *   icon-512.png          splash / install prompt
 *   icon-maskable-192.png maskable: content inside the 80% safe zone
 *   icon-maskable-512.png
 *   apple-touch-icon.png  180x180, opaque background (iOS ignores alpha)
 *   favicon-32.png        browser tab
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUT_DIR = path.resolve('public/icons');

/** Brand colours, matching tailwind.config.ts. */
const OBSIDIAN = '#000000';
const CRIMSON_DEEP = '#991B1B';
const CRIMSON = '#DC2626';
const CRIMSON_BRIGHT = '#EF4444';
const WHITE = '#FFFFFF';

/**
 * @param {number} size
 * @param {{ maskable?: boolean, opaque?: boolean }} options
 */
function svg(size, { maskable = false, opaque = false } = {}) {
  // Maskable icons get cropped to a circle on some launchers, so the artwork is
  // inset well inside the canvas and the background bleeds to every edge.
  const artScale = maskable ? 0.56 : 0.68;
  const corner = maskable ? 0 : size * 0.22;
  const cx = size / 2;
  const cy = size / 2;
  const plate = size * artScale;

  // Play triangle, optically centred (a geometric centre reads as left-heavy).
  const triW = plate * 0.52;
  const triH = plate * 0.6;
  const triX = cx - triW * 0.34;
  const triY = cy - triH / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${CRIMSON_DEEP}"/>
      <stop offset="45%" stop-color="${CRIMSON}"/>
      <stop offset="100%" stop-color="${CRIMSON_BRIGHT}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="42%" r="60%">
      <stop offset="0%" stop-color="${CRIMSON}" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="${CRIMSON}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${size}" height="${size}" fill="${OBSIDIAN}"/>
  <rect width="${size}" height="${size}" fill="url(#glow)"/>

  <rect
    x="${cx - plate / 2}" y="${cy - plate / 2}"
    width="${plate}" height="${plate}"
    rx="${corner}" ry="${corner}"
    fill="url(#sheen)"
  />

  <path d="M ${triX} ${triY} L ${triX + triW} ${cy} L ${triX} ${triY + triH} Z" fill="${WHITE}"/>
</svg>`;
}

const targets = [
  { file: 'icon-192.png', size: 192, options: {} },
  { file: 'icon-512.png', size: 512, options: {} },
  { file: 'icon-maskable-192.png', size: 192, options: { maskable: true } },
  { file: 'icon-maskable-512.png', size: 512, options: { maskable: true } },
  // iOS masks anything transparent to black, so this one is fully opaque.
  { file: 'apple-touch-icon.png', size: 180, options: { opaque: true } },
  { file: 'favicon-32.png', size: 32, options: {} },
];

await mkdir(OUT_DIR, { recursive: true });

for (const { file, size, options } of targets) {
  const pipeline = sharp(Buffer.from(svg(size, options))).resize(size, size);
  if (options.opaque) pipeline.flatten({ background: OBSIDIAN });
  const buffer = await pipeline.png({ compressionLevel: 9 }).toBuffer();
  await writeFile(path.join(OUT_DIR, file), buffer);
  console.log(`  ${file.padEnd(24)} ${size}x${size}  ${(buffer.length / 1024).toFixed(1)} KB`);
}

console.log(`\nWrote ${targets.length} icons to public/icons/`);
