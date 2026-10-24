import { describe, expect, it } from 'vitest';

import { REQUIRED, missingFiles } from './check-pdf-trace.mjs';

const PNPM = '../../../../../../../../node_modules/.pnpm';
const CHROMIUM = `${PNPM}/@sparticuz+chromium@153.0.0/node_modules/@sparticuz/chromium/bin`;
const FONTS = `${PNPM}/@fontsource+cairo@5.3.0/node_modules/@fontsource/cairo/files`;

const browser = ['chromium.br', 'al2023.tar.br', 'fonts.tar.br', 'swiftshader.tar.br'].map(
  (name) => `${CHROMIUM}/${name}`,
);
const fonts = Array.from(
  { length: 10 },
  (_, index) => `${FONTS}/cairo-arabic-${String(index)}-normal.woff2`,
);
const complete = [
  ...browser,
  ...fonts,
  `${PNPM}/puppeteer-core@25.11.0/node_modules/puppeteer-core/lib/x.js`,
];

describe('missingFiles', () => {
  it('finds nothing missing in a trace that has the browser and the print fonts', () => {
    expect(missingFiles(complete)).toEqual([]);
  });

  it('says so when the trace has neither, as when the include key matched nothing', () => {
    const problems = missingFiles(['../../node_modules/puppeteer-core/lib/x.js']);

    expect(problems).toHaveLength(REQUIRED.length);
    expect(problems[0]).toContain("the browser's archive: 0 of 1");
  });

  it('names the one file that is missing', () => {
    const problems = missingFiles(complete.filter((file) => !file.endsWith('chromium.br')));

    expect(problems).toEqual(["the browser's archive: 0 of 1 files in the function's trace."]);
  });

  it('needs all ten print fonts', () => {
    const problems = missingFiles(complete.slice(0, -2));

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('the print fonts');
    expect(problems[0]).toContain('9 of 10');
  });
});
