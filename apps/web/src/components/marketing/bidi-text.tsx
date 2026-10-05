/** A number, or an English term in brackets such as "(Break-even)". */
const ISOLATED = /(\d+(?:[.,]\d+)*%?|\([A-Za-z][^()]*\))/;

/**
 * Plain text with every number and every bracketed English term isolated as a left-to-right run,
 * so digits never reorder and a term never splits across lines inside Arabic sentences
 * (CLAUDE.md §6).
 */
export function BidiText({ text }: { text: string }) {
  const parts = text.split(ISOLATED);
  return (
    <>
      {parts.map((part, index) => {
        // split() with a capture group puts every match at an odd index.
        if (index % 2 === 0) return part;
        return part.startsWith('(') ? (
          <bdi key={index} lang="en" dir="ltr" className="whitespace-nowrap">
            {part}
          </bdi>
        ) : (
          <bdi key={index} className="num">
            {part}
          </bdi>
        );
      })}
    </>
  );
}
