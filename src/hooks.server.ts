import type { Handle } from '@sveltejs/kit';
import { localeOf } from '$lib/i18n';

/** Serves each prerendered page with the right <html lang>, so search engines and screen readers get it without JS. */
export const handle: Handle = ({ event, resolve }) => {
  const lang = localeOf(event.url.pathname);
  return resolve(event, { transformPageChunk: ({ html }) => (lang === 'en' ? html : html.replace('<html lang="en"', `<html lang="${lang}"`)) });
};
