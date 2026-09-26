// Fails when UI code uses physical left/right styling instead of logical properties (CLAUDE.md §5).
// A line that genuinely needs a physical direction (e.g. a chart's left-to-right time axis) can opt
// out with the comment `logical-css-ignore` and a reason.
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const TARGETS = [join(ROOT, 'apps', 'web', 'src')];
const EXTENSIONS = /\.(ts|tsx|css|mjs)$/;

const RULES = [
  { name: 'Tailwind margin/padding', regex: /(?<![\w-])-?(ml|mr|pl|pr)-[\w[\]./%-]+/ },
  { name: 'Tailwind inset', regex: /(?<![\w-])-?(left|right)-(\d|\[|px|full|auto)/ },
  { name: 'Tailwind text align', regex: /(?<![\w-])text-(left|right)(?![\w-])/ },
  { name: 'Tailwind float/clear', regex: /(?<![\w-])(float|clear)-(left|right)(?![\w-])/ },
  { name: 'Tailwind border side', regex: /(?<![\w-])border-(l|r)(?![a-z])/ },
  { name: 'Tailwind rounded side', regex: /(?<![\w-])rounded-(l|r|tl|tr|bl|br)(?![a-z])/ },
  { name: 'Tailwind scroll margin/padding', regex: /(?<![\w-])scroll-(ml|mr|pl|pr)-/ },
  {
    name: 'Tailwind origin',
    regex: /(?<![\w-])origin-(left|right|top-left|top-right|bottom-left|bottom-right)(?![\w-])/,
  },
  {
    name: 'CSS side property',
    regex: /(?<![\w-])(margin|padding|border|scroll-margin|scroll-padding)-(left|right)(?![\w-])/,
  },
  { name: 'CSS inset property', regex: /(?<![\w$.-])(left|right)\s*:/ },
  { name: 'CSS text-align', regex: /text-align\s*:\s*['"]?(left|right)/ },
  { name: 'CSS float/clear', regex: /(float|clear)\s*:\s*['"]?(left|right)/ },
  {
    name: 'Inline style side property',
    regex: /(?<![\w-])(margin|padding|border)(Left|Right)(?![\w])/,
  },
];

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (EXTENSIONS.test(entry.name)) yield path;
  }
}

const findings = [];
let scanned = 0;

for (const target of TARGETS) {
  for await (const file of walk(target)) {
    scanned += 1;
    const lines = (await readFile(file, 'utf8')).split('\n');
    lines.forEach((line, index) => {
      if (line.includes('logical-css-ignore')) return;
      for (const { name, regex } of RULES) {
        const match = regex.exec(line);
        if (match) findings.push(`${relative(ROOT, file)}:${index + 1}  ${name}: "${match[0]}"`);
      }
    });
  }
}

if (findings.length > 0) {
  console.error(
    'Physical left/right styling found. Use logical properties (ms-, me-, ps-, pe-, start-, end-):',
  );
  for (const finding of findings) console.error(`  ${finding}`);
  process.exit(1);
}

console.log(`Logical CSS check passed (${scanned} files).`);
