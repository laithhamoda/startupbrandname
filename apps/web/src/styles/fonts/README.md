# Fonts

Cairo (headings) and Tajawal (text) are files in this folder, so a build downloads nothing (D-254).
Both fonts are under the SIL Open Font License 1.1: the licence texts are `OFL-Cairo.txt` and
`OFL-Tajawal.txt` beside the files, and the licence allows bundling the fonts with its text.

`app/fonts.ts` loads them. Each file is one script of one family, the way Google serves them, with
its own `unicode-range` in `fonts.ts`.

| File                       | Script         | Weights | Bytes | SHA-256                                                          | Source                                                                                   |
| -------------------------- | -------------- | ------- | ----- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `cairo-arabic.woff2`       | Arabic         | 600-800 | 30712 | f8c2790bba35c6ff34816a2b0cd737f545f23fbf509c1538433e8e8e81d70d6c | https://fonts.gstatic.com/s/cairo/v31/SLXVc1nY6HkvangtZmpQdkhzfH5lkSscQyyS8p4_RHH1.woff2 |
| `cairo-latin-ext.woff2`    | Latin extended | 600-800 | 16632 | 0db86946b44d9fa7a88071c74ae75a2c874845998c467e749d8ecca590230075 | https://fonts.gstatic.com/s/cairo/v31/SLXVc1nY6HkvangtZmpQdkhzfH5lkSscSCyS8p4_RHH1.woff2 |
| `cairo-latin.woff2`        | Latin          | 600-800 | 33644 | ff64b48b1b800fb2ced52df32d9c8b1a1275893297179dbf403f2aa997751601 | https://fonts.gstatic.com/s/cairo/v31/SLXVc1nY6HkvangtZmpQdkhzfH5lkSscRiyS8p4_RA.woff2   |
| `tajawal-arabic-400.woff2` | Arabic         | 400     | 8916  | 4969197a00e95b22413373f0f30b870e90fdfbe1c1b9aa2620d3e5fa0771c74d | https://fonts.gstatic.com/s/tajawal/v12/Iura6YBj_oCad4k1nzSBC5xLhLFw4Q.woff2             |
| `tajawal-arabic-700.woff2` | Arabic         | 700     | 9040  | 33d0ac88246960c05e487caa5cacfde93a5c9c4ea29e4970e7f5dcb8a1fcba6f | https://fonts.gstatic.com/s/tajawal/v12/Iurf6YBj_oCad4k1l4qkHrRpiZtK6GwN9w.woff2         |
| `tajawal-latin-400.woff2`  | Latin          | 400     | 10228 | 3f7d7e374e3f470df3c34e26108d62e5b90af7ba6c5e8d8a3cde36483d144d49 | https://fonts.gstatic.com/s/tajawal/v12/Iura6YBj_oCad4k1nzGBC5xLhLE.woff2                |
| `tajawal-latin-700.woff2`  | Latin          | 700     | 9988  | 0a39a43c719fe4dfef860dbd90fd857492d5ecf518dc89a2f3fd3c88b57e605d | https://fonts.gstatic.com/s/tajawal/v12/Iurf6YBj_oCad4k1l4qkHrFpiZtK6Gw.woff2            |

These are the files that `next/font/google` downloaded at every build, so the pages look as they
did: Google answers the `User-Agent` that Next.js sends (Chrome 104 on macOS, see
`next/dist/compiled/@next/font/dist/google/fetch-resource.js`) with these files, checked on
2026-10-23 with the stylesheets
`https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800&display=swap` and
`https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap`, and the live site
served the same bytes. A current browser gets other files (a few hundred bytes larger, with other
addresses) that draw the text a little differently, so do not take them from a browser. Cairo is a
variable font, so one file per script serves the three weights. The six files a page preloads (all
but `cairo-latin-ext.woff2`) weigh 102,528 bytes.

## Replacing them

1. Fetch the two stylesheets above with the `User-Agent` of `fetch-resource.js` (the one in the
   installed Next.js). Each `@font-face` block has a comment with the script, a `src` address and
   a `unicode-range`.
2. Download the files, keep the names above, and update the table: the size from `stat` and the
   checksum from `sha256sum`.
3. If a `unicode-range` differs from the one in `app/fonts.ts`, copy Google's (without the spaces)
   into the call of that script.
4. Run the end-to-end layout-shift test and the snapshots. If glyphs changed, regenerate the
   baselines with the manual "Update RTL snapshots" workflow (D-055), and record the change in
   `docs/DECISIONS.md`.
