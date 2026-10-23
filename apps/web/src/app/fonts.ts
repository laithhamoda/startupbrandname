import localFont from 'next/font/local';

// Cairo (headings) and Tajawal (text), both SIL OFL 1.1, are files in this repository, so a build
// downloads nothing (D-254). They are the files `next/font/google` served until then, one per
// script: a page preloads six of them, 102,924 B (D-170 counted 102,528 B of an earlier revision).
// Their source, checksums and how to replace them: styles/fonts/README.md.
//
// `next/font/local` sets one `unicode-range` for a whole call and accepts literal values only, so
// each script is its own call, as it was its own block of Google's stylesheet, and the ranges are
// Google's, written out each time. globals.css joins the pieces into `--font-cairo` and
// `--font-tajawal`. Only the Latin calls make the size-adjusted fallback that keeps the shift small
// when the fonts swap in: its metrics are read from a file that has the letters a to z. The
// end-to-end layout-shift test delays the font files to measure the swap (PERF-5).

// One file serves Cairo 600, 700 and 800: it is a variable font, which is why Cairo costs fewer
// bytes than three static weights would.
const cairoArabic = localFont({
  src: [{ path: '../styles/fonts/cairo-arabic.woff2', weight: '600 800' }],
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0600-06FF,U+0750-077F,U+0870-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC,U+102E0-102FB,U+10E60-10E7E,U+10EC2-10EC7,U+10EC9-10EEE,U+10EF0-10EFF,U+1EE00-1EE03,U+1EE05-1EE1F,U+1EE21-1EE22,U+1EE24,U+1EE27,U+1EE29-1EE32,U+1EE34-1EE37,U+1EE39,U+1EE3B,U+1EE42,U+1EE47,U+1EE49,U+1EE4B,U+1EE4D-1EE4F,U+1EE51-1EE52,U+1EE54,U+1EE57,U+1EE59,U+1EE5B,U+1EE5D,U+1EE5F,U+1EE61-1EE62,U+1EE64,U+1EE67-1EE6A,U+1EE6C-1EE72,U+1EE74-1EE77,U+1EE79-1EE7C,U+1EE7E,U+1EE80-1EE89,U+1EE8B-1EE9B,U+1EEA1-1EEA3,U+1EEA5-1EEA9,U+1EEAB-1EEBB,U+1EEF0-1EEF1',
    },
  ],
  display: 'swap',
  adjustFontFallback: false,
  variable: '--font-cairo-arabic',
});

// Rare Latin letters (Turkish, Polish, Vietnamese and the like) in a heading. Not preloaded: the
// browser fetches it only when a page has one of them.
const cairoLatinExt = localFont({
  src: [{ path: '../styles/fonts/cairo-latin-ext.woff2', weight: '600 800' }],
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF',
    },
  ],
  display: 'swap',
  adjustFontFallback: false,
  preload: false,
  variable: '--font-cairo-latin-ext',
});

const cairoLatin = localFont({
  src: [{ path: '../styles/fonts/cairo-latin.woff2', weight: '600 800' }],
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
    },
  ],
  display: 'swap',
  variable: '--font-cairo-latin',
});

// Regular and bold only: weight 500 put two preloaded files on every page, and only a sample in
// the internal design gallery used it (owner sign-off, PERF-6).
const tajawalArabic = localFont({
  src: [
    { path: '../styles/fonts/tajawal-arabic-400.woff2', weight: '400' },
    { path: '../styles/fonts/tajawal-arabic-700.woff2', weight: '700' },
  ],
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0600-06FF,U+0750-077F,U+0870-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC,U+102E0-102FB,U+10E60-10E7E,U+10EC2-10EC7,U+10EC9-10EEE,U+10EF0-10EFF,U+1EE00-1EE03,U+1EE05-1EE1F,U+1EE21-1EE22,U+1EE24,U+1EE27,U+1EE29-1EE32,U+1EE34-1EE37,U+1EE39,U+1EE3B,U+1EE42,U+1EE47,U+1EE49,U+1EE4B,U+1EE4D-1EE4F,U+1EE51-1EE52,U+1EE54,U+1EE57,U+1EE59,U+1EE5B,U+1EE5D,U+1EE5F,U+1EE61-1EE62,U+1EE64,U+1EE67-1EE6A,U+1EE6C-1EE72,U+1EE74-1EE77,U+1EE79-1EE7C,U+1EE7E,U+1EE80-1EE89,U+1EE8B-1EE9B,U+1EEA1-1EEA3,U+1EEA5-1EEA9,U+1EEAB-1EEBB,U+1EEF0-1EEF1',
    },
  ],
  display: 'swap',
  adjustFontFallback: false,
  variable: '--font-tajawal-arabic',
});

const tajawalLatin = localFont({
  src: [
    { path: '../styles/fonts/tajawal-latin-400.woff2', weight: '400' },
    { path: '../styles/fonts/tajawal-latin-700.woff2', weight: '700' },
  ],
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
    },
  ],
  display: 'swap',
  variable: '--font-tajawal-latin',
});

/** The classes that define the font variables; the <html> element of every document carries them. */
export const FONT_VARIABLES = [cairoArabic, cairoLatinExt, cairoLatin, tajawalArabic, tajawalLatin]
  .map((font) => font.variable)
  .join(' ');
