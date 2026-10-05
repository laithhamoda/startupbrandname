import type { catalogues } from './messages';

type Messages = (typeof catalogues)['ar'];
interface Tree {
  [key: string]: Tree | string;
}
/** What NextIntlClientProvider accepts: any part of the catalogue. */
type PartialMessages<T = Messages> = {
  [K in keyof T]?: T[K] extends object ? PartialMessages<T[K]> : T[K];
};

/** A namespace, or a namespace inside one ("auth.errors"): what useTranslations() is given. */
export type NamespacePath<T = Messages> = {
  [K in keyof T & string]: T[K] extends string ? never : K | `${K}.${NamespacePath<T[K]>}`;
}[keyof T & string];

/**
 * The namespaces the root layout sends to the browser with every page (PERF-8): the dialog's
 * close button (common), the header and footer with their language and theme switches (language,
 * theme, nav, meta, footer) and the error page (errors). The header, the footer and the error page
 * are client components inside `[locale]/error.tsx`, the boundary of the whole [locale] tree,
 * which no nested provider can reach. Every other namespace is sent only by the pages whose client
 * components read it, through `ClientMessages`.
 */
export const ROOT_NAMESPACES = [
  'common',
  'language',
  'theme',
  'nav',
  'meta',
  'footer',
  'errors',
] as const satisfies readonly NamespacePath[];

/** `source` reduced to the subtree at `keys`, as a new object. */
function subtree(source: Tree, [key = '', ...rest]: string[]): Tree {
  const child = source[key];
  if (child === undefined) throw new Error(`No messages under "${key}".`);
  return { [key]: rest.length === 0 || typeof child === 'string' ? child : subtree(child, rest) };
}

/** `a` and `b` combined into a new object, so the catalogue itself is never changed. */
function merge(a: Tree, b: Tree): Tree {
  const result: Tree = { ...a };
  for (const [key, value] of Object.entries(b)) {
    const existing = result[key];
    result[key] =
      typeof existing === 'object' && typeof value === 'object' ? merge(existing, value) : value;
  }
  return result;
}

/**
 * Only the given namespaces of a catalogue, for a NextIntlClientProvider. Without `messages`, the
 * provider sends the whole catalogue (about 17 KB in Arabic) with every page.
 */
export function pickMessages(messages: Messages, paths: readonly NamespacePath[]): PartialMessages {
  let picked: Tree = {};
  for (const path of paths) picked = merge(picked, subtree(messages, path.split('.')));
  return picked;
}
