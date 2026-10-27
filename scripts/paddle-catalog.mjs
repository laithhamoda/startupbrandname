// Creates the Paddle catalog of the packages (D-313, D-317, D-322): four products, each with one
// one-time USD price, in the sandbox or the live account. Safe to run again: a product it made
// before (found by custom_data.sbn_offer) is reused, never duplicated, and a price whose amount
// differs from the plan table is reported, never changed.
//
//   PADDLE_API_KEY=pdl_sdbx_apikey_... node scripts/paddle-catalog.mjs --dry-run
//   PADDLE_API_KEY=pdl_sdbx_apikey_... node scripts/paddle-catalog.mjs
//
// The key needs the product.read, product.write, price.read and price.write permissions. It is
// read from the environment only, never printed, and never written to a file. The script prints
// the variables to set in Vercel (Preview for the sandbox, Production for live).

import { pathToFileURL } from 'node:url';

const SITE = 'https://startupbrandname.com';

/** Square brand image, served over HTTPS, as Paddle asks for product images. */
export const PRODUCT_IMAGE = `${SITE}/icon-512.png`;

/**
 * The offers, from config/plans.ts (D-313): the two packages, the move from «استراتيجي» to
 * «قائد» at the difference, and the mentor pack (D-322). Amounts in US cents. `env` names the Vercel variable of the price.
 */
export const OFFERS = [
  {
    offer: 'strategist',
    legacyOffer: 'standard',
    plan: 'strategist',
    env: 'PADDLE_PRICE_STRATEGIST',
    amountCents: 1000,
    productName: 'استراتيجي · Strategist',
    productDescription:
      'Startup Brand Name: a 40-question business diagnostic and the numbers report (pricing, break-even, 12-month projection, cash, legal path), with 10 AI mentor messages per project, for one project over 12 months. / تشخيص من 40 سؤالًا وتقرير الأرقام: التسعير والتعادل وتوقعات 12 شهرًا والنقد والمسار القانوني، مع 10 رسائل للمرشد الذكي لكل مشروع، لمشروع واحد لمدة 12 شهرًا.',
    priceName: 'One payment · 12 months · دفعة واحدة لمدة 12 شهرًا',
  },
  {
    offer: 'commander',
    legacyOffer: 'adventurer',
    plan: 'commander',
    env: 'PADDLE_PRICE_COMMANDER',
    amountCents: 3000,
    productName: 'قائد · Commander',
    productDescription:
      'Startup Brand Name: the full 64-question business diagnostic and the full report (business model canvases, scenarios, validation plan), with 64 AI mentor messages per project, for one project over 12 months. / التشخيص الكامل من 64 سؤالًا والتقرير الكامل: لوحات نموذج العمل والسيناريوهات وخطة التحقق، مع 64 رسالة للمرشد الذكي لكل مشروع، لمشروع واحد لمدة 12 شهرًا.',
    priceName: 'One payment · 12 months · دفعة واحدة لمدة 12 شهرًا',
  },
  {
    offer: 'upgrade',
    plan: 'commander',
    env: 'PADDLE_PRICE_UPGRADE',
    amountCents: 2000,
    productName: 'ترقية إلى قائد · Upgrade to Commander',
    productDescription:
      'Startup Brand Name: moves a project with the Strategist package to the Commander package for the difference in price. / ترقية مشروع لديه باقة «استراتيجي» إلى باقة «قائد» بدفع فرق السعر فقط.',
    priceName: 'Upgrade · one payment · ترقية بدفعة واحدة',
  },
  {
    offer: 'mentor_pack',
    plan: 'mentor_pack',
    env: 'PADDLE_PRICE_MENTOR_PACK',
    amountCents: 700,
    productName: 'باقة المرشد الذكي · Mentor pack',
    productDescription:
      'Startup Brand Name: 10 more AI mentor messages for one project, free or paid. / 10 رسائل إضافية مع المرشد الذكي لمشروع واحد، مجاني أو مدفوع.',
    priceName: 'One payment · دفعة واحدة',
  },
];

/** Bumped when the catalog's shape changes, so a later run can tell old products apart. */
export const CATALOG_VERSION = 1;

/** The account a key belongs to, from its documented prefix; null for anything else. */
export function accountOfKey(key) {
  if (typeof key !== 'string' || key.length !== 69) return null;
  if (key.startsWith('pdl_sdbx_apikey_')) {
    return { name: 'sandbox', baseUrl: 'https://sandbox-api.paddle.com', vercel: 'Preview' };
  }
  if (key.startsWith('pdl_live_apikey_')) {
    return { name: 'live', baseUrl: 'https://api.paddle.com', vercel: 'Production' };
  }
  return null;
}

/**
 * The product body. `standard` is the digital-goods category every Paddle account has enabled;
 * the image is the brand's square icon.
 */
export function productBody(offer) {
  return {
    name: offer.productName,
    description: offer.productDescription,
    tax_category: 'standard',
    image_url: PRODUCT_IMAGE,
    custom_data: { sbn_offer: offer.offer, sbn_plan: offer.plan, sbn_catalog: CATALOG_VERSION },
  };
}

