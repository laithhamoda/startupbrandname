import 'server-only';
import { AXES, AXIS_NAMES } from '@sbn/question-bank';
import { PLANS, REPORT_VERSIONS, upgradePrice } from '@/config/plans';

/**
 * /ai-context (D-337): one plain-English page written for AI assistants, reviewers and analysts.
 * Every statement is checked against the code (status labels say which). Numbers come from the
 * same tables the product reads, so prices and axis names cannot drift. What stays private (the
 * wording of the question bank beyond the public quick questions, the scoring weights and the
 * thresholds, prompts and formulas) is not written here (D-303, D-304).
 * Update this file whenever a feature ships or changes (see CLAUDE.md).
 */

export const AI_CONTEXT_REVIEWED = '2026-11-06';

export type FeatureStatus = 'implemented' | 'partial' | 'planned';

export const STATUS_LABEL: Record<FeatureStatus, string> = {
  implemented: 'Implemented',
  partial: 'Partly implemented',
  planned: 'Planned, not built',
};

export interface Feature {
  name: string;
  status: FeatureStatus;
  /** What it does, how the user meets it, what problem it solves, what comes out. */
  body: string;
}

export interface Section {
  id: string;
  title: string;
  paragraphs?: readonly string[];
  bullets?: readonly string[];
  features?: readonly Feature[];
}

export const AI_CONTEXT_TITLE = 'Startup Brand Name: what the platform is and what it does';
export const AI_CONTEXT_DESCRIPTION =
  'A plain, factual description of Startup Brand Name for AI assistants and analysts: an Arabic-first business model studio that turns a business idea into a number-backed report with a go, revise or stop verdict.';

export const AI_CONTEXT_LEAD =
  'Startup Brand Name (startupbrandname.com) is an Arabic-first business model studio. A founder answers a structured diagnostic about a business idea; a deterministic formula engine calculates pricing, break-even and a three-year projection; and the platform produces an exportable Arabic report that ends with a verdict: go, revise or stop. This page describes what exists today, what is partly built and what is only planned.';

const price = (id: keyof typeof PLANS): string => `$${String(PLANS[id].priceUsd)}`;
const axisNames = AXES.map((axis) => AXIS_NAMES[axis].en).join('; ');

