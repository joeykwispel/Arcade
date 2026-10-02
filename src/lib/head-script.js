import { themeScript } from '@joeykwispel/design-kit/theme-script';

/**
 * Everything that has to run before the first paint: the design kit's theme script, and sending a reader
 * who chose Dutch before from the English home page to /nl/.
 *
 * Plain JavaScript, because two places need the exact same string: hooks.server.ts puts it in <head>,
 * svelte.config.js hashes it for the Content-Security-Policy.
 *
 * @param {string} base the site's base path, '' at the root of the domain
 */
export const headScript = (base) =>
  `${themeScript};try{if(localStorage.getItem('lang')==='nl'&&location.pathname==='${base}/')location.replace('${base}/nl/'+location.hash)}catch(e){}`;
