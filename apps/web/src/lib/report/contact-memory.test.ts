import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import { savedContact, saveContact } from './contact-memory';

vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log')>()),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const getUser = vi.fn();
const updateUser = vi.fn();
const client = { auth: { getUser, updateUser } } as unknown as SupabaseServerClient;

beforeEach(() => {
  vi.clearAllMocks();
  updateUser.mockResolvedValue({ error: null });
});

describe('savedContact (D-349)', () => {
  it('reads the name and the phone of the last download', async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          user_metadata: { report_contact_name: 'ليث', report_contact_phone: '+962790000000' },
        },
      },
    });
    expect(await savedContact(client)).toEqual({ name: 'ليث', phone: '+962790000000' });
  });

  it('is empty when nothing was kept, when a value no longer passes, or when the read fails', async () => {
    getUser.mockResolvedValue({ data: { user: { user_metadata: {} } } });
    expect(await savedContact(client)).toEqual({ name: '', phone: '' });

    getUser.mockResolvedValue({
      data: { user: { user_metadata: { report_contact_phone: 'call me' } } },
    });
    expect(await savedContact(client)).toEqual({ name: '', phone: '' });

    getUser.mockRejectedValue(new Error('network'));
    expect(await savedContact(client)).toEqual({ name: '', phone: '' });
  });
});

describe('saveContact (D-349)', () => {
  it('keeps a download that gave both the name and the phone, under its own keys', async () => {
    await saveContact(client, { name: 'ليث', email: 'a@b.test', phone: '+962790000000' });
    expect(updateUser).toHaveBeenCalledWith({
      data: { report_contact_name: 'ليث', report_contact_phone: '+962790000000' },
    });
  });

  it('keeps nothing when the name or the phone is missing', async () => {
    await saveContact(client, { name: '', email: '', phone: '+962790000000' });
    await saveContact(client, { name: 'ليث', email: '', phone: '' });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('never throws: a failed save is only logged', async () => {
    updateUser.mockResolvedValue({ error: new Error('denied') });
    await expect(
      saveContact(client, { name: 'ليث', email: '', phone: '+962790000000' }),
    ).resolves.toBeUndefined();
    updateUser.mockRejectedValue(new Error('network'));
    await expect(
      saveContact(client, { name: 'ليث', email: '', phone: '+962790000000' }),
    ).resolves.toBeUndefined();
  });
});
