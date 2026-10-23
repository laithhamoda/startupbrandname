# Fonts

Cairo (headings) and Tajawal (text) are files in this folder, so a build downloads nothing (D-254).
Both fonts are under the SIL Open Font License 1.1: the licence texts are `OFL-Cairo.txt` and
`OFL-Tajawal.txt` beside the files, and the licence allows bundling the fonts with its text.

`app/fonts.ts` loads them. Each file is one script of one family, the way Google serves them, with
its own `unicode-range` in `fonts.ts`.

| File                       | Script         | Weights | Bytes | SHA-256                                                          | Source                                                                              |
| -------------------------- | -------------- | ------- | ----- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `cairo-arabic.woff2`       | Arabic         | 600-800 | 30896 | 748022f50c427456ad66031e855349be3448ee1f05a5f1eb59574ebe0c686749 | https://fonts.gstatic.com/s/cairo/v31/SLXVc1nY6HkvangtZmpQdkhzfH5lkSscQyyS4J0.woff2 |
| `cairo-latin-ext.woff2`    | Latin extended | 600-800 | 16648 | da6ada83c3a87c2f0211325dc0a123702e1d4a940958b3e943ac4f37b31d5371 | https://fonts.gstatic.com/s/cairo/v31/SLXVc1nY6HkvangtZmpQdkhzfH5lkSscSCyS4J0.woff2 |
| `cairo-latin.woff2`        | Latin          | 600-800 | 33820 | 82c13cbd1352d76e97c3d335caa912ae68fecdc3949a43cf8d149eb892384c1b | https://fonts.gstatic.com/s/cairo/v31/SLXVc1nY6HkvangtZmpQdkhzfH5lkSscRiyS.woff2    |
| `tajawal-arabic-400.woff2` | Arabic         | 400     | 8932  | 6c9081fd00db08800850fa7d214593aa94992be5159e97557aa60197252cb95a | https://fonts.gstatic.com/s/tajawal/v12/Iura6YBj_oCad4k1nzSBC45I.woff2              |
| `tajawal-arabic-700.woff2` | Arabic         | 700     | 9024  | fa5e72326681abee3a4952be582e1c2c2abb27932ef262610c078ce89541f919 | https://fonts.gstatic.com/s/tajawal/v12/Iurf6YBj_oCad4k1l4qkHrRpiYlJ.woff2          |
| `tajawal-latin-400.woff2`  | Latin          | 400     | 10256 | b081f7bf790678b56a2c0502651d6873cbabc09e78fe40655df15f918b1e369b | https://fonts.gstatic.com/s/tajawal/v12/Iura6YBj_oCad4k1nzGBCw.woff2                |
| `tajawal-latin-700.woff2`  | Latin          | 700     | 9996  | de8f431c146ab1feb612cb7ced0842ae5c4e2f12067d13db0badeca73977200b | https://fonts.gstatic.com/s/tajawal/v12/Iurf6YBj_oCad4k1l4qkHrFpiQ.woff2            |

These are the files Google served on 2026-10-23 for the stylesheet
`https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800&family=Tajawal:wght@400;700&display=swap`.
Cairo is a variable font, so one file per script serves the three weights. The six files a page
preloads (all but `cairo-latin-ext.woff2`) weigh 102,924 bytes.

## Replacing them

1. Fetch the stylesheet above with a current browser `User-Agent` (Google answers WOFF2 only to
   one). Each `@font-face` block has a comment with the script, a `src` address and a
   `unicode-range`.
2. Download the files, keep the names above, and update the table: the size from `stat` and the
   checksum from `sha256sum`.
3. If a `unicode-range` differs from the one in `app/fonts.ts`, copy Google's (without the spaces)
   into the call of that script.
4. Run the end-to-end layout-shift test and the snapshots. If glyphs changed, regenerate the
   baselines with the manual "Update RTL snapshots" workflow (D-055), and record the change in
   `docs/DECISIONS.md`.
