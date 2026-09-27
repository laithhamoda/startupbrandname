import 'server-only';
import { type PlanId, PLANS } from '@/config/plans';
import { PUBLIC_PAGES } from '@/config/public-pages';
import { site } from '@/config/site';
import { PAGE_META } from '@/content/pages';
import type { Locale } from '@/i18n/routing';
import { pageUrl } from './json-ld';

function pageList(locale: Locale): string {
  return PUBLIC_PAGES.map(({ id, path }) => {
    const meta = PAGE_META[locale][id];
    const name = id === 'home' ? site.name : meta.title;
    return `- [${name}](${pageUrl(locale, path)}): ${meta.description}`;
  }).join('\n');
}

/**
 * /llms.txt (llmstxt.org): a plain summary of the platform and links to its public pages, so AI
 * answer engines describe it from our own words (GEO, D-054). Built from the same page and plan
 * data as the site, so it cannot drift from what the pages say.
 */
export function llmsTxt(): string {
  const price = (id: PlanId) => String(PLANS[id].priceUsd);
  return `# ${site.name}

> An Arabic-first business model studio. Founders answer a structured diagnostic about their business idea; a deterministic formula engine calculates pricing, break-even and a three-year projection; and an exportable Arabic report ends with a clear verdict: go, revise or stop. An AI mentor asks critical questions. Arabic name: استوديو نموذج العمل.

Key facts:

- Interface in Arabic (default, right to left) and English. Reports are in Modern Standard Arabic; answers are understood in any Arabic dialect, including Algerian Darja mixed with French.
- No number in a report is produced by AI. Numbers come from tested formulas; AI only explains them.
- Every fact is tagged with its source: the user's answer, an assumption, or an external source with its link and the date it was read. Nothing is invented: without a reliable source a field stays empty, with the reason.
- The diagnostic has 64 questions across eight axes (quick version: 20 questions).
- Prices in US dollars: Free; Weekly $${price('weekly')} (7 days); Monthly $${price('monthly')}; Annual $${price('annual')} (365 days). Paid plans are not open yet.
- Status: under construction. Free accounts are open; the diagnostic and the report are being released in stages.
- A planning tool, not legal, financial or tax advice.

## Pages in English

${pageList('en')}

## Pages in Arabic

${pageList('ar')}

## Optional

- [Privacy policy (draft)](${pageUrl('en', '/privacy')})
- [Terms of use (draft)](${pageUrl('en', '/terms')})
`;
}
