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
// check notices. This reads the source of every page, layout and boundary, and checks each
// component where the file renders it (its JSX element). Inside a <ClientMessages namespaces={[…]}>
// it gets the root namespaces and those of the innermost one, since a nested provider replaces the
// one above it; outside any, it gets what the layout above gives its {children}, and the root
// layout gives the root ones. What a component reads is what the useTranslations() calls of the
// client components it renders name, following imports from 'use client' files (but not into
// 'use server' files). Only route files may render ClientMessages, so every position is checked.
// -----------------------------------------------------------------------------------------------

const SRC = fileURLToPath(new URL('..', import.meta.url));
const APP = join(SRC, 'app');

interface Wrapper {
  /** Where the <ClientMessages> opening tag starts and its closing tag starts. */
  start: number;
  end: number;
  namespaces: string[];
}

interface Module {
  source: string;
  directive: 'client' | 'server' | null;
  /** Each module imported for its values, with the names it is bound to here. */
  imports: { target: string; names: string[] }[];
  reads: string[];
  wrappers: Wrapper[];
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

/** The local names an import clause binds: `X`, `* as X`, `{ A, B as C }` (type-only skipped). */
function boundNames(clause: string): string[] {
  const named = /\{([^}]*)\}/.exec(clause)?.[1] ?? '';
  const names = clause
    .replace(/\{[^}]*\}/, '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .map((part) => /^\*\s+as\s+(\w+)$/.exec(part)?.[1] ?? part);
  for (const part of named.split(',')) {
    const name = part.trim();
    if (name === '' || name.startsWith('type ')) continue;
    names.push(/\bas\s+(\w+)$/.exec(name)?.[1] ?? name);
  }
  return names;
}

/** The <ClientMessages> elements of a file, nested ones included. */
function wrappersIn(path: string, source: string): Wrapper[] {
  const wrappers: Wrapper[] = [];
  const open: Omit<Wrapper, 'end'>[] = [];
  for (const match of source.matchAll(/<ClientMessages\b([^>]*)>|<\/ClientMessages>/g)) {
    const [tag, attributes = ''] = match;
    if (tag.startsWith('</')) {
      const opened = open.pop();
      if (!opened) throw new Error(`${relative(SRC, path)}: </ClientMessages> without its opening`);
      wrappers.push({ ...opened, end: match.index });
      continue;
    }
    const list = /namespaces=\{\[([^\]]*)\]\}/.exec(attributes)?.[1] ?? '';
    const namespaces = [...list.matchAll(/'([^']+)'/g)].map(([, namespace = '']) => namespace);
    open.push({ start: match.index, namespaces });
  }
  if (open.length > 0) throw new Error(`${relative(SRC, path)}: <ClientMessages> left open`);
  return wrappers;
}

