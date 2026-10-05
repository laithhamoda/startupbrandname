import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { valueSchema } from './fields';
import { FOLLOW_UPS } from './follow-ups';
import { QUESTIONS } from './questions';

// The stored-answer contract (QB-C1, D-165). Every saved answer is a row of answers whose
// normalized_value has the shape this bank gives its question. A value that no longer fits is
// read as missing (parseAnswers in apps/web), so a renamed option, a changed field kind or a
// renamed part would silently drop the answers founders already gave. The snapshot pins that
// shape; labels, help texts and limits are not part of it, so wording changes stay green.

const SNAPSHOT = './__contract__/answers.json';

const MIGRATION_NEEDED = [
  'The shape of stored answers changed (answers.normalized_value).',
  'Answers saved in the old shape would be read as missing.',
  'Ship a data migration that rewrites answers.normalized_value, or a read-time mapping in the',
  'question bank, together with a docs/DECISIONS.md entry; then update the snapshot with',
  '`pnpm --filter @sbn/question-bank exec vitest run -u`.',
].join(' ');

type Shape = string | Shape[] | { [part: string]: Shape };

/**
 * The parts of a value as stored: object keys (an optional one ends in "?"), lists, the values an
 * option list allows (sorted, since their order is not stored) and the type of each leaf. Bounds,
 * lengths and the checks across parts are left out.
 */
function shapeOf(schema: z.core.$ZodType): Shape {
  if (schema instanceof z.ZodObject) {
    return Object.fromEntries(
      Object.entries<z.core.$ZodType>(schema.shape).map(([key, part]) =>
        part instanceof z.ZodOptional ? [`${key}?`, shapeOf(part.unwrap())] : [key, shapeOf(part)],
      ),
    );
  }
  if (schema instanceof z.ZodArray) return { list: shapeOf(schema.element) };
  if (schema instanceof z.ZodTuple) return { tuple: schema.def.items.map(shapeOf) };
  if (schema instanceof z.ZodNullable) return { nullable: shapeOf(schema.unwrap()) };
  if (schema instanceof z.ZodOptional) return { optional: shapeOf(schema.unwrap()) };
  if (schema instanceof z.ZodEnum) return { oneOf: schema.options.map(String).sort() };
  // `.int()` sets the format "safeint".
  if (schema instanceof z.ZodNumber) return schema.format?.includes('int') ? 'integer' : 'number';
  const { type } = schema._zod.def;
  if (type === 'string' || type === 'boolean' || type === 'undefined') return type;
  throw new Error(`The answer contract cannot describe a "${type}" schema yet: extend shapeOf.`);
}

/** Every step a founder can answer, with what its stored value may be. */
function contract() {
  const steps = [
    ...QUESTIONS.map(({ id, field, allowUnknown }) => ({ id, field, allowUnknown })),
    // Follow-ups never accept «لا أعرف» (answerSchema(followUp.field, false) in apps/web).
    ...FOLLOW_UPS.map(({ id, field }) => ({ id, field, allowUnknown: false })),
  ];
  return Object.fromEntries(
    steps.map(({ id, field, allowUnknown }) => [
      id,
      { kind: field.kind, allowUnknown, value: shapeOf(valueSchema(field)) },
    ]),
  );
}

describe('the stored-answer contract', () => {
  it('matches the snapshot of every question and follow-up', async () => {
    // Written as Prettier writes it, so `pnpm format` never rewrites the snapshot.
    const path = fileURLToPath(new URL(SNAPSHOT, import.meta.url));
    const options = await resolveConfig(path);
    const text = await format(JSON.stringify(contract()), { ...options, filepath: path });

    await expect(text, MIGRATION_NEEDED).toMatchFileSnapshot(SNAPSHOT);
  });

  it('describes the option values of single, multi and profile answers', () => {
    const answers = contract();
    expect(answers.C1?.value).toMatchObject({ oneOf: expect.arrayContaining(['b2b']) as unknown });
    expect(answers.C2?.value).toMatchObject({
      'sector?': { oneOf: expect.arrayContaining(['I']) as unknown },
    });
  });

  it('fails on a shape it does not know, rather than leaving it out', () => {
    expect(() => shapeOf(z.date())).toThrow(/extend shapeOf/);
  });
});
