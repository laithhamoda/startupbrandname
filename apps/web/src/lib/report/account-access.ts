import 'server-only';
import { getEarlyAccess, getPreviewEmails } from '@/env/server';
import { type Access, accessFor } from '@/lib/entitlements';

/**
 * What the signed-in account may open of the report, from the two temporary switches that stand in
 * for paid plans until M7: the preview list (D-245) and early access (D-290). One place, so no page
 * can read one of them and forget the other. `previewListValid` is false when the preview list is
 * malformed (the caller logs it).
 */
export function accountAccess(email: string | null | undefined): {
  access: Access;
  previewListValid: boolean;
} {
  const preview = getPreviewEmails();
  const access = accessFor(
    { email, planId: null },
    { previewEmails: preview.emails, earlyAccess: getEarlyAccess() },
  );
  return { access, previewListValid: preview.valid };
}
