import {
  PARAM_KEYS,
  PIVOTAL_IDS,
  type AlertValue,
  type EngineRun,
  type Figure,
  type Money,
  type PivotalId,
  type Provenance as EngineProvenance,
  type Rate,
} from '@sbn/engine';
import type { Language, StepId } from '@sbn/question-bank';
import { ASSUMED, type ChipProvenance } from '../canvas';
import {
  officialLinks,
  registrationGuide,
  type OfficialLink,
  type RegistrationGuide,
} from '../legal-path';
import { messagesFor } from '../messages';
import type { ReportMessages, TermKey } from '../messages/types';
import {
  formatInteger,
  formatMoneyNumber,
  formatPercent,
  formatRatio,
  formatSignedPercent,
  isLatinLabel,
  labelOfCurrency,
} from './format';
import { concat, ltr, normalise, num, plain } from './inline';
import type { Cell, CellMark, Inline, Provenance, ReportInput } from './types';

/** What the legal-path section and the tax notice share (D-265). */
export interface LegalFacts {
  readonly guide: RegistrationGuide;
  readonly link: OfficialLink | null;
}

/** The pivotal steps (D-229): a low-confidence figure from one of them is highlighted. */
const PIVOTAL: ReadonlySet<string> = new Set<string>(PIVOTAL_IDS);

/** Whether a step is one of the five pivotal figures F1, F3, F4, F5 and F6. */
export function isPivotalStep(id: string): id is PivotalId {
  return PIVOTAL.has(id);
}

/** The provenance of a figure or an answer as the report stores it. */
export function provenanceOf(source: EngineProvenance | ChipProvenance): Provenance {
  return { source: source.source, confidence: source.confidence, validated: source.validated };
}

/** The stored provenance of an answer, or an unchecked assumption when nothing is stored (rule 2). */
export function answerProvenance(input: ReportInput, id: StepId): ChipProvenance {
  const stored = input.provenance[id];
  return stored === undefined ? ASSUMED : provenanceOf(stored);
}

function isRate(value: unknown): value is Rate {
  return (
    typeof value === 'object' &&
    value !== null &&
    'num' in value &&
    'den' in value &&
    typeof value.num === 'bigint' &&
    typeof value.den === 'bigint'
  );
}

/** The figure of one engine parameter in a run, by its stable key. */
export function paramOf(run: EngineRun, key: string): Figure<unknown> | undefined {
  return run.parameters.find((figure) => figure.inputs[0]?.id === key);
}

export function paramRate(run: EngineRun, key: string): Figure<Rate> | null {
  const figure = paramOf(run, key);
  if (figure === undefined || !isRate(figure.value)) return null;
  return { ...figure, value: figure.value };
}

export function paramNumber(run: EngineRun, key: string): number | null {
  const value = paramOf(run, key)?.value;
  return typeof value === 'number' ? value : null;
}

/** The longest break-even or payback the verdict looks at (D-227): the window or the horizon. */
export function feasibilityMonths(run: EngineRun): number {
  const window =
    paramNumber(run, PARAM_KEYS.feasibilityWindowMonths) ?? run.projection.calendar.horizonMonths;
  return Math.min(window, run.projection.calendar.horizonMonths);
}

/**
 * What the sections share while a report is built: the language, its messages, the way a number
 * and an amount are written, and the tracker that puts the English term in parentheses on its first
 * use only (D-270). One context makes one report; builders call it in reading order.
 */
export class Ctx {
  readonly input: ReportInput;
  readonly locale: Language;
  readonly m: ReportMessages;
  private readonly seenTerms = new Set<TermKey>();
  private legalFacts: LegalFacts | null = null;

  constructor(input: ReportInput) {
    this.input = input;
    this.locale = input.locale;
    this.m = messagesFor(input.locale);
  }

  /** The registration guide and the official tax link of the project's country, made once. */
  legal(): LegalFacts {
    if (this.legalFacts === null) {
      const { project, answers, packItems, today } = this.input;
      this.legalFacts = {
        guide: registrationGuide({
          country: project.countryCode,
          answers,
          items: packItems,
          today,
        }),
        link: officialLinks(project.countryCode, packItems, today),
      };
    }
    return this.legalFacts;
  }

