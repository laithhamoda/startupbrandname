import { z } from 'zod';

/** The four statuses of `country_pack_items.status` (D-243). */
export const PACK_STATUSES = ['verified', 'unverified', 'under_review', 'stale'] as const;
export type PackStatus = (typeof PACK_STATUSES)[number];

/** An official link: https with a host, nothing else is shown to a founder (CLAUDE.md rule 9). */
const httpsUrl = z
  .string()
  .max(2048)
  .refine((text) => {
    try {
      const url = new URL(text);
      return url.protocol === 'https:' && url.hostname.length > 0 && url.username === '';
    } catch {
      return false;
    }
  }, 'not_https_url');

const text = z.string().min(1).max(2000);

/** The same words in both interface languages. */
export const textPairSchema = z.object({ ar: text, en: text }).strict();
export type TextPair = z.infer<typeof textPairSchema>;

/**
 * One sentence of an official page, in the page's own words and language, with the page it was
 * read on. `cite` names a gazette issue and article when the page is a gazette PDF.
 */
export const evidenceSchema = z
  .object({
    text,
    lang: z.enum(['ar', 'fr', 'en']),
    url: httpsUrl,
    cite: text.optional(),
  })
  .strict();
export type Evidence = z.infer<typeof evidenceSchema>;

/** A number or date of the pack, shown as the page writes it, always with its own evidence. */
export const figureSchema = z
  .object({
    id: z.string().min(1).max(80),
    text: z.string().min(1).max(200),
    evidence: z.array(evidenceSchema).min(1).max(8),
  })
  .strict();
export type Figure = z.infer<typeof figureSchema>;

/** The `value` column of `country_pack_items` (D-264). */
export const packValueSchema = z
  .object({
    name: textPairSchema,
    description: textPairSchema,
    note: textPairSchema.optional(),
    url: httpsUrl.optional(),
    code: z
      .string()
      .length(3)
      .refine((code) => code === code.toUpperCase(), 'not_upper_case')
      .optional(),
    evidence: z.array(evidenceSchema).max(8).optional(),
    figures: z.array(figureSchema).max(20).optional(),
  })
  .strict();
export type PackValue = z.infer<typeof packValueSchema>;

/** `YYYY-MM-DD` and a real calendar day. Walks the text: no pattern to backtrack. */
export function isIsoDate(input: string): boolean {
  if (input.length !== 10 || input[4] !== '-' || input[7] !== '-') return false;
  const digits = input.slice(0, 4) + input.slice(5, 7) + input.slice(8);
  for (const char of digits) if (char < '0' || char > '9') return false;
  const year = Number(input.slice(0, 4));
  const month = Number(input.slice(5, 7));
  const day = Number(input.slice(8));
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

const isoDate = z.string().refine(isIsoDate, 'not_iso_date');

/** A row of `country_pack_items` as the app reads it, with the value validated. */
export const packItemSchema = z
  .object({
    countryCode: z.string().length(2),
    key: z.string().min(1).max(120),
    value: packValueSchema,
    sourceUrl: httpsUrl,
    lastVerified: isoDate.nullable(),
    status: z.enum(PACK_STATUSES),
  })
  .strict();
export type PackItem = z.infer<typeof packItemSchema>;
