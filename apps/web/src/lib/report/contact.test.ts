import { buildReportModel } from '@sbn/report/model';
import { goldenReportInput } from '@sbn/report/testing/inputs';
import { describe, expect, it } from 'vitest';
import type { ReportPage } from './load';
import { hasContact, parseContact, withContact } from './contact';

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

describe('parseContact (D-346)', () => {
  it('takes nothing as an empty contact', () => {
    expect(parseContact(form({}))).toEqual({ name: '', email: '', phone: '' });
    expect(hasContact({ name: '', email: '', phone: '' })).toBe(false);
  });

  it('cleans a name, an email and a phone', () => {
    expect(
      parseContact(
        form({
          contact_name: '  ليث   حمودة ',
          contact_email: ' founder@example.test ',
          contact_phone: '+٩٦٢ ٧٩ ٠٠٠ ٠٠٠٠',
        }),
      ),
    ).toEqual({ name: 'ليث حمودة', email: 'founder@example.test', phone: '+962 79 000 0000' });
  });

  it('accepts one field alone', () => {
    expect(parseContact(form({ contact_phone: '0790000000' }))).toEqual({
      name: '',
      email: '',
      phone: '0790000000',
    });
  });

  it('refuses a value that is typed and is not valid', () => {
    expect(parseContact(form({ contact_email: 'not an email' }))).toBeNull();
    expect(parseContact(form({ contact_email: 'a@b' }))).toBeNull();
    expect(parseContact(form({ contact_phone: 'call me' }))).toBeNull();
    expect(parseContact(form({ contact_phone: '12' }))).toBeNull();
    expect(parseContact(form({ contact_name: 'x'.repeat(121) }))).toBeNull();
    expect(parseContact(form({ contact_name: 'line\u0000break' }))).toBeNull();
  });

  it('keeps what only looks like markup as text: the cover escapes it', () => {
    expect(parseContact(form({ contact_name: '<b>x</b>' }))?.name).toBe('<b>x</b>');
  });
});

describe('withContact', () => {
  const model = buildReportModel(goldenReportInput('jo-service-subscription', { locale: 'ar' }));
  const ready: ReportPage = { status: 'ready', model, notice: null, version: null };
  const contact = { name: 'A', email: '', phone: '' };

  it('puts the contact on the metadata of a ready report', () => {
    const page = withContact(ready, contact);
    expect(page?.status === 'ready' ? page.model.meta.contact : null).toEqual(contact);
    expect(model.meta.contact).toBeUndefined();
  });

  it('leaves the page as it was without a contact, and any page that is not a report', () => {
    expect(withContact(ready, { name: '', email: '', phone: '' })).toBe(ready);
    expect(withContact(null, contact)).toBeNull();
    const none: ReportPage = { status: 'none', percent: 10, missing: [] };
    expect(withContact(none, contact)).toBe(none);
  });
});
