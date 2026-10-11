import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  FontFileError,
  PRINT_FONT_FACES,
  UNICODE_RANGES,
  fontFaceRule,
  fontFileName,
  fontFilePath,
  loadFontFaceCss,
  packageDirectory,
} from './fonts';

const directories: string[] = [];
function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'sbn-fonts-'));
  directories.push(directory);
  return directory;
}
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

const refuse = (): never => {
  throw new Error('not resolvable');
};

describe('the print font set', () => {
  it('is Cairo 600 and 700 for headings and Tajawal 400, 500 and 700 for text, in both scripts', () => {
    const names = PRINT_FONT_FACES.map(fontFileName).sort();
    expect(names).toEqual(
      [
        'cairo-arabic-600-normal.woff2',
        'cairo-arabic-700-normal.woff2',
        'cairo-latin-600-normal.woff2',
        'cairo-latin-700-normal.woff2',
        'tajawal-arabic-400-normal.woff2',
        'tajawal-arabic-500-normal.woff2',
        'tajawal-arabic-700-normal.woff2',
        'tajawal-latin-400-normal.woff2',
        'tajawal-latin-500-normal.woff2',
        'tajawal-latin-700-normal.woff2',
      ].sort(),
    );
  });

  it('gives Arabic and Latin disjoint ranges for digits and Arabic letters', () => {
    expect(UNICODE_RANGES.latin).toContain('U+0000-00FF');
    expect(UNICODE_RANGES.arabic).toContain('U+0600-06FF');
    expect(UNICODE_RANGES.arabic).toContain('U+FE70-FE74');
  });
});

describe('fontFaceRule', () => {
  it('inlines the file as a data: URL with its weight and unicode-range', () => {
    const rule = fontFaceRule(
      { family: 'Cairo', weight: 700, subset: 'arabic' },
      new Uint8Array([0x77, 0x4f, 0x46, 0x32]),
    );
    expect(rule).toContain("font-family:'Cairo'");
    expect(rule).toContain('font-weight:700');
    expect(rule).toContain('src:url(data:font/woff2;base64,d09GMg==)');
    expect(rule).toContain(`unicode-range:${UNICODE_RANGES.arabic}`);
    expect(rule).not.toMatch(/url\((?!data:)/);
  });
});

describe('loadFontFaceCss', () => {
  it('reads every woff2 file of the set from the @fontsource packages', async () => {
    const css = await loadFontFaceCss();
    expect(css.match(/@font-face/g)).toHaveLength(PRINT_FONT_FACES.length);
    // "wOF2" in base64: each file is a real woff2.
    expect(css.match(/base64,d09GMg/g)).toHaveLength(PRINT_FONT_FACES.length);
    for (const family of ['Cairo', 'Tajawal']) expect(css).toContain(`font-family:'${family}'`);
  });

  it('refers to no address except data: URLs', async () => {
    expect(await loadFontFaceCss()).not.toMatch(/url\((?!data:)/);
  });

  it('returns the same text from the cache the second time', async () => {
    const faces = PRINT_FONT_FACES.slice(0, 2);
    const first = loadFontFaceCss(faces);
    expect(loadFontFaceCss(faces)).toBe(first);
    expect(await first).toBe(await loadFontFaceCss(faces));
  });

  it('throws a typed error that names the file when a font is missing, and does not cache it', async () => {
    // A start directory with an @fontsource folder that holds no files.
    const root = temporaryDirectory();
    mkdirSync(join(root, 'node_modules', '@fontsource', 'cairo', 'files'), { recursive: true });
    const face = { family: 'Cairo', weight: 600, subset: 'latin' } as const;
    // The normal resolve finds the real package first, so this proves the error path only
    // through a face that does not exist.
    const missing = { family: 'Cairo', weight: 123, subset: 'latin' } as const;
    await expect(loadFontFaceCss([missing], root)).rejects.toBeInstanceOf(FontFileError);
    await expect(loadFontFaceCss([missing], root)).rejects.toMatchObject({
      code: 'font_file_missing',
      file: 'cairo-latin-123-normal.woff2',
    });
    await expect(loadFontFaceCss([face], root)).resolves.toContain('@font-face');
  });
});

describe('packageDirectory', () => {
  it('uses the normal resolve when it works', () => {
    expect(
      packageDirectory('cairo', '/nowhere', () => '/somewhere/@fontsource/cairo/package.json'),
    ).toBe('/somewhere/@fontsource/cairo');
  });

  it('walks up from the start directory when the bundle cannot resolve', () => {
    const root = temporaryDirectory();
    const package_ = join(root, 'node_modules', '@fontsource', 'tajawal');
    mkdirSync(package_, { recursive: true });
    const deep = join(root, 'apps', 'web');
    mkdirSync(deep, { recursive: true });
    expect(packageDirectory('tajawal', deep, refuse)).toBe(package_);
  });

  it('throws when no directory above holds the package', () => {
    const root = temporaryDirectory();
    writeFileSync(join(root, 'file'), '');
    expect(() => packageDirectory('no-such-font-package', root, refuse)).toThrow(FontFileError);
  });

  it('builds the path of a font file from the package directory', () => {
    expect(fontFilePath({ family: 'Tajawal', weight: 400, subset: 'arabic' })).toMatch(
      /@fontsource[\\/]tajawal[\\/]files[\\/]tajawal-arabic-400-normal\.woff2$/,
    );
  });
});
