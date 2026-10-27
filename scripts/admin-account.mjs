// Makes an account an admin, or rescues one who lost the phone (M7 step 8, D-327). There is no
// recovery code in the app: whoever holds the service role key does this from here, and the
// admin area is never reachable without a fresh authenticator code afterwards.
//
//   SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/admin-account.mjs add you@example.com
//   SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/admin-account.mjs reset-mfa you@example.com
//
// add        lists the account as an admin. The account must have signed in once.
// reset-mfa  removes every authenticator of the account, so the next visit to the admin area sets
//            up a new one. It does not remove the admin right.
// remove     removes the admin right.
//
// Run it against production only with the owner's go-ahead.
const [command, email] = process.argv.slice(2);
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

if (!['add', 'reset-mfa', 'remove'].includes(command ?? '') || !email) {
  console.error('usage: admin-account.mjs <add|reset-mfa|remove> <email>');
  process.exit(2);
}
if (!url || !key) {
  console.error('SUPABASE_URL and SUPABASE_SECRET_KEY are required.');
  process.exit(2);
}

const headers = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };

/** The id of the account with this address, looking through the user list a page at a time. */
async function userIdOf(address) {
  for (let page = 1; page <= 50; page += 1) {
    const response = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=200`, {
      headers,
    });
    if (!response.ok) fail(`The accounts could not be listed (HTTP ${response.status}).`);
    const { users } = await response.json();
    const match = users.find((user) => user.email?.toLowerCase() === address.toLowerCase());
    if (match) return match.id;
    if (users.length < 200) break;
  }
  return fail('No account has this address.');
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const userId = await userIdOf(email);

if (command === 'add') {
  const response = await fetch(`${url}/rest/v1/admins`, {
    method: 'POST',
    headers: { ...headers, prefer: 'resolution=ignore-duplicates' },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!response.ok) fail(`The admin was not added (HTTP ${response.status}).`);
  console.log('The account is an admin. It sets up its authenticator at /admin/mfa.');
} else if (command === 'remove') {
  const response = await fetch(`${url}/rest/v1/admins?user_id=eq.${userId}`, {
    method: 'DELETE',
    headers,
  });
  if (!response.ok) fail(`The admin was not removed (HTTP ${response.status}).`);
  console.log('The account is no longer an admin.');
} else {
  const list = await fetch(`${url}/auth/v1/admin/users/${userId}/factors`, { headers });
  if (!list.ok) fail(`The authenticators could not be listed (HTTP ${list.status}).`);
  const factors = await list.json();
  for (const factor of factors) {
    const removal = await fetch(`${url}/auth/v1/admin/users/${userId}/factors/${factor.id}`, {
      method: 'DELETE',
      headers,
    });
    if (!removal.ok) fail(`An authenticator was not removed (HTTP ${removal.status}).`);
  }
  console.log(`Removed ${factors.length} authenticator(s). The next visit sets up a new one.`);
}
