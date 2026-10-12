import type { Language } from '@sbn/question-bank';
import { ar } from './ar';
import { en } from './en';
import type { ReportMessages } from './types';

export { ar, en };
export type { ReportMessages } from './types';
export {
  CARD_ROWS,
  EXPERIMENT_CODES,
  PARAM_LABEL_KEYS,
  TERM_KEYS,
  type CardRow,
  type ExperimentCode,
  type ParamLabelKey,
  type TermKey,
} from './types';

/** The messages of a report language. */
export function messagesFor(locale: Language): ReportMessages {
  return locale === 'ar' ? ar : en;
}
