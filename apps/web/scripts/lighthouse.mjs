// Lighthouse on every public page, in both languages (M2b definition of done: SEO and
// accessibility score 100), with the performance budget of D-054 (PERF-5): a layout shift under
// 0.1 and at most BYTE_BUDGETS of script and font per page. Run after a production build with
// indexing on:
//
//   VERCEL_ENV=production SITE_INDEXABLE=true pnpm build && pnpm lighthouse
//
// The pages are served as they will be at launch: https://startupbrandname.com, through a local
// HTTPS proxy with a throwaway certificate (needs openssl). Chrome maps that host to the proxy
// and resolves no other host, so canonical links, hreflang and robots.txt are checked for real and
// nothing ever reaches the live site. Reports are written to lighthouse-report/.
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { PUBLIC_PAGES } from '../src/config/public-pages.ts';

const PORT = 3100;
const TLS_PORT = 3443;
const REQUIRED = { seo: 1, accessibility: 1 };
// Shared CI runners make timing scores noisy: reported, not enforced. The performance category
// also runs the layout-shift and resource-summary audits that the budget below reads.
const REPORTED = ['performance', 'best-practices'];
// Layout shift is not a timing: a page at 0.1 or above fails (Core Web Vitals "good" is < 0.1).
const MAX_LAYOUT_SHIFT = 0.1;
// Bytes over the network per page (scripts gzipped by the server, fonts as stored), the largest
// measured on 2026-10-05 plus about 10%: script 193,669 B (/pricing; 182,702 B elsewhere), font
// 105,897 B (D-171). Raise one only with a reason in docs/DECISIONS.md.
const BYTE_BUDGETS = { script: 213_000, font: 116_500 };
const REPORT_DIR = new URL('../lighthouse-report/', import.meta.url);

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${String(PORT)}/robots.txt`);
      if (response.ok) return await response.text();
    } catch {
      // Not listening yet.
    }
    await sleep(500);
  }
  throw new Error('The local server did not start.');
}

const server = spawn('pnpm', ['start', '--port', String(PORT)], { stdio: 'ignore' });
// One temporary folder for the certificate and Chrome's profile, removed at the end.
const workDir = await mkdtemp(join(tmpdir(), 'sbn-lighthouse-'));
let proxy;
let chrome;
let failed = false;

try {
  const robots = await waitForServer();
  if (/Disallow: \/$/m.test(robots)) {
    throw new Error(
      'The build is not indexable. Build with VERCEL_ENV=production SITE_INDEXABLE=true.',
    );
  }

  // HTTPS in front of the Next.js server, with a certificate that lives for this run only.
  const keyPath = join(workDir, 'key.pem');
  const certPath = join(workDir, 'cert.pem');
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-days',
      '1',
      '-subj',
      '/CN=startupbrandname.com',
      '-keyout',
      keyPath,
      '-out',
      certPath,
    ],
    { stdio: 'ignore' },
  );
  proxy = https.createServer(
    { key: await readFile(keyPath), cert: await readFile(certPath) },
    (request, response) => {
      const upstream = http.request(
        {
          host: '127.0.0.1',
          port: PORT,
          method: request.method,
          path: request.url,
          headers: { ...request.headers, 'x-forwarded-proto': 'https' },
        },
        (reply) => {
          response.writeHead(reply.statusCode ?? 502, reply.headers);
          reply.pipe(response);
        },
      );
      upstream.on('error', () => {
        response.writeHead(502).end();
      });
      request.pipe(upstream);
    },
  );
  await new Promise((resolve) => proxy.listen(TLS_PORT, '127.0.0.1', resolve));

  const profileDir = join(workDir, 'chrome-profile');
  await mkdir(profileDir);
  chrome = await chromeLauncher.launch({
    userDataDir: profileDir,
    chromeFlags: [
      '--headless=new',
      '--no-sandbox',
      // Accepts the throwaway certificate; the proxy is the only host Chrome can reach.
      '--ignore-certificate-errors',
      // Chromium's built-in field trials stop the host mapping from working (Playwright sets the
      // same switch).
      '--disable-field-trial-config',
      `--host-resolver-rules=MAP startupbrandname.com 127.0.0.1:${String(TLS_PORT)},MAP * ~NOTFOUND`,
      // Under WSL the launcher rewrites the profile path in Windows form, which Linux Chrome would
      // create as a folder inside the project. Chrome takes the last copy of a switch, so this
      // restores the real path (and changes nothing elsewhere).
      `--user-data-dir=${profileDir}`,
    ],
  });
  await mkdir(REPORT_DIR, { recursive: true });

  const rows = [];
  for (const locale of ['ar', 'en']) {
    for (const { id, path } of PUBLIC_PAGES) {
      const url = `https://startupbrandname.com/${locale}${path}`;
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
      const shift = lhr.audits['cumulative-layout-shift']?.numericValue;
      const bytes = Object.fromEntries(
        (lhr.audits['resource-summary']?.details?.items ?? []).map((item) => [
          item.resourceType,
          item.transferSize,
        ]),
      );
      rows.push({
        page: `/${locale}${path}`,
        ...scores,
        cls: shift,
        script: bytes.script,
        font: bytes.font,
      });

      const overBudget = [
        ...(typeof shift === 'number' && shift < MAX_LAYOUT_SHIFT
          ? []
          : [`layout shift ${String(shift)}, the limit is under ${String(MAX_LAYOUT_SHIFT)}`]),
        // A size Lighthouse did not report fails too, so an upgrade that renames the audit cannot
        // turn the budget off unnoticed.
        ...Object.entries(BYTE_BUDGETS).flatMap(([type, budget]) => {
          const size = bytes[type];
          if (typeof size !== 'number') return [`${type} bytes not measured (resource-summary)`];
          return size > budget ? [`${type} ${String(size)} B, over ${String(budget)} B`] : [];
        }),
      ];
      if (overBudget.length > 0) {
        failed = true;
        console.error(`✗ ${url} performance budget (D-171)\n  ${overBudget.join('\n  ')}`);
      }

      for (const [category, minimum] of Object.entries(REQUIRED)) {
        if ((scores[category] ?? 0) >= minimum) continue;
        failed = true;
        const audits = lhr.categories[category].auditRefs
          .filter((ref) => ref.weight > 0 && (lhr.audits[ref.id].score ?? 1) < 1)
          .map((ref) => {
            const audit = lhr.audits[ref.id];
            return `${ref.id}: ${audit.title}${audit.explanation ? ` (${audit.explanation})` : ''}`;
          });
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
  proxy?.close();
  server.kill();
  await rm(workDir, { recursive: true, force: true });
}

process.exitCode = failed ? 1 : 0;
