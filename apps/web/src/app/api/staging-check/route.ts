// Temporary, on the throwaway staging-check branch only: says whether each Paddle variable is
// present and well formed, and never returns a value.
export const dynamic = 'force-dynamic';

function check(name: string, pattern: RegExp) {
  const value = process.env[name];
  return {
    present: value !== undefined,
    length: value?.length ?? 0,
    whitespace: value !== undefined && value !== value.trim(),
    matches: value !== undefined && pattern.test(value),
  };
}

/** Kind of key, never the key: the fixed prefix, the length, and for a legacy JWT its role and project. */
function secretKeyShape() {
  const value = process.env.SUPABASE_SECRET_KEY;
  if (value === undefined) return { present: false };
  const shape: Record<string, unknown> = {
    present: true,
    length: value.length,
    whitespace: value !== value.trim(),
    quoted: /^["'].*["']$/.test(value.trim()),
    prefix: value.startsWith('sb_secret_')
      ? 'sb_secret_'
      : value.startsWith('sb_publishable_')
        ? 'sb_publishable_'
        : value.startsWith('eyJ')
          ? 'jwt'
          : 'other',
  };
  if (value.startsWith('eyJ')) {
    try {
      const payload = JSON.parse(Buffer.from(value.split('.')[1] ?? '', 'base64url').toString());
      shape.role = payload.role;
      shape.ref = payload.ref;
    } catch {
      shape.role = 'unreadable';
    }
  }
  return shape;
}

export function GET() {
  const price = /^pri_[a-z0-9]{1,60}$/;
  return Response.json({
    PADDLE_CLIENT_TOKEN: {
      ...check('PADDLE_CLIENT_TOKEN', /^(test|live)_[A-Za-z0-9]{1,100}$/),
      prefix: (process.env.PADDLE_CLIENT_TOKEN ?? '').slice(0, 5),
    },
    PADDLE_PRICE_STRATEGIST: check('PADDLE_PRICE_STRATEGIST', price),
    PADDLE_PRICE_COMMANDER: check('PADDLE_PRICE_COMMANDER', price),
    PADDLE_PRICE_UPGRADE: check('PADDLE_PRICE_UPGRADE', price),
    PADDLE_WEBHOOK_SECRET: { present: process.env.PADDLE_WEBHOOK_SECRET !== undefined },
    SUPABASE_SECRET_KEY: secretKeyShape(),
    NEXT_PUBLIC_SUPABASE_URL_host: (() => {
      try {
        return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname;
      } catch {
        return null;
      }
    })(),
    vercelEnv: process.env.VERCEL_ENV ?? null,
  });
}
