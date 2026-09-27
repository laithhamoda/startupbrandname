// Lighthouse on every public page, in both languages (M2b definition of done: SEO and
// accessibility score 100). Run after a production build with indexing on:
//
//   VERCEL_ENV=production SITE_INDEXABLE=true pnpm build && pnpm lighthouse
//
// Chrome maps startupbrandname.com to the local server and resolves no other host, so canonical
// links, hreflang and robots.txt are checked as they will be served at launch, and nothing ever
// reaches the live site. Reports are written to lighthouse-report/.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { PUBLIC_PAGES } from '../src/config/public-pages.ts';

const PORT = 3100;
const LOCAL = `http://127.0.0.1:${String(PORT)}`;
const REQUIRED = { seo: 1, accessibility: 1 };
// Shared CI runners make timing scores noisy: reported, not enforced.
const REPORTED = ['performance', 'best-practices'];
const REPORT_DIR = new URL('../lighthouse-report/', import.meta.url);

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${LOCAL}/robots.txt`);
      if (response.ok) return await response.text();
    } catch {
      // Not listening yet.
    }
    await sleep(500);
  }
  throw new Error('The local server did not start.');
}

const server = spawn('pnpm', ['start', '--port', String(PORT)], { stdio: 'ignore' });
let chrome;
let failed = false;

try {
  const robots = await waitForServer();
  if (/Disallow: \/$/m.test(robots)) {
    throw new Error(
      'The build is not indexable. Build with VERCEL_ENV=production SITE_INDEXABLE=true.',
    );
  }

  chrome = await chromeLauncher.launch({
    chromeFlags: [
      '--headless=new',
      '--no-sandbox',
      `--host-resolver-rules=MAP startupbrandname.com 127.0.0.1:${String(PORT)},MAP * ~NOTFOUND`,
      // Keeps Chrome on plain HTTP for the local server instead of trying HTTPS first.
      '--disable-features=HttpsUpgrades',
    ],
  });
  await mkdir(REPORT_DIR, { recursive: true });

  const rows = [];
  for (const locale of ['ar', 'en']) {
    for (const { id, path } of PUBLIC_PAGES) {
      const url = `http://startupbrandname.com/${locale}${path}`;
      const result = await lighthouse(url, {
        port: chrome.port,
        output: 'html',
        logLevel: 'error',
        onlyCategories: [...Object.keys(REQUIRED), ...REPORTED],
      });
      if (!result) throw new Error(`No result for ${url}`);
      const { lhr, report } = result;
      if (lhr.runtimeError) throw new Error(`${url}: ${lhr.runtimeError.message}`);
      await writeFile(new URL(`${locale}-${id}.html`, REPORT_DIR), String(report));

      const scores = Object.fromEntries(
        Object.entries(lhr.categories).map(([key, category]) => [key, category.score]),
      );
      rows.push({ page: `/${locale}${path}`, ...scores });

      for (const [category, minimum] of Object.entries(REQUIRED)) {
        if ((scores[category] ?? 0) >= minimum) continue;
        failed = true;
        const audits = lhr.categories[category].auditRefs
          .filter((ref) => ref.weight > 0 && (lhr.audits[ref.id].score ?? 1) < 1)
          .map((ref) => `${ref.id}: ${lhr.audits[ref.id].title}`);
        console.error(`✗ ${url} ${category} ${String(scores[category])}\n  ${audits.join('\n  ')}`);
      }
    }
  }
  console.table(rows);
} catch (error) {
  failed = true;
  console.error(error);
} finally {
  await chrome?.kill();
  server.kill();
}

process.exitCode = failed ? 1 : 0;
