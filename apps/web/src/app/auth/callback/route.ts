import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { localeOfPath, projectsPath, safeNextPath } from '@/lib/auth/next-path';
import { finishSignIn } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Google sends the user back here with a one-time code (PKCE). The code becomes a session, the
 * answers given before signup (if any) are recorded, and the user moves on. An account that has
 * not answered them is sent to the onboarding gate by the signed-in pages (D-065).
 * Redirects are relative, so the browser stays on the host it used and keeps the new cookies.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNextPath(searchParams.get('next'), projectsPath('ar'));
  const locale = localeOfPath(next);
  const failed = `/${locale}/login?error=google`;

  const code = searchParams.get('code');
  if (!code) redirect(failed);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) redirect(failed);

  redirect(await finishSignIn(supabase, locale, next));
}
