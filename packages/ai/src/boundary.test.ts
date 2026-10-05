import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Rule 5 is enforced in one module (PRIV-7): model prompts take only text that went through
// deidentify() (the Deidentified type), and only this package holds the SDK, so no other
// workspace can call the API around it (the pnpm linker gives a workspace only what it declares).

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

type Manifest = Partial<Record<string, Record<string, string>>>;

function workspaces(): string[] {
  return [
    '.',
    ...['apps', 'packages'].flatMap((folder) =>
      readdirSync(`${ROOT}${folder}`).map((name) => `${folder}/${name}`),
    ),
  ].filter((workspace) => existsSync(`${ROOT}${workspace}/package.json`));
}

describe('the Anthropic SDK', () => {
  it('is declared by packages/ai alone', () => {
    const declaring = workspaces().filter((workspace) => {
      const manifest = JSON.parse(
        readFileSync(`${ROOT}${workspace}/package.json`, 'utf8'),
      ) as Manifest;
      return FIELDS.some((field) => manifest[field]?.['@anthropic-ai/sdk'] !== undefined);
    });
    expect(declaring).toEqual(['packages/ai']);
  });
});
