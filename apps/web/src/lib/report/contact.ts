import { westernDigits } from '@sbn/question-bank';
import type { ReportContact } from '@sbn/report/model';
import { z } from 'zod';
import type { ReportPage } from './load';

/**
 * The name, the email and the phone the founder asks to print on the cover of the PDF (D-346). They
 * come from the download form, are checked here, go into the report once and are not kept in the
 * account. Each one is optional; one that is typed but not valid stops the download.
 */

export const NAME_MAX = 120;
const EMAIL_MAX = 254;
const emailSchema = z.email().max(EMAIL_MAX);
// A plus sign or a digit first, then digits, spaces, dashes and brackets: 7 to 26 characters.
const PHONE = /^\+?[0-9][0-9 ()-]{5,24}[0-9]$/;

/** Whether a text holds a control character (a line break, a null): none belongs in a name. */
function hasControl(text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

/** The contact of the form, or null when a value that was typed is not a name, email or phone. */
export function parseContact(form: FormData): ReportContact | null {
  const name = field(form, 'contact_name').replace(/\s+/g, ' ').trim();
  const email = field(form, 'contact_email').trim();
  const phone = westernDigits(field(form, 'contact_phone')).replace(/\s+/g, ' ').trim();

  if (name.length > NAME_MAX || hasControl(name)) return null;
  if (email !== '' && !emailSchema.safeParse(email).success) return null;
  if (phone !== '' && !PHONE.test(phone)) return null;
  return { name, email, phone };
}

/** Whether the name or the phone is missing: the full report asks for both (D-348). */
export function missingRequired(contact: ReportContact): boolean {
  return contact.name === '' || contact.phone === '';
}

export function hasContact(contact: ReportContact): boolean {
  return contact.name !== '' || contact.email !== '' || contact.phone !== '';
}

/** The page with the contact on its report's metadata, or the page as it was when there is none. */
export function withContact(page: ReportPage | null, contact: ReportContact): ReportPage | null {
  if (page?.status !== 'ready' || !hasContact(contact)) return page;
  return { ...page, model: { ...page.model, meta: { ...page.model.meta, contact } } };
}
