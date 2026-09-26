import ar from '../../messages/ar.json';
import en from '../../messages/en.json';
import type { Locale } from './routing';

/**
 * Arabic is the reference catalogue. Typing both as `typeof ar` makes a key missing from the
 * English catalogue a type error; messages.test.ts also rejects extra or empty keys.
 */
export const catalogues: Record<Locale, typeof ar> = { ar, en };
