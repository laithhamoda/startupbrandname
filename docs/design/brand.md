# Brand kit

The logo mark, its colours, the files and the rules for using them (decision D-289). The geometry of
the mark is `apps/web/scripts/brand/mark.mjs`; `pnpm brand:build` writes every image below into
`apps/web/public`. Do not edit an image by hand: change the geometry or the script and rebuild, so
all sizes stay in step.

## Colours

| Role                  | Value     | Note                                                                               |
| --------------------- | --------- | ---------------------------------------------------------------------------------- |
| Teal, top faces       | `#1FA3C7` | The brand's teal token                                                             |
| Deep teal, side faces | `#1B89A9` | The one extra shade the supplied logo uses                                         |
| Gold, the square      | `#D4A537` | The brand's gold token. On a dark ground the top face of the arrowhead is gold too |
| Black, the icon plate | `#000000` | True black, like the verdict slab                                                  |

## Files

| File                                                      | Use                                                                                                                                                           |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/favicon.ico`                                      | 16, 32 and 48 pixels (PNG images inside). The fallback every browser reads                                                                                    |
| `public/icon.svg`                                         | The tab icon, scalable. The arrowhead's top face turns gold on a dark browser theme. Wider gap between the two pieces than the logo, so it holds at 16 pixels |
| `public/apple-touch-icon.png`                             | 180 pixels on the black plate. iOS rounds the corners itself, so the file is a full square                                                                    |
| `public/icon-192.png`, `public/icon-512.png`              | Android and installed web apps, for any use                                                                                                                   |
| `public/icon-maskable-512.png`                            | Fills the whole square; the mark stays inside the central circle of 80%, the platform's safe zone                                                             |
| `public/manifest.webmanifest`                             | Written by hand. `display` is `browser`: the site does not promise an installed app                                                                           |
| `public/brand/mark.svg`                                   | The mark on a light ground                                                                                                                                    |
| `public/brand/mark-on-dark.svg`                           | The mark on a dark ground (gold arrowhead face)                                                                                                               |
| `public/brand/mark-mono-black.svg`, `mark-mono-white.svg` | One colour, for stamps, print and watermarks; the faces are tints of it                                                                                       |
| `public/brand/logo-512.png`                               | Transparent, square. The `logo` of the Organization structured data                                                                                           |

## Sizes by place

| Place                 | Size shown                                  | File                                    |
| --------------------- | ------------------------------------------- | --------------------------------------- |
| Header, mark alone    | 32 to 40 px high (28 to 32 on a phone)      | the SVG; or PNG at 2x and 3x            |
| Header, mark and name | 36 to 44 px high                            | the SVG                                 |
| Tab                   | 16, 32, 48 px                               | `favicon.ico`, `icon.svg`               |
| Share image           | 1200 by 630, under 300 KB                   | `public/og/*`, made by `pnpm og:images` |
| Google logo           | 512 by 512 (at least 112)                   | `brand/logo-512.png`                    |
| Social avatars        | 400 by 400, the mark inside the central 70% | export from the SVG                     |
| Print and email       | 2000 px wide, or the SVG or PDF             | the SVG                                 |

Give an image its width and height in the page, so it never shifts the layout while it loads.

## Rules

- Clear space around the mark: the height of the gold square's vertical edge, about 19% of the
  mark's width, on every side.
- Smallest size: 16 px on a screen (use the tab icon below 32 px), 10 mm in print.
- Do not recolour the faces, rotate, skew, outline or add shadows or glows.
- Do not put the teal mark on a teal or gold ground. On a photograph or a mid-tone ground, use a mono
  version.
- Do not rebuild the name in another font. Until the wordmark's vector is supplied, the header keeps
  the name as live text, which screen readers and search engines read.

## Still open for the owner

See docs/OPEN-QUESTIONS.md #102: the wordmark's vector or font, an Arabic lockup, trademark
clearance, the origin of the logo's artwork, the header lockup and the plate colour.
