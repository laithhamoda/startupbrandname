// Fails when a Playwright container image in the workflows is not the release of @playwright/test in
// apps/web/package.json. The RTL snapshots are taken and compared inside that image (D-055), so the
// browsers and the test runner must come from the same release; a Dependabot bump of the package
// alone fails here until the image tag and digest are updated too (D-142).
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const IMAGE = /mcr\.microsoft\.com\/playwright:v([^\s@-]+)/g;

/** The Playwright image versions named in a workflow file, with their 1-based line numbers. */
export function findPlaywrightImages(text) {
  return text
    .split('\n')
    .flatMap((line, index) =>
      [...line.matchAll(IMAGE)].map((match) => ({ version: match[1], line: index + 1 })),
    );
}

/**
 * Compares every image with the pinned package version. `files` maps a path to its contents.
 * Returns the problems found; an empty list means the versions agree.
 */
export function checkPlaywrightImages(packageVersion, files) {
  if (!packageVersion || !/^\d+\.\d+\.\d+$/.test(packageVersion)) {
    return [
      `apps/web/package.json: @playwright/test must be pinned to an exact version, found "${String(packageVersion)}".`,
    ];
  }
  const problems = [];
  let images = 0;
  for (const [path, text] of Object.entries(files)) {
    for (const { version, line } of findPlaywrightImages(text)) {
      images += 1;
      if (version !== packageVersion) {
        problems.push(
          `${path}:${line}  image v${version}, but @playwright/test is ${packageVersion}. Use the v${packageVersion} image and its digest.`,
        );
      }
    }
  }
  if (images === 0) problems.push('No Playwright image found in .github/workflows.');
  return problems;
}

async function main() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const manifest = JSON.parse(await readFile(join(root, 'apps', 'web', 'package.json'), 'utf8'));
  const workflows = join(root, '.github', 'workflows');
  const files = {};
  for (const name of await readdir(workflows)) {
    if (!/\.ya?ml$/.test(name)) continue;
    const path = join(workflows, name);
    files[relative(root, path)] = await readFile(path, 'utf8');
  }

  const version = manifest.devDependencies?.['@playwright/test'];
  const problems = checkPlaywrightImages(version, files);
  if (problems.length > 0) {
    console.error('The Playwright image and @playwright/test differ:');
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
  console.log(`Playwright image check passed (${version}).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
