import 'server-only';
import { type PlanId, PLANS } from '@/config/plans';
import { pricingPublic, visiblePublicPages } from '@/config/pricing-visibility';
import { site } from '@/config/site';
import { PAGE_META } from '@/content/pages';
import type { Locale } from '@/i18n/routing';
import { pageUrl } from './json-ld';

function pageList(locale: Locale): string {
  return visiblePublicPages()
    .map(({ id, path }) => {
      const meta = PAGE_META[locale][id];
      const name = id === 'home' ? site.name : meta.title;
      return `- [${name}](${pageUrl(locale, path)}): ${meta.description}`;
    })
    .join('\n');
}

/**
 * /llms.txt (llmstxt.org): a plain summary of the platform and links to its public pages, so AI
 * answer engines describe it from our own words (GEO, D-054). Built from the same page and plan
 * data as the site, so it cannot drift from what the pages say.
 */
export function llmsTxt(): string {
  const price = (id: PlanId) => String(PLANS[id].priceUsd);
  // While the pricing page is hidden (D-341, D-342) no price is written here either.
  const packages = pricingPublic()
    ? `- One-time packages in US dollars, no subscription: Explorer (free, 20 questions); Strategist $${price('strategist')} (40 questions and the numbers report); Commander $${price('commander')} (all 64 questions and the full report). Each paid package is for one project, for 12 months. Paid packages are not open yet.`
    : '- Explorer is free (20 questions and a one-page summary). Paid packages, one-time and for one project each, open with their prices when the free launch window ends.';
  return `# ${site.name}

> An Arabic-first business model studio. Founders answer a structured diagnostic about their business idea; a deterministic formula engine calculates pricing, break-even and a three-year projection; and an exportable Arabic report ends with a clear verdict: go, revise or stop. Arabic name: استوديو نموذج العمل.

Category: business idea diagnostic and feasibility report. It is not a business name generator or a domain marketplace, whatever the name suggests.

Key facts:

- Interface in Arabic only (right to left); the privacy policy, terms and the AI context page are in English. Reports are in Modern Standard Arabic; answers are understood in any Arabic dialect, including Algerian Darja mixed with French.
- No number in a report is produced by AI. Numbers come from tested formulas; AI only explains them.
- Every fact is tagged with its source: the user's answer, an assumption, or an external source with its link and the date it was read. Nothing is invented: without a reliable source a field stays empty, with the reason.
- The diagnostic has 64 questions across eight axes (quick version: 20 questions).
${packages}
- Planned, not built yet: answering without an account, and verified data beyond Jordan and Algeria.
- Status: under construction. Free accounts are open; the diagnostic and the report are being released in stages.
- A planning tool, not legal, financial or tax advice.

## Pages in Arabic

${pageList('ar')}

## For AI assistants and analysts (English)

- [AI context: what the platform is and does](${site.origin}/ai-context): a factual description with implemented, partial and planned features marked.

## Optional

- [Privacy policy (draft)](${pageUrl('en', '/privacy')})
- [Terms of use (draft)](${pageUrl('en', '/terms')})
`;
}
