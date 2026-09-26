import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Reads the real token file, so a colour change that breaks WCAG 2.2 AA fails the build (M1 DoD).
const css = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8');

function blockAfter(marker: string): string {
  const start = css.indexOf(marker);
  if (start === -1) throw new Error(`Token block not found: ${marker}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

function hexTokens(block: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const match of block.matchAll(/--sbn-([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    const [, name, hex] = match;
    if (name && hex) tokens[name] = hex;
  }
  return tokens;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

const light = hexTokens(blockAfter(':root {'));
const darkMedia = hexTokens(blockAfter(":root:not([data-theme='light'])"));
const darkExplicit = hexTokens(blockAfter(":root[data-theme='dark']"));
const dark = { ...light, ...darkExplicit };

// Text pairs need 4.5:1; controls, focus rings and progress fills need 3:1 (WCAG 1.4.3, 1.4.11).
const TEXT_PAIRS: readonly [string, string][] = [
  ['ink', 'paper'],
  ['ink', 'surface'],
  ['ink', 'sunken'],
  ['ink-2', 'paper'],
  ['ink-2', 'sunken'],
  ['muted', 'paper'],
  ['muted', 'surface'],
  ['muted', 'sunken'],
  ['teal-ink', 'paper'],
  ['teal-ink', 'surface'],
  ['gold-ink', 'paper'],
  ['gold-ink', 'surface'],
  ['danger', 'paper'],
  ['danger', 'surface'],
  ['on-gold', 'gold'],
  ['paper', 'ink'],
  ['slab-text', 'slab'],
  ['slab-muted', 'slab'],
  ['gold', 'slab'],
];

const UI_PAIRS: readonly [string, string][] = [
  ['control', 'paper'],
  ['control', 'surface'],
  ['teal-ink', 'paper'],
  ['teal-ink', 'sunken'],
];

describe.each([
  ['light', light],
  ['dark', dark],
] as const)('%s theme contrast', (_theme, tokens) => {
  it.each(TEXT_PAIRS)('text %s on %s is at least 4.5:1', (fg, bg) => {
    expect(contrast(tokens[fg] ?? '', tokens[bg] ?? '')).toBeGreaterThanOrEqual(4.5);
  });

  it.each(UI_PAIRS)('control %s on %s is at least 3:1', (fg, bg) => {
    expect(contrast(tokens[fg] ?? '', tokens[bg] ?? '')).toBeGreaterThanOrEqual(3);
  });
});

describe('token file', () => {
  it('defines every token used by the pairs in the light theme', () => {
    const names = new Set([...TEXT_PAIRS, ...UI_PAIRS].flat());
    for (const name of names) expect(light, name).toHaveProperty(name);
  });

  it('keeps the two dark blocks identical', () => {
    expect(darkMedia).toEqual(darkExplicit);
  });

  it('keeps the brand colours fixed (CLAUDE.md §6)', () => {
    expect(light).toMatchObject({ gold: '#d4a537', teal: '#1fa3c7', slab: '#000000' });
  });
});