  /** A term in the report's language, with the English term in parentheses the first time only. */
  term(key: TermKey): Inline {
    const { name, english } = this.m.terms[key];
    if (this.seenTerms.has(key) || english === null) {
      this.seenTerms.add(key);
      return plain(name);
    }
    this.seenTerms.add(key);
    return normalise([`${name} (`, { l: english }, ')']);
  }

  // ----- numbers ---------------------------------------------------------------------------

  /** The label written after an amount: the project's, or the currency's own code if it differs. */
  currencyPart(currency: string): Inline {
    const label = labelOfCurrency(currency, this.input.project);
    return isLatinLabel(label) ? ltr(label) : plain(label);
  }

  /** An amount: its number, then the currency label (the label is after the number, rule of D-267). */
  money(amount: Money): Inline {
    return concat(num(formatMoneyNumber(amount)), [' '], this.currencyPart(amount.currency));
  }

  integer(value: bigint | number): Inline {
    return num(formatInteger(value));
  }

  /** A whole percentage given as a number, such as the completeness of the answers. */
  wholePercent(value: number): Inline {
    return num(`${formatInteger(Math.round(value))}%`);
  }

  percent(rate: Rate): Inline {
    return num(formatPercent(rate));
  }

  signedPercent(rate: Rate): Inline {
    return num(formatSignedPercent(rate));
  }

  ratio(rate: Rate): Inline {
    return num(formatRatio(rate));
  }

  /** "month 6": the position of a month in the projection. */
  monthLabel(count: number): Inline {
    return this.m.month({ n: this.integer(count) });
  }

  /** "3 months", "one month": a length of time. */
  monthsPhrase(count: number): Inline {
    return this.m.months({ count, n: this.integer(count) });
  }

  /** A month or "no break-even within N months" when there was none. */
  monthOrNone(month: number | null, horizon: number): Inline {
    return month === null
      ? this.m.noBreakEvenWithin({ months: this.monthsPhrase(horizon) })
      : this.monthLabel(month);
  }

  /** One value an alert compared. */
  alertValue(value: AlertValue | null | undefined): Inline {
    if (value === null || value === undefined) return [];
    switch (value.kind) {
      case 'money':
        return this.money(value.money);
      case 'units':
        return concat(this.integer(value.units), [' '], plain(this.m.words.unitsWord));
      case 'months':
        return this.monthsPhrase(value.months);
      case 'months_after':
        return this.m.noBreakEvenWithin({ months: this.monthsPhrase(value.months) });
      case 'ratio':
        return this.ratio(value.ratio);
    }
  }

  // ----- places and currencies -------------------------------------------------------------

  /** The country's name in the report's language; the code itself when the platform cannot name it. */
  countryName(code: string): string {
    try {
      return (
        new Intl.DisplayNames([this.locale], { type: 'region' }).of(code.toUpperCase()) ?? code
      );
    } catch {
      return code;
    }
  }

  currencyName(code: string): string {
    try {
      return new Intl.DisplayNames([this.locale], { type: 'currency' }).of(code) ?? code;
    } catch {
      return code;
    }
  }

  // ----- cells -----------------------------------------------------------------------------

  /** A value with no provenance of its own (a label, a count, a computed comparison). */
  cell(text: Inline, mark: CellMark | null = null): Cell {
    return { text, provenance: null, lowConfidence: false, mark };
  }

  /**
   * A value with the provenance of the figure behind it. `pivotal` is set only for the answers F1,
   * F3, F4, F5 and F6 themselves, never for numbers derived from them (D-229): a low-confidence
   * pivotal figure is highlighted.
   */
  figureCell(
    text: Inline,
    figure: EngineProvenance | ChipProvenance,
    options: { readonly pivotal?: boolean; readonly mark?: CellMark | null } = {},
  ): Cell {
    return {
      text,
      provenance: provenanceOf(figure),
      lowConfidence: options.pivotal === true && figure.confidence === 'low',
      mark: options.mark ?? null,
    };
  }

  moneyCell(
    figure: Figure<Money>,
    options: { readonly pivotal?: boolean; readonly mark?: CellMark | null } = {},
  ): Cell {
    return this.figureCell(this.money(figure.value), figure, options);
  }
}
