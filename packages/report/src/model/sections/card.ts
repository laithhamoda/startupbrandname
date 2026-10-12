import { isKnownCurrency, moneyFromMajor } from '@sbn/engine';
import { valueOf, type StepId } from '@sbn/question-bank';
import { chipsOf } from '../../canvas/chips';
import type { CardRow } from '../../messages/types';
import { answerProvenance, isPivotalStep, type Ctx } from '../context';
import { labelOfCurrency } from '../format';
import { concat, join, plain } from '../inline';
import type { Block, DefinitionItem, Inline } from '../types';
import { paragraph } from './shared';

/** The answers that identify the project, in reading order: who, what, for whom, where, how (D-267). */
const CARD_SOURCES: readonly { readonly row: CardRow; readonly id: StepId }[] = [
  { row: 'team', id: 'A4' },
  { row: 'idea', id: 'B1' },
  { row: 'customerType', id: 'C1' },
  { row: 'customerProfile', id: 'C2' },
  { row: 'location', id: 'A1' },
  { row: 'workplace', id: 'E6' },
  { row: 'sector', id: 'D2' },
  { row: 'projectType', id: 'B7' },
  { row: 'pricingModel', id: 'F2' },
  { row: 'price', id: 'F1' },
  { row: 'capital', id: 'A5' },
  { row: 'goal', id: 'A8' },
];

/** An amount typed by the founder, written like every other amount; plain if the currency is unknown. */
function typedAmount(ctx: Ctx, amount: number, currency: string): Inline {
  if (!isKnownCurrency(currency) || !Number.isFinite(amount)) {
    return plain(`${String(amount)} ${labelOfCurrency(currency, ctx.input.project)}`);
  }
  return ctx.money(moneyFromMajor(amount, currency));
}

/** The text of one answered question, or null when it gave nothing to show. */
function answerText(ctx: Ctx, id: StepId): Inline | null {
  const answer = ctx.input.answers[id];
  if (answer?.status !== 'answered') return null;
  if (id === 'F1') {
    const price = valueOf(ctx.input.answers, 'F1', 'money');
    return price === undefined ? null : typedAmount(ctx, price.amount, price.currency);
  }
  if (id === 'A5') {
    const range = valueOf(ctx.input.answers, 'A5', 'money_range');
    if (range === undefined) return null;
    return ctx.m.card.moneyRange({
      min: typedAmount(ctx, range.min, range.currency),
      max: typedAmount(ctx, range.max, range.currency),
    });
  }
  if (id === 'A1') {
    const place = valueOf(ctx.input.answers, 'A1', 'country_city');
    if (place === undefined) return null;
    const country = plain(ctx.countryName(place.country));
    return place.city.trim() === ''
      ? country
      : ctx.m.card.location({ city: plain(place.city.trim()), country });
  }
  const chips = chipsOf(id, answer.value, id === 'A4', answerProvenance(ctx.input, id), {
    language: ctx.locale,
    currencyLabel: (code) => labelOfCurrency(code, ctx.input.project),
  });
  if (chips.length === 0) return null;
  return join(
    chips.map((chip) =>
      chip.label === null ? plain(chip.text) : plain(`${chip.label}: ${chip.text}`),
    ),
    ctx.m.words.listSeparator,
  );
}

/**
 * The project card: a definition list of the answers that say what the project is, each with its
 * provenance. The founder's own words enter as plain text, never as markup.
 */
export function buildProjectCard(ctx: Ctx): Block[] {
  const items: DefinitionItem[] = [];
  for (const { row, id } of CARD_SOURCES) {
    const text = answerText(ctx, id);
    if (text === null) continue;
    const provenance = answerProvenance(ctx.input, id);
    items.push({
      term: plain(ctx.m.card.rows[row]),
      definition: ctx.figureCell(concat(text), provenance, { pivotal: isPivotalStep(id) }),
      tag: null,
      label: null,
      url: null,
    });
  }
  if (items.length === 0) return [paragraph(plain(ctx.m.card.empty))];
  return [{ type: 'definitionList', title: null, items }];
}
