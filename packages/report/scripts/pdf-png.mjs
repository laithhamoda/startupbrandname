// Rasterizes the pages of a PDF to PNG files, so a person can look at them (M5 step 0, D-241).
//
//   pnpm --filter @sbn/report run pdf:png -- <file.pdf> <outdir> [--scale 1.5] [--crop x,y,w,h]
//
// --crop keeps only that rectangle of every page, in PDF points from the top corner of the page
// (A4 is 595 x 842), to look closely at a detail; the scale then sets its sharpness.
//
// It runs pdf.js inside the same headless Chromium that makes the PDF, so it needs no native
// dependency. Set PDF_CHROMIUM_PATH, or install Playwright's Chromium (the same lookup as
// src/render/launch.ts). A development tool only: nothing imports it.
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2).filter((argument) => argument !== '--');
const scaleAt = args.indexOf('--scale');
const scale = scaleAt === -1 ? 1.5 : Number(args.splice(scaleAt, 2)[1]);
const cropAt = args.indexOf('--crop');
const crop = cropAt === -1 ? null : args.splice(cropAt, 2)[1].split(',').map(Number);
const [pdfPath, outDirectory] = args;
const badCrop =
  crop !== null && (crop.length !== 4 || crop.some((value) => !Number.isFinite(value)));
if (!pdfPath || !outDirectory || !Number.isFinite(scale) || scale <= 0 || badCrop) {
  process.stderr.write('Usage: pdf:png -- <file.pdf> <outdir> [--scale 1.5] [--crop x,y,w,h]\n');
  process.exit(2);
}

function chromiumPath() {
  const configured = process.env.PDF_CHROMIUM_PATH;
  if (configured) return configured;
  const cache = join(homedir(), '.cache', 'ms-playwright');
  const entries = existsSync(cache) ? readdirSync(cache).sort().reverse() : [];
  for (const [prefix, ...binary] of [
    ['chromium_headless_shell-', 'chrome-headless-shell-linux64', 'chrome-headless-shell'],
    ['chromium-', 'chrome-linux64', 'chrome'],
    ['chromium-', 'chrome-linux', 'chrome'],
  ]) {
    for (const entry of entries.filter((name) => name.startsWith(prefix))) {
      const candidate = join(cache, entry, ...binary);
      if (existsSync(candidate)) return candidate;
    }
  }
  throw new Error('No Chromium found: set PDF_CHROMIUM_PATH.');
}

const pdfjsBuild = join(
  dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json')),
  'build',
);
const pdfBytes = await readFile(resolve(pdfPath));
// The two files the page loads, read once at the start: a request never picks a path.
const pdfjsFiles = new Map([
  ['/pdf.mjs', await readFile(join(pdfjsBuild, 'pdf.mjs'))],
  ['/pdf.worker.mjs', await readFile(join(pdfjsBuild, 'pdf.worker.mjs'))],
]);

const PAGE = `<!doctype html><meta charset="utf-8"><body><script type="module">
try {
  const pdfjs = await import('/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
  const doc = await pdfjs.getDocument({ url: '/doc.pdf' }).promise;
  const images = [];
  for (let number = 1; number <= doc.numPages; number += 1) {
    const page = await doc.getPage(number);
    const viewport = page.getViewport({ scale: ${String(scale)} });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;
    const crop = ${JSON.stringify(crop)};
    if (crop) {
      const [x, y, w, h] = crop.map((value) => value * ${String(scale)});
      const part = document.createElement('canvas');
      part.width = Math.ceil(w);
      part.height = Math.ceil(h);
      part.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, w, h);
      images.push(part.toDataURL('image/png'));
    } else {
      images.push(canvas.toDataURL('image/png'));
    }
  }
  window.__images = images;
} catch (error) {
  window.__error = String(error && error.stack ? error.stack : error);
}
</script>`;

const server = createServer((request, response) => {
  const send = (type, body) => {
    response.writeHead(200, { 'content-type': type });
    response.end(body);
  };
  const script = pdfjsFiles.get(request.url ?? '');
  if (request.url === '/') send('text/html', PAGE);
  else if (request.url === '/doc.pdf') send('application/pdf', pdfBytes);
  else if (script) send('text/javascript', script);
  else {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const { port } = server.address();

const executablePath = chromiumPath();
const root = process.getuid?.() === 0;
const browser = await puppeteer.launch({
  executablePath,
  headless: /headless[-_]shell/.test(basename(executablePath)) ? 'shell' : true,
  args: root ? ['--no-sandbox'] : [],
});
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${String(port)}/`);
  await page.waitForFunction('window.__images !== undefined || window.__error !== undefined', {
    timeout: 60_000,
  });
  const failure = await page.evaluate('window.__error');
  if (failure) throw new Error(failure);
  const images = await page.evaluate('window.__images');
  await mkdir(resolve(outDirectory), { recursive: true });
  const stem = basename(pdfPath).replace(/\.pdf$/i, '');
  for (const [index, dataUrl] of images.entries()) {
    const file = join(resolve(outDirectory), `${stem}-p${String(index + 1)}.png`);
    await writeFile(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
    process.stdout.write(`${file}\n`);
  }
} finally {
  await browser.close();
  server.close();
}
