import type { Handle } from '@sveltejs/kit';
import { base } from '$app/paths';
import { headScript } from '$lib/head-script.js';
import { localeOf } from '$lib/i18n';

/**
 * Serves each prerendered page with the right <html lang>, so search engines and screen readers get it without JS,
 * and puts the design kit's theme script in <head>. app.html is a static file, so it cannot import the script itself.
 */
export const handle: Handle = ({ event, resolve }) => {
  const lang = localeOf(event.url.pathname);
  return resolve(event, {
    transformPageChunk: ({ html }) =>
      // the placeholder sits inside <script>, where the surrounding whitespace is part of the hashed content
      (lang === 'en' ? html : html.replace('<html lang="en"', `<html lang="${lang}"`)).replace(
        /<script>\s*%jo\.head%\s*<\/script>/,
        () => `<script>${headScript(base)}</script>`
      )
  });
};
