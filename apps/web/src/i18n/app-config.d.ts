import type ar from '../../messages/ar.json';
import type { routing } from './routing';

// Typed locales and message keys for next-intl: a wrong key in t('…') fails the typecheck.
declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof ar;
  }
}
