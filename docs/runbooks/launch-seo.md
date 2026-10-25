# Public launch: indexing, search consoles and analytics (M2b)

Search indexing stays off until the owner decides to launch (D-027, D-054). Do these steps in order
on launch day. None of them needs a code change.

## 0. Before launch: only the AI crawlers (D-303)

To let AI answer engines read the public pages while search engines stay out, set
`AI_CRAWLERS_ALLOWED` = `true` for **Production** only (type: Config) and redeploy. Check
https://startupbrandname.com/robots.txt: it lists the AI crawlers with `Allow: /` and the private
paths under `Disallow`, and ends with `User-Agent: *` and `Disallow: /`; a page's response must not
carry `X-Robots-Tag: noindex`. To undo, set it back to `false` and redeploy. Search engines are kept
out by robots.txt alone in this state: a page that other sites link to may still be listed by its
address without text. Step 2 below replaces this state at launch.

## 1. Visitor statistics (can be done before launch)

1. Vercel → project `startupbrandname` → **Analytics** → **Enable** (Web Analytics).
2. Only the production deployment is counted (D-098). No cookie banner is needed (D-092).

## 2. Turn indexing on

1. Vercel → project `startupbrandname` → Settings → Environment Variables → add
   `SITE_INDEXABLE` = `true` for **Production** only (type: Config).
2. Redeploy production.
3. Check https://startupbrandname.com/robots.txt: it must allow `/` and list the sitemap, and a
   page's response headers must no longer carry `X-Robots-Tag: noindex`.

## 3. Google Search Console

1. https://search.google.com/search-console → Add property → **Domain** → `startupbrandname.com`.
2. Add the TXT record Google shows at Unstoppable Domains (DNS for `startupbrandname.com`), then
   press **Verify**.
3. Sitemaps → submit `https://startupbrandname.com/sitemap.xml`.
4. URL inspection → request indexing for `/ar` and `/en`.

## 4. Bing Webmaster Tools

1. https://www.bing.com/webmasters → Add a site → **Import from Google Search Console** (fastest),
   or add `https://startupbrandname.com` and verify by DNS.
2. Sitemaps → submit `https://startupbrandname.com/sitemap.xml`.

## 5. Checks

- Rich Results Test (https://search.google.com/test/rich-results) on `/ar/faq`, `/en/glossary` and
  `/en/pricing`: no errors.
- Schema validator (https://validator.schema.org) on `/ar`: Organization, WebSite, WebPage and
  WebApplication are read.
- Share a page link in a messaging app: the share image and title appear in the page's language.
