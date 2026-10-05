import type { Instrumentation } from 'next';
import { errorFields, log } from '@/lib/log';

function digestOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('digest' in error)) return undefined;
  return typeof error.digest === 'string' ? error.digest : undefined;
}

/**
 * Every uncaught server error, logged with the digest the error pages show as a reference number,
 * so a founder's report leads to the line (OBS-1). Only the route template, the error's class and
 * code are written, never its message or the address (lib/log.ts).
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const requestId = request.headers['x-vercel-id'];
  await log.error('request.failed', {
    ...errorFields(error),
    digest: digestOf(error),
    route: context.routePath,
    stage: context.routeType,
    requestId: typeof requestId === 'string' ? requestId : undefined,
  });
};
