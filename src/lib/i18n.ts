import { base } from '$app/paths';
import type { Locale } from './types';

/** Path prefix per locale. English is the default and has none. */
const prefix: Record<Locale, string> = { en: '', nl: '/nl' };

/** Builds a site-absolute href for `path` (starting with "/") in the given locale. */
export const localize = (path: string, locale: Locale) => `${base}${prefix[locale]}${path}`;

/** Removes the base path and locale prefix from a pathname, so it can be localized again. */
export function stripLocale(pathname: string): string {
  let p = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  if (p === '/nl' || p.startsWith('/nl/')) p = p.slice(3);
  return p || '/';
}

export const localeOf = (pathname: string): Locale => (/^\/nl(\/|$)/.test(pathname.slice(base.length)) ? 'nl' : 'en');
