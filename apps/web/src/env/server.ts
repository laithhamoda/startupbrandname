import 'server-only';
import { z } from 'zod';

/** Accepts exactly "true" or "false". `z.coerce.boolean()` would turn "false" into true. */
export const booleanFlag = z.enum(['true', 'false']).transform((value) => value === 'true');

/** Server-only variables. Importing this module from a Client Component fails the build. */
export const serverEnvSchema = z.object({
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  // Kill switch for Algeria, open since 2026-09-26 by the owner's decision (D-068). "false"
  // closes signup for Algerian users without touching existing accounts.
  MARKET_DZ_ENABLED: booleanFlag.default(true),
  // Search indexing stays off until public launch, and always off outside production (D-027, D-054).
  SITE_INDEXABLE: booleanFlag.default(false),
  // Set by Vercel at runtime.
  VERCEL_ENV: z.enum(['production', 'preview', 'development']).optional(),
  VERCEL_REGION: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse(process.env);
}
