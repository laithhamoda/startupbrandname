// Fails when server-side secrets appear in anything the browser can download (CLAUDE.md rule 7).
// Run after `pnpm build`.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const NEXT_DIR = join(import.meta.dirname, '..', 'apps', 'web', '.next');

// Browser assets, plus prerendered pages and RSC payloads served as-is.
const TARGETS = [
  { dir: join(NEXT_DIR, 'static'), include: () => true },
  { dir: join(NEXT_DIR, 'server', 'app'), include: (file) => /\.(html|rsc|body)$/.test(file) },
];

// Shapes of real key material rather than bare prefixes: client libraries may mention the prefixes.
const PATTERNS = [
  { name: 'Supabase secret key', regex: /sb_secret_[A-Za-z0-9_-]{16,}/ },
  { name: 'Anthropic API key', regex: /sk-ant-[A-Za-z0-9_-]{20,}/ },
];

// Exact values of server-only variables, when they are set in this environment.
const SERVER_ONLY_VARS = [
  'SUPABASE_SECRET_KEY',
  'ANTHROPIC_API_KEY',
  'PAYPAL_CLIENT_SECRET',
  'CRON_SECRET',
  'EMAIL_API_KEY',
];

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

const secretValues = SERVER_ONLY_VARS.map((name) => [name, process.env[name]]).filter(
  ([, value]) => typeof value === 'string' && value.length >= 8,
);

const findings = [];
let scanned = 0;

for (const { dir, include } of TARGETS) {
  try {
    for await (const file of walk(dir)) {
      if (!include(file)) continue;
      scanned += 1;
      const text = await readFile(file, 'utf8');
      for (const { name, regex } of PATTERNS) {
        if (regex.test(text)) findings.push(`${name} pattern in ${file}`);
      }
      for (const [name, value] of secretValues) {
        if (text.includes(value)) findings.push(`value of ${name} in ${file}`);
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

if (scanned === 0) {
  console.error(`No build output under ${NEXT_DIR}. Run \`pnpm build\` first.`);
  process.exit(1);
}

if (findings.length > 0) {
  console.error('Secrets found in client-reachable build output:');
  for (const finding of findings) console.error(`  - ${finding}`);
  process.exit(1);
}

console.log(`Client bundle clean (${scanned} files scanned).`);
