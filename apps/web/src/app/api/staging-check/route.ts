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
    SUPABASE_SECRET_KEY: { present: process.env.SUPABASE_SECRET_KEY !== undefined },
    vercelEnv: process.env.VERCEL_ENV ?? null,
  });
}
