import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { catalogues } from '@/i18n/messages';
import { CROSSBORDER_VERSION } from './legal';

/**
 * The wording of the cross-border consent, in both languages, for each version of it (D-147).
 * When this test fails, the wording changed: give it a new CROSSBORDER_VERSION, list that version
 * in a migration (consent.crossborder.accepted_versions), and add its hash here. Earlier consents
 * then count only if the earlier version stays listed, which needs the same processing.
 */
const WORDING_HASHES: Readonly<Record<string, string>> = {
  '2026-10-draft-2': 'b04efc2219ae47ae46e7a52d7ebc626f6763a1245ea4f0d86521db9f8524fd01',
};

function consentWording(): string {
  return JSON.stringify(
    (['ar', 'en'] as const).map((locale) => {
      const { aboutYou, account } = catalogues[locale];
      return [aboutYou.crossborder, aboutYou.crossborderHint, account.crossborderScope];
    }),
  );
}

/** The accepted versions the migrations set last, in the order the database applies them. */
function acceptedVersions(): unknown {
  const directory = fileURLToPath(new URL('../../../../supabase/migrations/', import.meta.url));
  const settings = readdirSync(directory)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .flatMap((name) => [
      ...readFileSync(`${directory}${name}`, 'utf8').matchAll(
        /'consent\.crossborder\.accepted_versions',\s*'(\[[^']*\])'|set value = '(\[[^']*\])'\s+where key = 'consent\.crossborder\.accepted_versions'/g,
      ),
    ]);
  const last = settings.at(-1);
  return last ? JSON.parse(last[1] ?? last[2] ?? 'null') : null;
}

describe('the cross-border consent text', () => {
  it('has the wording its version was given for', () => {
    const hash = createHash('sha256').update(consentWording()).digest('hex');
    expect(hash).toBe(WORDING_HASHES[CROSSBORDER_VERSION]);
  });

  it('is a version the database accepts consents for', () => {
    expect(acceptedVersions()).toContain(CROSSBORDER_VERSION);
  });
});
