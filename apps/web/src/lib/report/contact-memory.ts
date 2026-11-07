import type { ReportContact } from '@sbn/report/model';
import { errorFields, log } from '@/lib/log';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import { parseContact } from './contact';

/**
 * The name and the phone of the last PDF download, kept in the account's own user data so the form is
 * filled the next time (D-349). The email is the account's. Only the signed-in user reads or writes it;
 * a value that no longer passes the checks of the form is ignored.
 */

const NAME_KEY = 'report_contact_name';
const PHONE_KEY = 'report_contact_phone';

/** The saved name and phone of the signed-in user, or empty strings. */
export async function savedContact(
  supabase: SupabaseServerClient,
): Promise<Pick<ReportContact, 'name' | 'phone'>> {
  const empty = { name: '', phone: '' };
  try {
    const { data } = await supabase.auth.getUser();
    const metadata = data.user?.user_metadata;
    const form = new FormData();
    for (const [field, key] of [
      ['contact_name', NAME_KEY],
      ['contact_phone', PHONE_KEY],
    ] as const) {
      const value: unknown = metadata?.[key];
      if (typeof value === 'string') form.set(field, value);
    }
    const contact = parseContact(form);
    return contact === null ? empty : { name: contact.name, phone: contact.phone };
  } catch (error) {
    await log.warn('report_contact.read_failed', errorFields(error));
    return empty;
  }
}

/**
 * Keeps the name and the phone of a download that gave both. A failure is logged and never stops the
 * download: the file matters more than the memory of the form.
 */
export async function saveContact(
  supabase: SupabaseServerClient,
  contact: ReportContact,
): Promise<void> {
  if (contact.name === '' || contact.phone === '') return;
  try {
    const { error } = await supabase.auth.updateUser({
      data: { [NAME_KEY]: contact.name, [PHONE_KEY]: contact.phone },
    });
    if (error) throw error;
  } catch (error) {
    await log.warn('report_contact.save_failed', errorFields(error));
  }
}
