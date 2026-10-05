import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { type NamespacePath, ROOT_NAMESPACES, pickMessages } from './client-messages';
import { catalogues } from './messages';

describe('pickMessages', () => {
  const ar = catalogues.ar;

  it('keeps only the namespaces asked for', () => {
    expect(pickMessages(ar, ['common', 'theme'])).toEqual({ common: ar.common, theme: ar.theme });
  });

  it('keeps one part of a namespace, alone or next to the whole namespace', () => {
    expect(pickMessages(ar, ['auth.errors'])).toEqual({ auth: { errors: ar.auth.errors } });
    expect(pickMessages(ar, ['auth.errors', 'auth'])).toEqual({ auth: ar.auth });
    expect(pickMessages(ar, ['auth', 'auth.errors'])).toEqual({ auth: ar.auth });
  });

  it('never changes the catalogue', () => {
    const before = JSON.stringify(catalogues);
    pickMessages(ar, ['diagnostic.widgets', 'diagnostic', 'auth.errors']);
    expect(JSON.stringify(catalogues)).toBe(before);
  });

  it('fails on a namespace the catalogue does not have', () => {
    expect(() => pickMessages(ar, ['nowhere' as NamespacePath])).toThrow('nowhere');
  });

  it('sends far less than the whole catalogue with every page', () => {
    const root = JSON.stringify(pickMessages(ar, ROOT_NAMESPACES)).length;
    expect(root).toBeLessThan(JSON.stringify(ar).length / 5);
  });
});

// -----------------------------------------------------------------------------------------------
// Every client component gets the namespaces it reads (PERF-8). A client component that reads a
// namespace its provider lacks shows the message key instead of the text, and no type or build
// check notices. This reads the source: for each page, layout and boundary, the client components
// it renders (following imports from 'use client' files, but not into 'use server' files), the
// namespaces their useTranslations() calls name, and the namespaces given to it: the root ones
// plus those of every <ClientMessages namespaces={[…]}> in the file and the layouts above it.
// -----------------------------------------------------------------------------------------------

const SRC = fileURLToPath(new URL('..', import.meta.url));
const APP = join(SRC, 'app');

interface Module {
  directive: 'client' | 'server' | null;
  imports: string[];
  reads: string[];
  gives: string[];
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !name.includes('.test.') ? [path] : [];
  });
}

function resolveImport(from: string, specifier: string): string | null {
  const base = specifier.startsWith('@/')
    ? join(SRC, specifier.slice(2))
    : specifier.startsWith('.')
      ? resolve(dirname(from), specifier)
      : null;
  if (!base) return null;
  const found = ['', '.ts', '.tsx', '/index.ts', '/index.tsx']
    .map((extension) => base + extension)
    .find((path) => existsSync(path) && statSync(path).isFile());
  return found ?? null;
}

function readModule(path: string): Module {
  const source = readFileSync(path, 'utf8');
  const start = source.trimStart();
  const directive = start.startsWith("'use client'")
    ? 'client'
    : start.startsWith("'use server'")
      ? 'server'
      : null;
  const imports: string[] = [];
  for (const [, typeOnly, clause = '', specifier = ''] of source.matchAll(
    /(?:import|export)\s+(type\s+)?([^'";]*?)\s*from\s*'([^']+)'/g,
  )) {
    const names = /^\{([^}]*)\}$/.exec(clause.trim())?.[1]?.split(',') ?? [];
    const onlyTypes =
      names.length > 0 && names.every((name) => !name.trim() || name.trim().startsWith('type '));
    if (typeOnly || onlyTypes) continue;
    const target = resolveImport(path, specifier);
    if (target) imports.push(target);
  }
  const reads = [...source.matchAll(/useTranslations\(\s*'([^']+)'\s*\)/g)].map(
    ([, namespace = '']) => namespace,
  );
  if (/useTranslations\(\s*\)|useTranslations\(\s*[^'\s)]/.test(source)) reads.push('(all)');
  const gives = [...source.matchAll(/<ClientMessages\s+namespaces=\{\[([^\]]*)\]\}/g)].flatMap(
    ([, list = '']) => [...list.matchAll(/'([^']+)'/g)].map(([, namespace = '']) => namespace),
  );
  return { directive, imports, reads, gives };
}

const modules = new Map(sourceFiles(SRC).map((path) => [path, readModule(path)]));

function moduleAt(path: string): Module {
  const found = modules.get(path);
  if (!found) throw new Error(`Not a source file: ${path}`);
  return found;
}

/** The namespaces read by the client components `entry` renders, with where each is read. */
function clientReads(entry: string): Map<string, string> {
  const reads = new Map<string, string>();
  const seen = new Set<string>();
  const visit = (path: string, inClient: boolean) => {
    if (seen.has(`${path}:${String(inClient)}`)) return;
    seen.add(`${path}:${String(inClient)}`);
    const found = moduleAt(path);
    if (found.directive === 'server') return;
    const client = inClient || found.directive === 'client';
    if (client) for (const namespace of found.reads) reads.set(namespace, relative(SRC, path));
    for (const target of found.imports) visit(target, client);
  };
  visit(entry, false);
  return reads;
}

/** The layouts that wrap a route file: its own directory's and every one above it. */
function layoutsAbove(path: string): string[] {
  const layouts: string[] = [];
  for (let dir = dirname(path); dir.startsWith(APP); dir = dirname(dir)) {
    const layout = join(dir, 'layout.tsx');
    if (layout !== path && modules.has(layout)) layouts.push(layout);
  }
  return layouts;
}

function covered(namespace: string, given: readonly string[]): boolean {
  return given.some((path) => namespace === path || namespace.startsWith(`${path}.`));
}

const ROUTE_FILES = [...modules.keys()].filter((path) =>
  /[\\/](page|layout|error|not-found|default)\.tsx$/.test(path),
);

describe('client components and their messages (PERF-8)', () => {
  it('finds the route files and the client components that read messages', () => {
    expect(ROUTE_FILES.length).toBeGreaterThan(20);
    const stepPage = ROUTE_FILES.find((path) => path.includes('[step]'));
    expect(stepPage && [...clientReads(stepPage).keys()]).toContain('diagnostic.widgets');
  });

  it.each(ROUTE_FILES.map((path) => [relative(APP, path), path]))(
    '%s gives its client components every namespace they read',
    (_name, path) => {
      const given = [
        ...ROOT_NAMESPACES,
        ...[path, ...layoutsAbove(path)].flatMap((file) => moduleAt(file).gives),
      ];
      const missing = [...clientReads(path)]
        .filter(([namespace]) => !covered(namespace, given))
        .map(([namespace, where]) => `${namespace} (read in ${where})`);
      expect(missing, 'wrap the component in <ClientMessages namespaces={[…]}>').toEqual([]);
    },
  );
});