export const AI_CONTEXT_SECTIONS: readonly Section[] = [
  {
    id: 'overview',
    title: '1. Platform overview',
    paragraphs: [
      'Arabic name: استوديو نموذج العمل (Business Model Studio). It is a standalone product built and run independently by a founder based in Amman, Jordan. It is not a business name generator, a domain marketplace or a general chatbot, whatever the name suggests.',
      'The problem it solves: a founder who asks a general chatbot about an idea gets fluent text with invented numbers and no fixed path. Here the path is mandatory and structured, the numbers are calculated by tested code rather than written by a language model, every figure carries where it came from, and the result is a professional document the founder can show an adviser or an investor. It does not promise funding or success.',
      'Why it exists: Arabic-speaking founders have few tools that combine a structured diagnostic, local market and legal context, and real financial calculation in their own language and dialect.',
    ],
    bullets: [
      'Structured and mandatory: 64 questions in eight axes, in three depths.',
      'Calculated, not written: no number in a report is produced by AI.',
      'Provenance: each answer and value is tagged as the user’s answer, an assumption, or an external source with its link and the date it was read. Without a reliable source a field stays empty, with the reason.',
      'Arabic first: the interface and report are in Modern Standard Arabic; answers may be written in any Arabic dialect, including Algerian Darja mixed with French.',
      'A clear verdict at the end of the report: go (امضِ), revise (عدّل) or stop (توقّف).',
    ],
  },
  {
    id: 'features',
    title: '2. Features and capabilities',
    features: [
      {
        name: 'Structured diagnostic',
        status: 'implemented',
        body: `64 questions in eight axes (${axisNames}). Three depths: quick (20 questions), standard (40) and full (64). The founder answers one question at a time, can save and resume, and sees a completeness score per axis and what is still missing. Output: a complete, validated set of answers per project.`,
      },
      {
        name: 'Answer review and dialect handling',
        status: 'implemented',
        body: 'Fixed rules check answers for contradictions and gaps and produce notes the founder resolves, plus validation tasks to test the idea in the real world. An AI step detects the language of a free-text answer and rewrites dialect or mixed-language wording into Modern Standard Arabic for the founder to confirm; both the raw text and the normalised text are kept.',
      },
      {
        name: 'Deterministic calculation engine',
        status: 'implemented',
        body: 'Pure TypeScript with integer arithmetic (no floating-point money). It computes unit economics, pricing, break-even, a sales curve with seasonality, a 36-month (three-year) projection, cash flow, scenarios and a validation plan, and derives the verdict. Every formula is unit-tested.',
      },
      {
        name: 'Project result and verdict',
        status: 'implemented',
        body: 'A result view on the project page shows the verdict and the reasons. If answers are missing it says which ones, instead of guessing.',
      },
      {
        name: 'Reports: summary, numbers report and full report',
        status: 'implemented',
        body: 'Three report levels. The one-page summary (verdict, top risks, break-even) is available to every account. The numbers report adds pricing, unit economics, projection, cash and the legal path. The full report has twelve sections: cover, executive summary, project card, canvases, pricing and unit economics, projection, scenarios and sensitivity, legal path and financing, validation plan, and appendices for assumptions, sources and disclaimer. Sections a package does not include are never computed or sent to the browser.',
      },
      {
        name: 'Arabic PDF export',
        status: 'implemented',
        body: 'The report is rendered to PDF with headless Chromium so Arabic shaping and right-to-left layout are correct.',
      },
      {
        name: 'Business Model Canvas',
        status: 'implemented',
        body: 'A canvas built from the project’s answers, with the customer segments on the right as Arabic readers expect. Editing a cell edits the underlying answer, so there is one source of truth.',
      },
      {
        name: 'Report versions',
        status: 'implemented',
        body: `Each paid project keeps up to ${String(REPORT_VERSIONS.max)} report versions, and after the first go verdict at most ${String(REPORT_VERSIONS.afterGo)} more edits before a final version is chosen. This limit is a current setting and may change.`,
      },
      {
        name: 'Sample report',
        status: 'implemented',
        body: 'A public sample report for a fictional project lets a visitor see the full output before starting.',
      },
      {
        name: 'Accounts',
        status: 'implemented',
        body: 'Sign-in by a one-time code sent by email, or Google. New accounts give their country, whether they have a project or an idea, and accept the terms; a cross-border data consent is separate and optional. Account deletion is available.',
      },
      {
        name: 'Packages, checkout, vouchers and affiliates',
        status: 'implemented',
        body: 'One-time packages sold through Paddle (merchant of record), voucher codes for course trainees and partners, and an affiliate record that credits a code when it is activated. An internal admin area with two-factor sign-in manages them. See the business model section.',
      },
      {
        name: 'Country data for Jordan and Algeria',
        status: 'partial',
        body: 'Country data for Jordan and Algeria was read from official pages and is dated and sourced; anything older than 90 days is labelled to check the official source. The tax-calculation module exists, but verified tax-rule rows are not loaded yet, so country tax figures are not produced. Other countries get the full analysis with the country-specific sections marked as not yet verified.',
      },
      {
        name: 'Free launch window',
        status: 'partial',
        body: 'A limited free window gives the first accounts that claim a launch spot (up to 500, until 3 February 2027 at the latest, with a confirmed email) access to the full report at 80% completeness. The database and the claim button exist; the public countdown does not yet.',
      },
      {
        name: 'Answering without an account',
        status: 'planned',
        body: 'Letting a visitor answer the diagnostic before signing up, and read part of the finished report, with the verdict behind sign-in. Designed, not built.',
      },
      {
        name: 'More verified markets and tools',
        status: 'planned',
        body: 'Verified data for Gulf countries, an automated review of country data, competitor research with web search, and a pitch-deck export are on the roadmap and not built.',
      },
    ],
  },
  {
    id: 'journey',
    title: '3. User journey',
    bullets: [
      'The visitor reads the home page, the methodology and the sample report. Pages are in Arabic.',
      'The visitor signs up with an email code or Google, then gives country and whether they have a project or an idea.',
      'The founder creates a project (name, country, currency, depth) and answers the diagnostic axis by axis. Answers are saved as they go and the founder can leave and resume.',
      'The platform reviews answers, asks the founder to confirm normalised wording, and lists notes to resolve and real-world tests to run.',
      'The project page shows completeness and, when enough is answered, the result and verdict.',
      'The founder can open the Business Model Canvas and edit it; edits change the underlying answers.',
      'The report opens according to the package or launch spot and the completeness gate; the full report needs at least 80% completeness and real values for the core numeric answers. The founder downloads it as a PDF.',
      'The founder can improve answers and produce new report versions, within the version limit.',
      'Optionally the founder buys a package or activates a voucher code. Free projects are kept for 30 days; paid projects stay editable for 12 months and readable for 90 days more.',
    ],
  },
  {
    id: 'audience',
    title: '4. Target audience',
    bullets: [
      'First-time and early-stage founders in Arabic-speaking markets, who get a structured way to test an idea and a document to discuss it. Verified country data currently covers Jordan and Algeria; Gulf countries are a stated priority and are not yet verified.',
      'Founders who write in dialect or mix Arabic with French, who are understood without being asked to rewrite their answers.',
      'Trainees of the owner’s entrepreneurship course, who receive a voucher for twelve months of the standard package.',
      'Partners who distribute voucher codes and are credited when a code is activated.',
    ],
  },
  {
    id: 'business-model',
    title: '5. Business model',
    paragraphs: [
      'All prices are in US dollars, one-time, with no subscription. Each paid package covers one project. These are the values in the product’s configuration today.',
    ],
    bullets: [
      `Explorer: free. Quick diagnostic (20 questions), one-page summary, one project, 30-day retention.`,
      `Strategist: ${price('strategist')}. Standard diagnostic (40 questions) and the numbers report, for one project, 12 months of editing plus 90 days read-only.`,
      `Commander: ${price('commander')}. All 64 questions and the full report, for one project, same duration. Upgrading from Strategist costs the difference, ${String(upgradePrice('strategist', 'commander'))} dollars.`,
      'Course voucher: the standard package on every project for 12 months from activation, at no charge. Voucher codes look like VIVA followed by eight hexadecimal characters and carry no meaning in themselves.',
      'Payments: card or PayPal through Paddle, the merchant of record. The platform never stores card data. The age check (18 or older) happens at payment.',
      'Revenue model: one-time package sales and voucher-based distribution with affiliate credit on activation. The affiliate amount is not published.',
      'Launch period: during the free launch window the full report is open to accounts holding a launch spot, as described above. Paid packages open when the window ends.',
    ],
  },
  {
    id: 'technology',
    title: '6. Technology and architecture (high level)',
    bullets: [
      'Front end: Next.js (App Router), React and TypeScript, styled with Tailwind CSS using logical properties so right-to-left layout is native. Arabic fonts are self-hosted.',
      'Back end: server-rendered pages, server actions and route handlers in the same Next.js app, with input validation at every server boundary.',
      'Database and sign-in: Supabase (PostgreSQL, Auth, Storage) in Frankfurt, EU, with per-user data isolation enforced in the database.',
      'Calculation and content packages in a monorepo: the formula engine, the question bank, report assembly, payments, and the AI client.',
      'AI: Anthropic Claude models through the official SDK, used only for text review today. See the next section.',
      'Payments: Paddle checkout and webhooks; a provider interface keeps the payment vendor replaceable.',
      'Hosting: Vercel with functions pinned to Frankfurt, close to the database.',
      'Analytics: cookieless page counts without user identifiers.',
      'Quality: automated unit tests (the engine has a 95% coverage threshold), accessibility and right-to-left checks in the browser, and security headers on every response.',
    ],
  },
  {
    id: 'ai',
    title: '7. AI capabilities',
    paragraphs: [
      'Today AI does one job: reviewing free-text answers. It detects the language, rewrites dialect or mixed wording into Modern Standard Arabic for the founder to confirm, and flags a few possible contradictions for the fixed rules to handle. It uses a small, fast Claude model.',
      'Inputs and privacy: only the project’s own content is sent. Name, email and phone are removed and the user id is replaced by a random token for each request, in one module that is tested. Unchanged inputs are not sent again; each call is logged with its cost, and daily limits apply per user and overall.',
      'What AI never does: it never produces a number that appears in a report, and it does not decide the verdict. Numbers come from the formula engine; the verdict comes from fixed rules over those numbers.',
      'Limitations and dependencies: AI suggestions can be wrong, which is why the founder confirms each rewrite. The feature depends on the Anthropic API being available.',
    ],
  },
  {
    id: 'positioning',
    title: '8. Competitive positioning',
    bullets: [
      'Compared with a general chatbot: a mandatory structured path, numbers computed by tested code, a provenance tag on facts, saved projects, and a professional exportable report. A chatbot can describe a business model; this platform calculates one from the founder’s own answers.',
      'Compared with a business plan template: the questions adapt to the answers, the numbers update when an answer changes, and the result is a verdict with reasons, not a blank document.',
      'Arabic first: right-to-left design, Modern Standard Arabic output, dialect and French code-switching understood on input.',
      'Honest about gaps: where country data is not verified the report says so, and a stop verdict is always stated as not feasible in its current form, with exactly three specific changes that would change it.',
      'Limits of the claim: the platform is a planning tool, not legal, tax or financial advice, and it does not predict market success.',
    ],
  },
  {
    id: 'status',
    title: '9. Current development status',
    bullets: [
      'Completed: the diagnostic, answer review, calculation engine, project result, summary, numbers and full reports, Arabic PDF, canvas, report versions, sample report, accounts, packages with Paddle checkout, vouchers, affiliates, admin area, Arabic-only interface.',
      'Under development: the free launch window’s public countdown and abuse limits, and the answer-without-an-account flow.',
      'Planned: verified Gulf data, verified tax-rule data, automated country-data review, competitor research and pitch-deck export.',
      'Known limitations: the interface is Arabic only (the privacy policy, terms and this page are in English); verified country data covers Jordan and Algeria only; the product is in an early public stage and the free launch window is limited in time and places.',
      'Dependencies: Supabase (database and sign-in), Vercel (hosting), Anthropic (text review), Paddle (payments).',
    ],
  },
  {
    id: 'verification',
    title: '10. How this page is kept accurate',
    paragraphs: [
      `Last reviewed: ${AI_CONTEXT_REVIEWED}. The prices and the axis names above are read from the product’s own configuration. The page is updated whenever a feature ships or changes. Status labels are deliberate: a feature that is planned is never described as available.`,
      'Not published on purpose: the full wording of the question bank beyond the public quick questions, scoring weights and thresholds, AI prompts, formulas, and any credentials or internal configuration.',
    ],
  },
];
