import type { Locale } from '@/i18n/routing';

/**
 * The founder, as the owner gave it on 2026-10-25 (D-308). Only what he stated is here: the name
 * in both languages, the role, the city, his LinkedIn profile and his own photograph. Nothing
 * about him is added from anywhere else.
 */
export const FOUNDER = {
  name: { ar: 'ليث حموده', en: 'Laith Hamoda' } satisfies Record<Locale, string>,
  jobTitle: { ar: 'مؤسس المنصة', en: 'Founder' } satisfies Record<Locale, string>,
  /** City and ISO 3166 country code, for structured data. */
  city: 'Amman',
  country: 'JO',
  linkedin: 'https://www.linkedin.com/in/laithhamoda',
  /** 4:5, 640 by 800, a WebP made from the owner's photograph. */
  photo: { path: '/team/laith-hamoda.webp', width: 640, height: 800 },
} as const;
