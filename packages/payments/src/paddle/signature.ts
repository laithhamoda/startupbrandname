import { createHmac, timingSafeEqual } from 'node:crypto';

/** How old a signed request may be, in seconds; older ones are treated as replays. */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * Whether a `Paddle-Signature` header (`ts=<unix seconds>;h1=<hex>`, with one `h1` per active
 * secret while a secret is being rotated) signs this body with this secret: HMAC-SHA256 of
 * `<ts>:<raw body>`, compared in constant time, and the timestamp within the tolerance of `now`.
 */
export function verifyPaddleSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  now: Date = new Date(),
  toleranceSeconds: number = SIGNATURE_TOLERANCE_SECONDS,
): boolean {
  if (!header || secret === '') return false;
  let timestamp: string | null = null;
  const hashes: string[] = [];
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === 'ts') timestamp = value;
    else if (key === 'h1') hashes.push(value);
  }
  if (timestamp === null || !/^\d{1,12}$/.test(timestamp) || hashes.length === 0) return false;

  const age = Math.floor(now.getTime() / 1000) - Number(timestamp);
  if (Math.abs(age) > toleranceSeconds) return false;

  const expected = createHmac('sha256', secret).update(`${timestamp}:${rawBody}`).digest();
  return hashes.some((hash) => {
    if (!/^[0-9a-f]{64}$/i.test(hash)) return false;
    return timingSafeEqual(Buffer.from(hash, 'hex'), expected);
  });
}
