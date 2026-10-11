import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { assembleLine, hasRtlLetter, type BaseDirection, type Piece } from './bidi';

/**
 * Reads a PDF back for the tests (D-241): page sizes, the text of each page in reading order, the
 * embedded fonts, the outline and the tags. Test support only (pdfjs-dist is a dev dependency):
 * nothing in the application imports this module.
 */

export interface InspectedPage {
  /** 1-based. */
  number: number;
  /** Points. */
  width: number;
  height: number;
  landscape: boolean;
  /** The lines of the page, top to bottom, as a person reads them (see assembleLine). */
  text: string;
  /** The text as the PDF stores it: Arabic in joined letter forms, drawn left to right. */
  storedText: string;
}

export interface InspectedPdf {
  pages: InspectedPage[];
  /** The names of the embedded fonts, subset prefix removed ("Cairo-Bold"). */
  fonts: string[];
  /** The titles of the outline entries, depth first. */
  outline: string[];
  /** True when the pages have a structure tree. */
  tagged: boolean;
  /** The text of all pages, one page after the other. */
  text: string;
}

interface Positioned extends Piece {
  y: number;
}

interface OutlineNode {
  title: string;
  items: OutlineNode[];
}

/** Baselines closer than this (points) are one line. */
const SAME_LINE = 3;

function flattenOutline(nodes: readonly OutlineNode[] | null): string[] {
  return (nodes ?? []).flatMap((node) => [node.title, ...flattenOutline(node.items)]);
}

/** The pieces of a page grouped in lines, top to bottom. */
function groupLines(pieces: readonly Positioned[]): Positioned[][] {
  const lines: Positioned[][] = [];
  for (const piece of [...pieces].sort((a, b) => b.y - a.y)) {
    const line = lines.at(-1);
    if (line && Math.abs((line[0]?.y ?? 0) - piece.y) <= SAME_LINE) line.push(piece);
    else lines.push([piece]);
  }
  return lines;
}

export interface InspectOptions {
  /** The direction of the document: rtl for Arabic. Decides how each line is read back. */
  direction: BaseDirection;
}

export async function inspectPdf(pdf: Uint8Array, options: InspectOptions): Promise<InspectedPdf> {
  // pdf.js takes ownership of the buffer it is given, so it gets a copy.
  const task = getDocument({
    data: new Uint8Array(pdf),
    fontExtraProperties: true,
    useSystemFonts: false,
  });
  const document = await task.promise;
  try {
    const pages: InspectedPage[] = [];
    const fonts = new Set<string>();
    let tagged = false;
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number);
      const [x0 = 0, y0 = 0, x1 = 0, y1 = 0] = page.view;
      const width = Math.round(Math.abs(x1 - x0));
      const height = Math.round(Math.abs(y1 - y0));
      const content = await page.getTextContent();

      const pieces: Positioned[] = [];
      const used = new Set<string>();
      for (const item of content.items) {
        if (!('str' in item) || item.str === '') continue;
        pieces.push({
          str: item.str,
          x: Number(item.transform[4]),
          y: Number(item.transform[5]),
          width: item.width,
        });
        used.add(item.fontName);
      }
      const lines = groupLines(pieces);
      pages.push({
        number,
        width,
        height,
        landscape: width > height,
        // A line is read from the right when the document is right-to-left and the line has
        // Arabic in it; a line of Latin text (a footer, an address) keeps its order.
        text: lines
          .map((line) =>
            assembleLine(
              line,
              options.direction === 'rtl' && line.some((piece) => hasRtlLetter(piece.str))
                ? 'rtl'
                : 'ltr',
            ),
          )
          .join('\n'),
        storedText: lines
          .map((line) =>
            [...line]
              .sort((a, b) => a.x - b.x)
              .map((piece) => piece.str)
              .join(' '),
          )
          .join('\n'),
      });

      // The fonts are loaded into the common objects by reading the page's operators.
      await page.getOperatorList();
      for (const id of used) {
        const font: unknown = page.commonObjs.has(id) ? page.commonObjs.get(id) : undefined;
        if (typeof font === 'object' && font !== null && 'name' in font) {
          if (typeof font.name === 'string') fonts.add(font.name.replace(/^[A-Z]{6}\+/, ''));
        }
      }
      // A page of a tagged PDF has a structure tree; an untagged one answers null.
      const tree: unknown = await page.getStructTree();
      if (tree) tagged = true;
    }
    return {
      pages,
      fonts: [...fonts].sort(),
      outline: flattenOutline(await document.getOutline()),
      tagged,
      text: pages.map((page) => page.text).join('\n'),
    };
  } finally {
    await task.destroy();
  }
}
