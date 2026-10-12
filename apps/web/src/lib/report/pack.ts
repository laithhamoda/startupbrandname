import 'server-only';
import { type PackItem, packItemSchema } from '@sbn/report/legal-path';
import { errorFields, log } from '@/lib/log';
import type { Database } from '@/lib/supabase/database.types';
import type { SupabaseServerClient } from '@/lib/supabase/server';

type PackRow = Database['public']['Tables']['country_pack_items']['Row'];

/**
 * The pack items of a country that fit the legal-path schema, and how many rows did not. A row that
 * fails is left out rather than shown half-read (rule 9); the caller logs the count.
 */
export function packItemsOfRows(rows: readonly PackRow[]): { items: PackItem[]; skipped: number } {
  const items: PackItem[] = [];
  let skipped = 0;
  for (const row of rows) {
    const parsed = packItemSchema.safeParse({
      countryCode: row.country_code,
      key: row.key,
      value: row.value,
      sourceUrl: row.source_url,
      lastVerified: row.last_verified,
      status: row.status,
    });
    if (parsed.success) items.push(parsed.data);
    else skipped += 1;
  }
  return { items, skipped };
}

/**
 * Reads the country's pack items for the report (D-273). Signed-in users may read the table. A
 * failed read leaves the legal path empty and is logged; it never stops the report, which then
 * says the pack holds nothing yet.
 */
export async function loadPackItems(
  supabase: SupabaseServerClient,
  countryCode: string,
  projectId: string,
): Promise<PackItem[]> {
  const result = await supabase
    .from('country_pack_items')
    .select('*')
    .eq('country_code', countryCode);
  if (result.error) {
    await log.warn('report.pack_unavailable', { ...errorFields(result.error), projectId });
    return [];
  }
  const { items, skipped } = packItemsOfRows(result.data);
  if (skipped > 0) await log.warn('report.pack_unreadable', { projectId, count: skipped });
  return items;
}
