import { isIsoDate, type PackItem } from './schema';

/** CLAUDE.md rule 8: an item verified longer ago than this is shown with the prompt. */
export const PACK_STALE_AFTER_DAYS = 90;

/**
 * The code of the prompt «تحقّق من المصدر الرسمي». The report turns it into words (step 5); this
 * module never writes text for the founder.
 */
export type PackLabel = 'verify_official_source';

const DAY_MS = 86_400_000;

function dayNumber(isoDate: string): number {
  return Math.floor(Date.parse(`${isoDate}T00:00:00Z`) / DAY_MS);
}

/**
 * The label an item must carry (rule 8): any status but `verified`, a missing or malformed
 * `last_verified`, or a date more than 90 days before `today` (`YYYY-MM-DD`). Exactly 90 days is
 * still fresh. A `today` that is not a date is a bug in the caller and throws.
 */
export function packLabel(
  item: Pick<PackItem, 'status' | 'lastVerified'>,
  today: string,
): PackLabel | null {
  if (!isIsoDate(today)) throw new Error(`today is not a YYYY-MM-DD date: ${today}`);
  if (item.status !== 'verified') return 'verify_official_source';
  if (item.lastVerified === null || !isIsoDate(item.lastVerified)) return 'verify_official_source';
  const age = dayNumber(today) - dayNumber(item.lastVerified);
  return age > PACK_STALE_AFTER_DAYS ? 'verify_official_source' : null;
}
