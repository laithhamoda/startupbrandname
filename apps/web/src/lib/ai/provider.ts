import 'server-only';
import { getServerEnv, type ServerEnv } from '@/env/server';

export type AiProvider = 'anthropic' | 'fake';

/**
 * The model provider that answers, or null when AI is off (D-123): `AI_PROVIDER=off`, no API key,
 * or the stand-in on production, which never answers real founders. /api/health reports only
 * whether it is on (D-152).
 */
export function activeProvider(
  env: Pick<ServerEnv, 'AI_PROVIDER' | 'ANTHROPIC_API_KEY' | 'VERCEL_ENV'> = getServerEnv(),
): AiProvider | null {
  if (env.AI_PROVIDER === 'off') return null;
  if (env.AI_PROVIDER === 'fake') return env.VERCEL_ENV === 'production' ? null : 'fake';
  return env.ANTHROPIC_API_KEY ? 'anthropic' : null;
}
