// Fails when the PDF function would ship without the browser or the print fonts (D-298). Run after
// `pnpm build`. The report route's function starts a headless Chromium from the compressed files in
// the package's `bin` folder and reads the print fonts by path, so the tracer cannot find them: the
// `outputFileTracingIncludes` entry of apps/web/next.config.ts adds them. That entry is matched
// against the route's name, and brackets are glob syntax there: the key '/api/projects/[id]/...'
// matched nothing, the function went out without its browser, and every PDF failed on Vercel with
// "the input directory ... does not exist" while every test and every check stayed green.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const TRACE = fileURLToPath(
  new URL(
    '../apps/web/.next/server/app/api/projects/[id]/report/pdf/route.js.nft.json',
    import.meta.url,
  ),
);

/** What the function must carry: a pattern on the trace's paths and how many files match it. */
export const REQUIRED = [
  { name: "the browser's archive", pattern: /@sparticuz\/chromium\/bin\/chromium\.br$/, count: 1 },
  {
    name: "the browser's Amazon Linux libraries",
    pattern: /@sparticuz\/chromium\/bin\/al2023\.tar\.br$/,
    count: 1,
  },
  { name: "the browser's fonts", pattern: /@sparticuz\/chromium\/bin\/fonts\.tar\.br$/, count: 1 },
  {
    name: "the browser's software renderer",
    pattern: /@sparticuz\/chromium\/bin\/swiftshader\.tar\.br$/,
    count: 1,
  },
  {
    name: 'the print fonts (Cairo and Tajawal, Arabic and Latin)',
    pattern: /@fontsource\/(cairo|tajawal)\/files\/[^/]+\.woff2$/,
    count: 10,
  },
];

/** The problems with `files` (the paths of a trace); empty when the function has all it needs. */
export function missingFiles(files) {
  const problems = [];
  for (const { name, pattern, count } of REQUIRED) {
    const found = files.filter((file) => pattern.test(file)).length;
    if (found < count) {
      problems.push(`${name}: ${String(found)} of ${String(count)} files in the function's trace.`);
    }
  }
  return problems;
}

async function main() {
  let trace;
  try {
    trace = JSON.parse(await readFile(TRACE, 'utf8'));
  } catch {
    console.error(`No trace at ${TRACE}. Run \`pnpm build\` first.`);
    process.exit(1);
  }
  const problems = missingFiles(trace.files ?? []);
  if (problems.length > 0) {
    console.error('The PDF function would ship without what it needs (D-298):');
    for (const problem of problems) console.error(`  ${problem}`);
    console.error(
      "Check the key of outputFileTracingIncludes in apps/web/next.config.ts: it is matched against the route's name, and a bracket in it is glob syntax.",
    );
    process.exit(1);
  }
  console.log('The PDF function carries the browser and the print fonts.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
