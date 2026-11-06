import { site } from '@/config/site';

/**
 * The address Google sends the visitor back to after sign-in (D-340). In production it is always the
 * site's own address, never one read from the request: a forged Host or X-Forwarded-Host header must
 * not choose where a signed-in visitor lands, whatever Supabase's allow list holds. Preview and
 * development read the request, because their address changes with each deployment.
 */
export function siteOriginFor(request: {
  production: boolean;
  host: string | null;
  protocol: string | null;
}): string {
  if (request.production) return site.origin;
  if (!request.host)
    throw new Error('Cannot build the sign-in callback URL without a Host header.');
  return `${request.protocol ?? 'http'}://${request.host}`;
}
