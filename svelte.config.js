import { createHash } from 'node:crypto';
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { headScript } from './src/lib/head-script.js';

/** Set BASE_PATH=/repo-name when deploying to a GitHub Pages project site instead of arcade.joeyoosenbrug.nl. */
const base = process.env.BASE_PATH ?? '';

/**
 * SvelteKit hashes its own inline scripts for the CSP, but not the script hooks.server.ts puts in <head>.
 * Hash the same string here, so the policy stays in sync when the design kit's theme script changes.
 */
const headHash = `sha256-${createHash('sha256').update(headScript(base)).digest('base64')}`;

export default {
  preprocess: vitePreprocess(),
  kit: {
    // The hub builds straight into dist/; scripts/build.mjs then adds every game under dist/games/<slug>/.
    adapter: adapter({ pages: 'dist', assets: 'dist', fallback: '404.html', precompress: false, strict: true }),
    paths: { base, relative: false },
    prerender: {
      entries: ['*', '/nl/'],
      // /games/<slug>/ are the games' own builds, copied in after the hub by scripts/build.mjs.
      handleHttpError: ({ path, message }) => {
        if (path.startsWith(`${base}/games/`)) return;
        throw new Error(message);
      }
    },
    // GitHub Pages can't send headers, so prerendered pages get the policy as a <meta> tag.
    csp: {
      mode: 'hash',
      directives: {
        'default-src': ['self'],
        'script-src': ['self', headHash],
        // Svelte sets inline style attributes (CSS variables, transitions)
        'style-src': ['self', 'unsafe-inline'],
        'img-src': ['self', 'data:'],
        // Vite inlines small font subsets as data: URIs
        'font-src': ['self', 'data:'],
        'connect-src': ['self'],
        // games are same-origin static builds under /games/<slug>/
        'frame-src': ['self'],
        'object-src': ['none'],
        'base-uri': ['self'],
        'form-action': ['none']
      }
    }
  }
};
