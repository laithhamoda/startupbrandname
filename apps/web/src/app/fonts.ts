import { Cairo, Tajawal } from 'next/font/google';

// Self-hosted at build time with size-adjusted fallbacks, so font loading causes no layout shift.
export const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['600', '700', '800'],
  display: 'swap',
  variable: '--font-cairo',
});

export const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-tajawal',
});