function readModule(path: string): Module {
  const source = readFileSync(path, 'utf8');
  const start = source.trimStart();
  const directive = start.startsWith("'use client'")
    ? 'client'
    : start.startsWith("'use server'")
      ? 'server'
      : null;
  const imports: Module['imports'] = [];
  for (const [statement, typeOnly, clause = '', specifier = ''] of source.matchAll(
    /(?:import|export)\s+(type\s+)?([^'";]*?)\s*from\s*'([^']+)'/g,
  )) {
    const names = /^\{([^}]*)\}$/.exec(clause.trim())?.[1]?.split(',') ?? [];
    const onlyTypes =
      names.length > 0 && names.every((name) => !name.trim() || name.trim().startsWith('type '));
    if (typeOnly || onlyTypes) continue;
    const target = resolveImport(path, specifier);
    // A re-export binds no name here: it is checked as rendered outside any ClientMessages.
    if (target)
      imports.push({ target, names: statement.startsWith('import') ? boundNames(clause) : [] });
  }
  const reads = [...source.matchAll(/useTranslations\(\s*'([^']+)'\s*\)/g)].map(
    ([, namespace = '']) => namespace,
  );
  if (/useTranslations\(\s*\)|useTranslations\(\s*[^'\s)]/.test(source)) reads.push('(all)');
  return { source, directive, imports, reads, wrappers: wrappersIn(path, source) };
}

const modules = new Map(sourceFiles(SRC).map((path) => [path, readModule(path)]));

function moduleAt(path: string): Module {
  const found = modules.get(path);
  if (!found) throw new Error(`Not a source file: ${path}`);
  return found;
}

/**
 * The namespaces read by the client components rendered from `entry`, with where each is read.
 * `inClient`: `entry` is imported from a client component, so it is one too.
 */
function clientReads(entry: string, inClient = false): Map<string, string> {
  const reads = new Map<string, string>();
  const seen = new Set<string>();
  const visit = (path: string, parentIsClient: boolean) => {
    if (seen.has(`${path}:${String(parentIsClient)}`)) return;
    seen.add(`${path}:${String(parentIsClient)}`);
    const found = moduleAt(path);
    if (found.directive === 'server') return;
    const client = parentIsClient || found.directive === 'client';
    if (client) for (const namespace of found.reads) reads.set(namespace, relative(SRC, path));
    for (const { target } of found.imports) visit(target, client);
  };
  visit(entry, inClient);
  return reads;
}

/** The layouts that wrap a route file, nearest first: its own directory's and every one above. */
function layoutsAbove(path: string): string[] {
  const layouts: string[] = [];
  for (let dir = dirname(path); dir.startsWith(APP); dir = dirname(dir)) {
    const layout = join(dir, 'layout.tsx');
    if (layout !== path && modules.has(layout)) layouts.push(layout);
  }
  return layouts;
}

/** What a component rendered at `position` in `file` gets; `outside`, when no wrapper is around. */
function givenAt(file: string, position: number, outside: readonly string[]): readonly string[] {
  const innermost = moduleAt(file)
    .wrappers.filter((wrapper) => wrapper.start < position && position < wrapper.end)
    .sort((a, b) => b.start - a.start)[0];
  return innermost ? [...ROOT_NAMESPACES, ...innermost.namespaces] : outside;
}

/** What reaches a route file from above: what the nearest layout gives its {children}. */
function fromAbove(path: string): readonly string[] {
  const [layout] = layoutsAbove(path);
  if (!layout) return ROOT_NAMESPACES;
  // The JSX {children}, not the `{ children }: …` of the layout's parameters.
  const position = moduleAt(layout).source.search(/\{\s*children\s*\}(?!\s*:)/);
  if (position < 0) throw new Error(`${relative(SRC, layout)} renders no {children}`);
  return givenAt(layout, position, fromAbove(layout));
}

/** Each module a route file renders, with what it is given there. */
function rendered(path: string): { target: string; given: readonly string[] }[] {
  const { source, imports } = moduleAt(path);
  const outside = fromAbove(path);
  return imports.flatMap(({ target, names }) => {
    const positions = names.flatMap((name) =>
      [...source.matchAll(new RegExp(`<${name}[\\s/>.]`, 'g'))].map((match) => match.index),
    );
    // A module the file uses other than as an element (a hook, a re-export) counts as outside.
    if (positions.length === 0) return [{ target, given: outside }];
    return positions.map((position) => ({ target, given: givenAt(path, position, outside) }));
  });
}

function covered(namespace: string, given: readonly string[]): boolean {
  return given.some((path) => namespace === path || namespace.startsWith(`${path}.`));
}

/** The namespaces `path`'s client components read and are not given, with where each is read. */
function missingIn(path: string): string[] {
  const own = moduleAt(path);
  const checks: { reads: Map<string, string>; given: readonly string[] }[] = [
    // A boundary that is a client component itself (error.tsx) is rendered where the layout
    // above renders its {children}.
    ...(own.directive === 'client'
      ? [
          {
            reads: new Map(own.reads.map((namespace) => [namespace, relative(SRC, path)])),
            given: fromAbove(path),
          },
        ]
      : []),
    ...rendered(path).map(({ target, given }) => ({
      reads: clientReads(target, own.directive === 'client'),
      given,
    })),
  ];
  const missing = checks.flatMap(({ reads, given }) =>
    [...reads]
      .filter(([namespace]) => !covered(namespace, given))
      .map(([namespace, where]) => `${namespace} (read in ${where})`),
  );
  return [...new Set(missing)];
}

const ROUTE_FILES = [...modules.keys()].filter((path) =>
  /[\\/](page|layout|error|not-found|default)\.tsx$/.test(path),
);

function routeFile(path: string): string {
  const found = ROUTE_FILES.find((file) => relative(APP, file).split(/[\\/]/).join('/') === path);
  if (!found) throw new Error(`No route file ${path}`);
  return found;
}

/** The position of the first `<name` element in a file. */
function elementAt(file: string, name: string): number {
  const position = moduleAt(file).source.search(new RegExp(`<${name}[\\s/>]`));
  if (position < 0) throw new Error(`No <${name}> in ${file}`);
  return position;
}

describe('client components and their messages (PERF-8)', () => {
  it('finds the route files and the client components that read messages', () => {
    expect(ROUTE_FILES.length).toBeGreaterThan(20);
    const stepPage = ROUTE_FILES.find((path) => path.includes('[step]'));
    expect(stepPage && [...clientReads(stepPage).keys()]).toContain('diagnostic.widgets');
  });

  it('gives a component what the ClientMessages around it sends, and only that', () => {
    const appLayout = routeFile('[locale]/(app)/layout.tsx');
    // The header and the footer sit outside the signed-in area's ClientMessages: root only.
    for (const name of ['SiteHeader', 'SiteFooter']) {
      expect(givenAt(appLayout, elementAt(appLayout, name), fromAbove(appLayout))).toEqual(
        ROOT_NAMESPACES,
      );
    }
    // Its pages get what it gives its {children}.
    expect(fromAbove(routeFile('[locale]/(app)/projects/[id]/q/[step]/page.tsx'))).toContain(
      'diagnostic',
    );
    // On the sign-in page, only the flow is wrapped; the link to signup beside it is not.
    const login = routeFile('[locale]/(site)/login/page.tsx');
    expect(givenAt(login, elementAt(login, 'LoginFlow'), fromAbove(login))).toContain('auth');
    expect(givenAt(login, elementAt(login, 'TextLink'), fromAbove(login))).not.toContain('auth');
  });

  it('finds ClientMessages only in route files, where its position is checked', () => {
    const elsewhere = [...modules]
      .filter(([path, found]) => found.wrappers.length > 0 && !ROUTE_FILES.includes(path))
      .map(([path]) => relative(SRC, path));
    expect(elsewhere).toEqual([]);
  });

  it.each(ROUTE_FILES.map((path) => [relative(APP, path), path]))(
    '%s gives its client components every namespace they read',
    (_name, path) => {
      expect(missingIn(path), 'wrap the component in <ClientMessages namespaces={[…]}>').toEqual(
        [],
      );
    },
  );
});
