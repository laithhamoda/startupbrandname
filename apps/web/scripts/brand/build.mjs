import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { iconSvg, markSvg } from './mark.mjs';

// Regenerates every brand image in public/ from the geometry of the mark in mark.mjs (D-289).
// Run with `pnpm brand:build` and commit the files. It needs the Playwright browser:
// `pnpm exec playwright install chromium`. The manifest is written by hand, not here.
const PUBLIC = fileURLToPath(new URL('../../public/', import.meta.url));
const PLATE = '#000000'; // the brand's true black: the plate every app icon sits on

mkdirSync(`${PUBLIC}brand`, { recursive: true });
const write = (name, data) => writeFileSync(`${PUBLIC}${name}`, data);

const browser = await chromium.launch();

/** Renders an SVG at its own size in a real browser; the background stays transparent. */
async function png(svg, size) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`,
  );
  const data = await page.screenshot({
    omitBackground: true,
    clip: { x: 0, y: 0, width: size, height: size },
  });
  await page.close();
  return data;
}

// The brand kit: the mark in four forms, as SVG.
write('brand/mark.svg', markSvg({ id: 'a' }));
write('brand/mark-on-dark.svg', markSvg({ id: 'b', barb: 'gold' }));
write('brand/mark-mono-black.svg', markSvg({ id: 'c', mono: '#000000' }));
write('brand/mark-mono-white.svg', markSvg({ id: 'd', mono: '#ffffff' }));

// The tab icon: transparent, and the top face of the arrowhead turns gold on a dark browser theme.
// The gap between the two pieces is wider than in the logo so it survives at 16 pixels.
write(
  'icon.svg',
  iconSvg(64, 0.94, { id: 'i', barb: 'adaptive', lowerShift: 6 }).replace(
    ' width="64" height="64"',
    '',
  ),
);

// Raster sizes. The tab sizes are transparent; app icons sit on the plate.
const tabSizes = {};
for (const n of [16, 32, 48]) {
  tabSizes[n] = await png(iconSvg(n, 0.94, { id: 't', lowerShift: n <= 32 ? 8 : 5 }), n);
}
const onPlate = (id, size, share) => iconSvg(size, share, { id, barb: 'gold', plate: PLATE });
write('apple-touch-icon.png', await png(onPlate('e', 180, 0.66), 180));
write('icon-192.png', await png(onPlate('f', 192, 0.7), 192));
write('icon-512.png', await png(onPlate('g', 512, 0.7), 512));
// Maskable: the mark stays inside the central circle of 80% of the icon, the platform's safe zone.
write('icon-maskable-512.png', await png(onPlate('h', 512, 0.58), 512));
// Structured data and press: square, transparent, with room around the mark.
write('brand/logo-512.png', await png(iconSvg(512, 0.8, { id: 'j' }), 512));

// favicon.ico: three PNG images (16, 32 and 48 pixels), the form every current browser reads.
const sizes = [16, 32, 48];
const header = Buffer.alloc(6);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = 6 + sizes.length * 16;
const directory = sizes.map((n) => {
  const entry = Buffer.alloc(16);
  entry[0] = n;
  entry[1] = n;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(tabSizes[n].length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += tabSizes[n].length;
  return entry;
});
write('favicon.ico', Buffer.concat([header, ...directory, ...sizes.map((n) => tabSizes[n])]));

await browser.close();
console.log('Brand images written to apps/web/public.');