/**
 * The price body: one-time (no billing cycle, no trial), in USD only as CLAUDE.md §3 requires,
 * tax included so the buyer pays the price shown on our pricing page in every country, and one
 * unit per checkout.
 */
export function priceBody(offer, productId) {
  return {
    product_id: productId,
    description: `${offer.offer}: ${offer.plan} package, one-time, catalog v${CATALOG_VERSION}`,
    name: offer.priceName,
    unit_price: { amount: String(offer.amountCents), currency_code: 'USD' },
    billing_cycle: null,
    trial_period: null,
    tax_mode: 'internal',
    quantity: { minimum: 1, maximum: 1 },
    custom_data: { sbn_offer: offer.offer, sbn_plan: offer.plan, sbn_catalog: CATALOG_VERSION },
  };
}

/** Whether a product shows another name or description than the offer, or the old offer key. */
export function needsRename(product, offer) {
  return (
    product.name !== offer.productName ||
    product.description !== offer.productDescription ||
    product.custom_data?.sbn_offer !== offer.offer ||
    product.custom_data?.sbn_plan !== offer.plan
  );
}

/** The active price of a product that sells this offer as planned, or a reason it does not. */
export function matchingPrice(product, offer) {
  const prices = (product.prices ?? []).filter((price) => price.status === 'active');
  const same = prices.find(
    (price) =>
      price.billing_cycle === null &&
      price.unit_price?.currency_code === 'USD' &&
      price.unit_price?.amount === String(offer.amountCents),
  );
  if (same) return { status: 'ok', price: same };
  return prices.length === 0 ? { status: 'missing' } : { status: 'different', prices };
}

async function paddle(account, key, method, path, body) {
  const response = await fetch(`${account.baseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = json.error ? `${json.error.code}: ${json.error.detail}` : response.statusText;
    throw new Error(`${method} ${path} failed (${response.status}) ${detail}`);
  }
  return json;
}

async function listProducts(account, key) {
  const products = [];
  let path = '/products?status=active&include=prices&per_page=200';
  for (;;) {
    const page = await paddle(account, key, 'GET', path);
    products.push(...page.data);
    if (!page.meta?.pagination?.has_more) return products;
    const next = new URL(page.meta.pagination.next);
    path = `${next.pathname}${next.search}`;
  }
}

export async function run({ key, dryRun, log = console.log }) {
  const account = accountOfKey(key);
  if (!account) {
    throw new Error(
      'PADDLE_API_KEY must be a Paddle API key (pdl_sdbx_apikey_... or pdl_live_apikey_...).',
    );
  }
  log(`Paddle ${account.name} account${dryRun ? ' (dry run: nothing is created)' : ''}`);

  const existing = await listProducts(account, key);
  const env = {};
  let problems = 0;

  for (const offer of OFFERS) {
    // A product made before the packages were renamed (D-318) carries the old offer key.
    let product = existing.find((item) =>
      [offer.offer, offer.legacyOffer].filter(Boolean).includes(item.custom_data?.sbn_offer),
    );
    if (product && needsRename(product, offer)) {
      if (dryRun) {
        log(`- ${offer.offer}: would rename product ${product.id} to «${offer.productName}»`);
      } else {
        await paddle(account, key, 'PATCH', `/products/${product.id}`, productBody(offer));
        log(`- ${offer.offer}: renamed product ${product.id} to «${offer.productName}»`);
      }
    }
    if (!product) {
      if (dryRun) {
        log(
          `- ${offer.offer}: would create the product and a ${offer.amountCents / 100} USD price`,
        );
        continue;
      }
      product = (await paddle(account, key, 'POST', '/products', productBody(offer))).data;
      product.prices = [];
      log(`- ${offer.offer}: created product ${product.id}`);
    } else {
      log(`- ${offer.offer}: found product ${product.id}`);
    }

    const match = matchingPrice(product, offer);
    if (match.status === 'ok') {
      env[offer.env] = match.price.id;
      log(`  price ${match.price.id} (${offer.amountCents / 100} USD) is in place`);
    } else if (match.status === 'different') {
      problems += 1;
      log(
        `  STOP: the product has active prices that are not one-time ${offer.amountCents / 100} USD: ` +
          match.prices.map((price) => price.id).join(', ') +
          '. Archive them in the dashboard, then run again.',
      );
    } else if (dryRun) {
      log(`  would create a ${offer.amountCents / 100} USD one-time price`);
    } else {
      const price = (await paddle(account, key, 'POST', '/prices', priceBody(offer, product.id)))
        .data;
      env[offer.env] = price.id;
      log(`  created price ${price.id} (${offer.amountCents / 100} USD)`);
    }
  }

  if (!dryRun && problems === 0) {
    log('');
    log(`Set these in Vercel -> Settings -> Environment Variables -> ${account.vercel}:`);
    for (const offer of OFFERS) log(`${offer.env}=${env[offer.env]}`);
    log('PADDLE_CLIENT_TOKEN=<the client-side token from Developer tools -> Authentication>');
  }
  return { account: account.name, env, problems };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  run({ key: process.env.PADDLE_API_KEY, dryRun: process.argv.includes('--dry-run') })
    .then(({ problems }) => {
      process.exitCode = problems > 0 ? 1 : 0;
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
