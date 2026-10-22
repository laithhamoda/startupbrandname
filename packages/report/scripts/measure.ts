// Measures the PDF of the three golden reports in both languages (M5 step 6, D-282). Not a test:
// it is run on demand, with Vitest only as the runner of TypeScript.
//
//   pnpm --filter @sbn/report run pdf:measure
//   MEASURE_OUT=/tmp/pdfs pnpm --filter @sbn/report run pdf:measure   (also keeps the PDF files)
//
// For each report it prints the page count, the size of the file, the wall time of a cold render
// (a new browser: its start included) and of a warm one (the same browser again), and the peak
// resident memory of the browser and the processes below it, read from /proc after the renders
// (Linux only). The Chromium is the one of PDF_CHROMIUM_PATH, else Playwright's.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { it } from 'vitest';
import { launchBrowser, renderReportPdf } from '../src';
import { LOCALES, modelOf, NAMES } from '../src/testing/model-helpers';
import { inspectPdf } from '../src/testing/pdf-inspect';

/** The ids of the processes below `root`, `root` included. */
function tree(root: number): number[] {
  const parents = new Map<number, number>();
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      const stat = readFileSync(`/proc/${entry}/stat`, 'utf8');
      // The command name is in parentheses and may hold spaces: the fields start after the last one.
      const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
      parents.set(Number(entry), Number(fields[1]));
    } catch {
      // The process ended while we looked.
    }
  }
  const found = [root];
  // The list grows while it is walked: the children of a process are looked up when it is reached.
  for (const current of found) {
    for (const [pid, parent] of parents) {
      if (parent === current && !found.includes(pid)) found.push(pid);
    }
  }
  return found;
}

/** The sum of the peak resident sizes (VmHWM) of the tree, in megabytes. */
function peakMb(root: number): number {
  let kilobytes = 0;
  for (const pid of tree(root)) {
    try {
      const status = readFileSync(`/proc/${String(pid)}/status`, 'utf8');
      const line = status.split('\n').find((entry) => entry.startsWith('VmHWM:'));
      kilobytes += Number(line?.replace(/\D/g, '') ?? 0);
    } catch {
      // The process ended while we looked.
    }
  }
  return Math.round(kilobytes / 1024);
}

it('measures the golden reports', async () => {
  const out = process.env.MEASURE_OUT;
  if (out) mkdirSync(out, { recursive: true });
  const rows: string[] = [];
  for (const name of NAMES) {
    for (const locale of LOCALES) {
      const model = modelOf(name, locale);
      const started = performance.now();
      const browser = await launchBrowser();
      try {
        const cold = await renderReportPdf({ model, browser });
        const coldMs = Math.round(performance.now() - started);
        const warm = await renderReportPdf({ model, browser });
        const pid = browser.process()?.pid;
        const peak = pid === undefined ? 'n/a' : String(peakMb(pid));
        const inspected = await inspectPdf(cold.pdf, {
          direction: locale === 'ar' ? 'rtl' : 'ltr',
        });
        if (out) writeFileSync(join(out, `${name}.${locale}.pdf`), cold.pdf);
        rows.push(
          [
            `${name}.${locale}`.padEnd(34),
            `pages ${String(inspected.pages.length).padStart(2)}`,
            `size ${String(Math.round(cold.pdf.byteLength / 1024)).padStart(5)} KB`,
            `cold ${String(coldMs).padStart(5)} ms`,
            `warm ${String(warm.ms).padStart(5)} ms`,
            `peak browser ${peak} MB`,
          ].join('  '),
        );
      } finally {
        await browser.close();
      }
    }
  }
  process.stdout.write(`\n${rows.join('\n')}\n`);
}, 600_000);
