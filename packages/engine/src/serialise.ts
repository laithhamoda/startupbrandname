import { at } from './array';
import { EngineError } from './errors';
import type { EngineRun } from './run';

/** A line longer than this is not kept on one line. */
const INLINE_LIMIT = 100;

type Canonical =
  | { readonly kind: 'scalar'; readonly text: string }
  | { readonly kind: 'array'; readonly items: readonly Canonical[] }
  | {
      readonly kind: 'object';
      readonly entries: readonly (readonly [string, Canonical])[];
    };

const scalar = (text: string): Canonical => ({ kind: 'scalar', text });

function unserialisable(what: string): never {
  throw new EngineError('unserialisable', `A run cannot be written with ${what} in it.`);
}

function isRate(value: object): value is { num: bigint; den: bigint } {
  const keys = Object.keys(value);
  const { num, den } = value as { num?: unknown; den?: unknown };
  return keys.length === 2 && typeof num === 'bigint' && typeof den === 'bigint';
}

/** Turns a value of a run into its canonical tree: strings for bigints and rates, sorted keys. */
function canonical(value: unknown): Canonical {
  switch (typeof value) {
    case 'string':
      return scalar(JSON.stringify(value));
    case 'boolean':
      return scalar(value ? 'true' : 'false');
    case 'bigint':
      return scalar(JSON.stringify(value.toString()));
    case 'number':
      if (!Number.isSafeInteger(value)) unserialisable('a number that is not a whole number');
      return scalar(String(value));
    case 'object': {
      if (value === null) return scalar('null');
      if (Array.isArray(value)) {
        return { kind: 'array', items: (value as unknown[]).map(canonical) };
      }
      const prototype = Object.getPrototypeOf(value) as unknown;
      if (prototype !== Object.prototype && prototype !== null) unserialisable('a class instance');
      if (isRate(value)) return scalar(JSON.stringify(`${String(value.num)}/${String(value.den)}`));
      const entries = Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([key, entry]): readonly [string, Canonical] => [key, canonical(entry)]);
      return { kind: 'object', entries };
    }
    default:
      return unserialisable(`a ${typeof value}`);
  }
}

/** The texts of nodes that are all scalars, or null as soon as one is a container. */
function scalarTexts(nodes: readonly Canonical[]): string[] | null {
  const texts: string[] = [];
  for (const node of nodes) {
    if (node.kind !== 'scalar') return null;
    texts.push(node.text);
  }
  return texts;
}

/** One line for a container of scalars when it is short enough, otherwise null. */
function inline(node: Exclude<Canonical, { readonly kind: 'scalar' }>): string | null {
  const texts = scalarTexts(
    node.kind === 'array' ? node.items : node.entries.map(([, entry]) => entry),
  );
  if (texts === null) return null;
  const text =
    node.kind === 'array'
      ? `[${texts.join(', ')}]`
      : node.entries.length === 0
        ? '{}'
        : `{ ${node.entries.map(([key], index) => `${JSON.stringify(key)}: ${at(texts, index)}`).join(', ')} }`;
  return text.length <= INLINE_LIMIT ? text : null;
}

function write(node: Canonical, indent: string): string {
  if (node.kind === 'scalar') return node.text;
  const short = inline(node);
  if (short !== null) return short;
  const inner = `${indent}  `;
  if (node.kind === 'array') {
    return `[\n${node.items.map((item) => `${inner}${write(item, inner)}`).join(',\n')}\n${indent}]`;
  }
  const lines = node.entries.map(
    ([key, entry]) => `${inner}${JSON.stringify(key)}: ${write(entry, inner)}`,
  );
  return `{\n${lines.join(',\n')}\n${indent}}`;
}

/**
 * Writes a value as stable JSON text (D-219): the same value always gives the same bytes, on any
 * machine. A `bigint` is its decimal digits in a string, a rate (an object of exactly a `num` and a
 * `den` bigint) is `"numerator/denominator"` in a string, keys are sorted by their UTF-16 code
 * units (no locale), a key whose value is `undefined` is left out, and the text ends with one
 * newline. Containers that hold only scalars stay on one line when they fit in 100 characters; the
 * rest are written one entry to a line with two spaces of indent. Whole numbers only: a number
 * that is not a safe integer, a class instance, a function or a symbol stops with `unserialisable`,
 * because a float or a clock-dependent object would make the text unstable. There is no parser:
 * M5 stores the text and reads the run from its inputs again.
 */
export function canonicalJson(value: unknown): string {
  return `${write(canonical(value), '')}\n`;
}

/** A run as stable JSON text: `canonicalJson` of the whole `EngineRun` (D-219). */
export function serialiseRun(run: EngineRun): string {
  return canonicalJson(run);
}
