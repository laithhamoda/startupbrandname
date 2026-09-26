import { type NextRequest, NextResponse } from 'next/server';
import { localeOfPath, projectsPath, safeNextPath } from '@/lib/auth/next-path';
import { finishSignIn } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Google sends the user back here with a one-time code (PKCE). The code becomes a session, the
 * declarations answered before signup (if any) are recorded, and the user moves on. An account
 * without declarations is sent to the onboarding gate by the signed-in pages (D-065).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get('next'), projectsPath('ar'));
  const locale = localeOfPath(next);
  const failed = NextResponse.redirect(new URL(`/${locale}/login?error=google`, origin));

  const code = searchParams.get('code');
  if (!code) return failed;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return failed;

  return NextResponse.redirect(new URL(await finishSignIn(supabase, locale, next), origin));
}
