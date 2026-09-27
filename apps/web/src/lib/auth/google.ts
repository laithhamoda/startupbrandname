import 'server-only';
import { z } from 'zod';
import { getClientEnv } from '@/env/client';
import { getServerEnv } from '@/env/server';

/** How long a Supabase answer is reused before asking again. */
const SETTINGS_TTL_SECONDS = 60;
const SETTINGS_TIMEOUT_MS = 2_000;

const authSettingsSchema = z.object({ external: z.object({ google: z.boolean() }) });

/** Reads Supabase's public auth settings. Anything unexpected counts as "Google is off". */
export function googleEnabledIn(settings: unknown): boolean {
  const parsed = authSettingsSchema.safeParse(settings);
  return parsed.success && parsed.data.external.google;
}

/**
 * Whether to offer "Continue with Google" (D-089): the environment must switch it on
 * (AUTH_GOOGLE_ENABLED) and its Supabase project must really have Google enabled. If Supabase
 * cannot be asked, the button stays hidden: signing in by email still works.
 */
export async function googleSignInAvailable(): Promise<boolean> {
  const env = getServerEnv();
  if (!env.AUTH_GOOGLE_ENABLED) return false;
  if (!env.AUTH_GOOGLE_VERIFY_PROVIDER) return true;

  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key } =
    getClientEnv();
  try {
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      next: { revalidate: SETTINGS_TTL_SECONDS },
      signal: AbortSignal.timeout(SETTINGS_TIMEOUT_MS),
    });
    if (!response.ok) return false;
    return googleEnabledIn(await response.json());
  } catch {
    return false;
  }
}
