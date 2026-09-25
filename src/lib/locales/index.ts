import en from './en';
import nl from './nl';
import type { Locale } from '../types';

export type Content = typeof en;

export const locales: Locale[] = ['en', 'nl'];

/** All hub text for a locale. */
export const t = (locale: Locale): Content => (locale === 'nl' ? nl : en);

/** Fills {placeholders} in a string. */
export const fill = (s: string, vars: Record<string, string>) => s.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
