import { EngineError } from './errors';

/**
 * The item at `index` (counted from 0) of a list the caller has already sized. A list shorter than
 * its caller expects is a bug in the inputs, not a missing value, so it stops the run with
 * `length_mismatch` instead of continuing with `undefined`.
 */
export function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new EngineError('length_mismatch', `Expected an item at position ${String(index)}.`);
  }
  return item;
}
