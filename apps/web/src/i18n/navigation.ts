import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/** Locale-aware versions of Next.js navigation: links and redirects keep the /ar or /en prefix. */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
