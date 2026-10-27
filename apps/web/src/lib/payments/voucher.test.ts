import { describe, expect, it } from 'vitest';
import { clientAddress, networkHash, outcomeOf, voucherCodeSchema } from './voucher';

const headers = (values: Record<string, string>) => new Headers(values);

describe('outcomeOf', () => {
  it.each(['activated', 'invalid', 'locked', 'in_use'])('passes %s through', (answer) => {
    expect(outcomeOf(answer)).toBe(answer);
  });

  it.each([null, undefined, '', 'ok', 'ACTIVATED', 42])('never reads %s as a success', (answer) => {
    expect(outcomeOf(answer)).toBe('error');
  });
});

describe('voucherCodeSchema', () => {
  it('keeps what the person typed for the database to clean', () => {
    expect(voucherCodeSchema.parse(' viva-d908 aeeb ')).toBe(' viva-d908 aeeb ');
  });

  it('bounds the call', () => {
    expect(voucherCodeSchema.safeParse('A'.repeat(65)).success).toBe(false);
    expect(voucherCodeSchema.safeParse(null).success).toBe(false);
  });
});

describe('clientAddress', () => {
  it('prefers x-real-ip', () => {
    expect(
      clientAddress(headers({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '1.1.1.1' })),
    ).toBe('203.0.113.7');
  });

  it('falls back to the first forwarded address', () => {
    expect(clientAddress(headers({ 'x-forwarded-for': '198.51.100.2, 10.0.0.1' }))).toBe(
      '198.51.100.2',
    );
  });

  it('puts an unknown visitor in one shared bucket', () => {
    expect(clientAddress(headers({}))).toBe('unknown');
  });
});

describe('networkHash', () => {
  it('is stable for one address and key, and 64 hex characters', () => {
    expect(networkHash('203.0.113.7', 'k')).toBe(networkHash('203.0.113.7', 'k'));
    expect(networkHash('203.0.113.7', 'k')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('differs by address and by key, and never contains the address', () => {
    expect(networkHash('203.0.113.7', 'k')).not.toBe(networkHash('203.0.113.8', 'k'));
    expect(networkHash('203.0.113.7', 'k')).not.toBe(networkHash('203.0.113.7', 'other'));
    expect(networkHash('203.0.113.7', 'k')).not.toContain('203');
  });
});
