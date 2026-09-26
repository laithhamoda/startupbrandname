import type { ServerEnv } from '@/env/server';
import type { CountryCode } from './countries';

/**
 * Countries where new signups are switched off. The platform is open everywhere (D-066); the only
 * switch today is Algeria's (D-068). Existing accounts are never affected.
 * Enforced by the app before an account is created. A user who calls the database API directly
 * could still declare a closed country; if a country ever has to be closed for legal reasons,
 * move this list into the database so complete_onboarding() enforces it too.
 */
export function closedCountries(env: Pick<ServerEnv, 'MARKET_DZ_ENABLED'>): CountryCode[] {
  return env.MARKET_DZ_ENABLED ? [] : ['DZ'];
}
