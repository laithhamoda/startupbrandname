// Adds an affiliate (M7 step 7, D-326), until the admin area (step 8) can do it. The commission is
// a fixed amount in US cents for each activated code of the affiliate's batches. Prints the
// affiliate id; pass it to the batch when issuing codes.
//
//   SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/add-affiliate.mjs "Viva Rise" 250 [user-id]
//
// Run it against production only with the owner's go-ahead.
const [name, centsText, userId] = process.argv.slice(2);
const cents = Number(centsText);

if (!name || !Number.isInteger(cents) || cents < 1 || cents > 999999) {
  console.error('usage: add-affiliate.mjs <name> <commission in US cents, 1-999999> [user-id]');
  process.exit(2);
}
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL and SUPABASE_SECRET_KEY are required.');
  process.exit(2);
}

const response = await fetch(`${url}/rest/v1/rpc/create_affiliate`, {
  method: 'POST',
  headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' },
  body: JSON.stringify({ p_name: name, p_amount_usd_cents: cents, p_user: userId ?? null }),
});
if (!response.ok) {
  console.error(`The affiliate was not added (HTTP ${response.status}).`);
  process.exit(1);
}
console.log(`Affiliate id: ${await response.json()}`);
