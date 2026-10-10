/** Why the engine refused an input. Callers branch on the code, never on the message. */
export type EngineErrorCode =
  | 'invalid_amount'
  | 'invalid_rate'
  | 'invalid_date'
  | 'invalid_param'
  | 'unknown_currency'
  | 'currency_mismatch'
  | 'unsafe_integer'
  | 'division_by_zero'
  | 'empty_input'
  | 'length_mismatch';

/**
 * The one error the engine throws. A calculation never continues with a guessed value: bad input
 * (a NaN amount, a currency with no known exponent, a total beyond the safe integer range) stops
 * the run, because a wrong number in a report is worse than no number (CLAUDE.md rule 9).
 */
export class EngineError extends Error {
  /** Machine-readable reason, stable across releases. */
  readonly code: EngineErrorCode;

  constructor(code: EngineErrorCode, message: string) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
  }
}
