// Issues a batch of VIVA vouchers and writes the codes to a CSV file (M7 step 6, D-325), until the
// admin area (step 8) can do it. The codes are never printed, so they stay out of terminal history
// and logs; the file is the only copy outside the database.
//
//   SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/issue-vouchers.mjs \
//     course_12m 50 ./course-batch.csv "Course, October 2026" [affiliate-id]
//
// The affiliate id comes from scripts/add-affiliate.mjs; every activated code then earns that
// affiliate a commission (D-326).
//
// Run it against production only with the owner's go-ahead ("migrate production" covers the
// schema, not the data).
import { existsSync, writeFileSync } from 'node:fs';

const [type, countText, file, note, affiliate] = process.argv.slice(2);
const count = Number(countText);

if (!type || !Number.isInteger(count) || count < 1 || count > 1000 || !file) {
  console.error(
    'usage: issue-vouchers.mjs <type> <count 1-1000> <output.csv> [note] [affiliate-id]',
  );
  process.exit(2);
}
if (existsSync(file)) {
  console.error(`${file} already exists; choose a new file so no batch is overwritten.`);
  process.exit(2);
}
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL and SUPABASE_SECRET_KEY are required.');
  process.exit(2);
}

const response = await fetch(`${url}/rest/v1/rpc/issue_voucher_batch`, {
  method: 'POST',
  headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' },
  body: JSON.stringify({
    p_type: type,
    p_count: count,
    p_note: note ?? null,
    p_affiliate: affiliate ?? null,
  }),
});
if (!response.ok) {
  console.error(`The batch was not issued (HTTP ${response.status}).`);
  process.exit(1);
}
const data = await response.json();

writeFileSync(file, `code\n${data.join('\n')}\n`, { flag: 'wx', mode: 0o600 });
console.log(`Issued ${data.length} ${type} codes to ${file}.`);
