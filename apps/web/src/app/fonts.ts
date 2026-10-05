import { Cairo, Tajawal } from 'next/font/google';

// Self-hosted at build time with size-adjusted fallbacks, to keep the shift when the fonts swap in
// small; the end-to-end CLS test delays the font files to measure it (PERF-5).
export const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['600', '700', '800'],
  display: 'swap',
  variable: '--font-cairo',
});

// Regular and bold only: weight 500 put two preloaded files on every page, and only a sample in
// the internal design gallery used it (owner sign-off, PERF-6).
export const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-tajawal',
});
