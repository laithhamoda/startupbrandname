import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyPaddleSignature } from './signature';

const SECRET = 'pdl_ntfset_test_secret';
const BODY = '{"event_id":"evt_1","event_type":"transaction.completed"}';
const NOW = new Date('2026-10-25T10:00:00Z');
const TS = Math.floor(NOW.getTime() / 1000);

function sign(body: string, ts: number, secret = SECRET): string {
  return createHmac('sha256', secret)
    .update(`${String(ts)}:${body}`)
    .digest('hex');
}

describe('verifyPaddleSignature', () => {
  it('accepts a body signed with the secret', () => {
    expect(verifyPaddleSignature(BODY, `ts=${String(TS)};h1=${sign(BODY, TS)}`, SECRET, NOW)).toBe(
      true,
    );
  });

  it('accepts any of several h1 values while a secret is rotated', () => {
    const header = `ts=${String(TS)};h1=${sign(BODY, TS, 'old_secret')};h1=${sign(BODY, TS)}`;
    expect(verifyPaddleSignature(BODY, header, SECRET, NOW)).toBe(true);
  });

  it('rejects a changed body', () => {
    const header = `ts=${String(TS)};h1=${sign(BODY, TS)}`;
    expect(verifyPaddleSignature(`${BODY} `, header, SECRET, NOW)).toBe(false);
  });

  it('rejects another secret', () => {
    expect(
      verifyPaddleSignature(BODY, `ts=${String(TS)};h1=${sign(BODY, TS, 'other')}`, SECRET, NOW),
    ).toBe(false);
  });

  it('rejects a replay older than the tolerance, and a time far in the future', () => {
    const old = TS - 301;
    expect(
      verifyPaddleSignature(BODY, `ts=${String(old)};h1=${sign(BODY, old)}`, SECRET, NOW),
    ).toBe(false);
    const future = TS + 301;
    expect(
      verifyPaddleSignature(BODY, `ts=${String(future)};h1=${sign(BODY, future)}`, SECRET, NOW),
    ).toBe(false);
    const recent = TS - 299;
    expect(
      verifyPaddleSignature(BODY, `ts=${String(recent)};h1=${sign(BODY, recent)}`, SECRET, NOW),
    ).toBe(true);
  });

  it('rejects a timestamp that is not the signed one', () => {
    expect(
      verifyPaddleSignature(BODY, `ts=${String(TS - 1)};h1=${sign(BODY, TS)}`, SECRET, NOW),
    ).toBe(false);
  });

  it.each([
    ['a missing header', null],
    ['an empty header', ''],
    ['no timestamp', `h1=${sign(BODY, TS)}`],
    ['no hash', `ts=${String(TS)}`],
    ['a malformed timestamp', `ts=abc;h1=${sign(BODY, TS)}`],
    ['a malformed hash', `ts=${String(TS)};h1=xyz`],
    ['a short hash', `ts=${String(TS)};h1=${sign(BODY, TS).slice(0, 62)}`],
    ['parts without a value', `ts;h1`],
  ])('rejects %s', (_label, header) => {
    expect(verifyPaddleSignature(BODY, header, SECRET, NOW)).toBe(false);
  });

  it('rejects everything when the secret is empty', () => {
    expect(verifyPaddleSignature(BODY, `ts=${String(TS)};h1=${sign(BODY, TS, '')}`, '', NOW)).toBe(
      false,
    );
  });
});
