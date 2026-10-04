import { describe, expect, it } from 'vitest';

import { checkPlaywrightImages, findPlaywrightImages } from './check-playwright-version.mjs';

const PINNED =
  'image: mcr.microsoft.com/playwright:v1.63.0-resolute@sha256:b022639ae9197f864040f92eef7b57c6d4b47db2190f77c909d8a5d902dd4b7e';

describe('findPlaywrightImages', () => {
  it('reads the version of a tagged image pinned by digest, with its line', () => {
    expect(findPlaywrightImages(`jobs:\n  e2e:\n    container:\n      ${PINNED}\n`)).toEqual([
      { version: '1.63.0', line: 4 },
    ]);
  });

  it('reads an image without a distribution suffix or digest', () => {
    expect(findPlaywrightImages('image: mcr.microsoft.com/playwright:v1.64.1')).toEqual([
      { version: '1.64.1', line: 1 },
    ]);
  });

  it('ignores other images', () => {
    expect(findPlaywrightImages('image: mcr.microsoft.com/playwright/python:v1.63.0')).toEqual([]);
  });
});

describe('checkPlaywrightImages', () => {
  it('passes when every image matches the package', () => {
    expect(checkPlaywrightImages('1.63.0', { 'ci.yml': PINNED, 'snapshots.yml': PINNED })).toEqual(
      [],
    );
  });

  it('names each image that differs', () => {
    const problems = checkPlaywrightImages('1.64.0', { 'ci.yml': `on: push\n${PINNED}` });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^ci\.yml:2 {2}image v1\.63\.0, but @playwright\/test is 1\.64\.0/);
  });

  it('fails when the package is not pinned exactly', () => {
    expect(checkPlaywrightImages('^1.63.0', { 'ci.yml': PINNED })).toEqual([
      expect.stringContaining('pinned to an exact version'),
    ]);
    expect(checkPlaywrightImages(undefined, { 'ci.yml': PINNED })).toHaveLength(1);
  });

  it('fails when no workflow names an image, so a moved image cannot pass unchecked', () => {
    expect(checkPlaywrightImages('1.63.0', { 'ci.yml': 'on: push' })).toEqual([
      'No Playwright image found in .github/workflows.',
    ]);
  });
});
