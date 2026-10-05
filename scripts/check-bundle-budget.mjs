// Fails when a route sends more JavaScript to the browser than its budget (PERF-5, D-054's
// performance budget). Run after `pnpm build`. For each route it reads the build manifests (the
// chunks every page loads, then the chunks of the route's layouts, page and boundaries), gzips each
// chunk and adds them up. Chunks loaded later by a dynamic import are not counted.
//
// The budgets are the measured sizes plus about 10% (D-171). Raise one only with a reason in
// docs/DECISIONS.md; lower it whenever a change makes the route smaller.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { gzipSync } from 'node:zlib';

const NEXT_DIR = fileURLToPath(new URL('../apps/web/.next/', import.meta.url));

/**
 * Gzipped JavaScript per route, in bytes, keyed by the route as `next build` prints it. Measured
 * on 2026-10-05: 175,028 (home), 192,178 (signup), 190,298 (onboarding), 316,149 (a step).
 */
export const BUDGETS = {
  '/[locale]': { entry: '[locale]/(site)/page', gzipBytes: 192_500 },
  '/[locale]/signup': { entry: '[locale]/(site)/signup/page', gzipBytes: 211_400 },
  '/[locale]/onboarding': { entry: '[locale]/(site)/onboarding/page', gzipBytes: 209_300 },
  '/[locale]/projects/[id]/q/[step]': {
    entry: '[locale]/(app)/projects/[id]/q/[step]/page',
    gzipBytes: 347_800,
  },
};

/**
 * The JavaScript files a route's first load fetches: the chunks of every page (`rootMainFiles`),
 * then those of each layout, page, error and not-found boundary in its client reference manifest.
 * Sorted and without duplicates.
 */
export function routeChunks(rootMainFiles, manifest) {
  const files = new Set(rootMainFiles);
  for (const chunks of Object.values(manifest.entryJSFiles ?? {})) {
    for (const chunk of chunks) files.add(chunk);
  }
  return [...files].filter((file) => file.endsWith('.js')).sort();
}

/** The size of `content` once gzipped, as a CDN would send it. */
export function gzipBytes(content) {
  return gzipSync(content, { level: 9 }).length;
}

/** Reads a client reference manifest, a script that assigns itself to globalThis.__RSC_MANIFEST. */
export function parseClientManifest(source, entry) {
  const context = {};
  runInNewContext(source, context);
  const manifest = context.__RSC_MANIFEST?.[`/${entry}`];
  if (!manifest) throw new Error(`No client reference manifest for /${entry}.`);
  return manifest;
}

/** The problems with `measured` (route → gzip bytes) against `budgets`; empty when all fit. */
export function checkBudgets(measured, budgets) {
  const problems = [];
  for (const [route, { gzipBytes: budget }] of Object.entries(budgets)) {
    const size = measured[route];
    if (size === undefined) problems.push(`${route}: not measured.`);
    else if (size > budget) {
      problems.push(
        `${route}: ${String(size)} B of JavaScript (gzip), over its budget of ${String(budget)} B.`,
      );
    }
  }
  return problems;
}

async function main() {
  let buildManifest;
  try {
    buildManifest = JSON.parse(await readFile(join(NEXT_DIR, 'build-manifest.json'), 'utf8'));
  } catch {
    console.error(`No build output under ${NEXT_DIR}. Run \`pnpm build\` first.`);
    process.exit(1);
  }

  const measured = {};
  const rows = [];
  for (const [route, { entry, gzipBytes: budget }] of Object.entries(BUDGETS)) {
    const source = await readFile(
      join(NEXT_DIR, 'server', 'app', `${entry}_client-reference-manifest.js`),
      'utf8',
    );
    const chunks = routeChunks(buildManifest.rootMainFiles, parseClientManifest(source, entry));
    let total = 0;
    for (const chunk of chunks) total += gzipBytes(await readFile(join(NEXT_DIR, chunk)));
    measured[route] = total;
    rows.push({ route, chunks: chunks.length, gzipBytes: total, budget });
  }
  console.table(rows);

  const problems = checkBudgets(measured, BUDGETS);
  if (problems.length > 0) {
    console.error('JavaScript over budget (scripts/check-bundle-budget.mjs, D-171):');
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
  console.log('Every route is within its JavaScript budget.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
