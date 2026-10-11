import { statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { cwd } from 'node:process';

/**
 * The print fonts (CLAUDE.md §5): Cairo for headings, Tajawal for text, both SIL OFL 1.1. The
 * woff2 files come from the @fontsource packages and are inlined as data: URLs, so a document needs
 * no network and no font installed on the machine that renders it (D-235, D-239). Each face is
 * split in an Arabic and a Latin subset; the unicode-range of each decides which one a character
 * uses, so digits and Latin letters always come from the Latin subset.
 */

export type FontFamily = 'Cairo' | 'Tajawal';
export type FontSubset = 'arabic' | 'latin';

export interface FontFace {
  family: FontFamily;
  weight: number;
  subset: FontSubset;
}

const PACKAGES: Readonly<Record<FontFamily, string>> = { Cairo: 'cairo', Tajawal: 'tajawal' };

/** What the document uses: headings in Cairo 600 and 700, text in Tajawal 400, 500 and 700. */
export const PRINT_FONT_FACES: readonly FontFace[] = (
  [
    ['Cairo', [600, 700]],
    ['Tajawal', [400, 500, 700]],
  ] as const
).flatMap(([family, weights]) =>
  weights.flatMap((weight) =>
    (['arabic', 'latin'] as const).map((subset): FontFace => ({ family, weight, subset })),
  ),
);

/** The unicode-range of each subset: the part of @fontsource's own ranges below U+FFFF. */
export const UNICODE_RANGES: Readonly<Record<FontSubset, string>> = {
  arabic:
    'U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,' +
    'U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC',
  latin:
    'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,' +
    'U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
};

export class FontFileError extends Error {
  readonly code = 'font_file_missing';
  constructor(readonly file: string) {
    super(`Print font file not found: ${file}`);
    this.name = 'FontFileError';
  }
}

export function fontFileName({ family, weight, subset }: FontFace): string {
  return `${PACKAGES[family]}-${subset}-${String(weight)}-normal.woff2`;
}

/**
 * The directory of an @fontsource package. A normal resolve finds it in Node and in tests; a
 * bundled server (Next.js) cannot resolve from inside the bundle, so the search then walks up from
 * the working directory, where the traced node_modules sit (outputFileTracingIncludes).
 */
export function packageDirectory(
  name: string,
  startDirectory: string,
  resolveFromHere: (id: string) => string = (id) => createRequire(import.meta.url).resolve(id),
): string {
  try {
    return dirname(resolveFromHere(`@fontsource/${name}/package.json`));
  } catch {
    // Not resolvable from here: search the directories above the working directory.
  }
  let directory = resolve(startDirectory);
  for (;;) {
    const candidate = join(directory, 'node_modules', '@fontsource', name);
    if (isDirectory(candidate)) return candidate;
    const parent = dirname(directory);
    if (parent === directory) throw new FontFileError(`@fontsource/${name}`);
    directory = parent;
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export function fontFilePath(face: FontFace, startDirectory = cwd()): string {
  return join(packageDirectory(PACKAGES[face.family], startDirectory), 'files', fontFileName(face));
}

/** One @font-face rule with the font inlined as a data: URL. */
export function fontFaceRule(face: FontFace, woff2: Uint8Array): string {
  const data = Buffer.from(woff2).toString('base64');
  return (
    `@font-face{font-family:'${face.family}';font-style:normal;font-weight:${String(face.weight)};` +
    `font-display:block;src:url(data:font/woff2;base64,${data}) format('woff2');` +
    `unicode-range:${UNICODE_RANGES[face.subset]}}`
  );
}

async function readFace(face: FontFace, startDirectory: string): Promise<Uint8Array> {
  // A missing package throws its own FontFileError here; a missing file is reported below.
  const path = fontFilePath(face, startDirectory);
  try {
    return await readFile(path);
  } catch {
    throw new FontFileError(fontFileName(face));
  }
}

const cache = new Map<string, Promise<string>>();

/**
 * The @font-face rules for the given faces (the whole print set by default). Cached for the life
 * of the process: the files do not change.
 */
export function loadFontFaceCss(
  faces: readonly FontFace[] = PRINT_FONT_FACES,
  startDirectory = cwd(),
): Promise<string> {
  const key = `${startDirectory}|${faces.map(fontFileName).join(',')}`;
  let css = cache.get(key);
  if (!css) {
    css = Promise.all(
      faces.map(async (face) => fontFaceRule(face, await readFace(face, startDirectory))),
    ).then((rules) => rules.join('\n'));
    // A failed read is not kept: the next call tries again.
    void css.catch(() => cache.delete(key));
    cache.set(key, css);
  }
  return css;
}
