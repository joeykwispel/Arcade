import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** Set BASE_PATH=/repo-name when deploying to a GitHub Pages project site instead of arcade.joeyoosenbrug.nl. */
const base = process.env.BASE_PATH ?? '';

/**
 * SvelteKit hashes its own inline scripts for the CSP, but not the theme script in app.html.
 * Hash it here, after the %sveltekit.assets% placeholder is filled in, so the policy stays in sync when it changes.
 */
const appHtml = readFileSync(new URL('./src/app.html', import.meta.url), 'utf8');
const themeScript = /<script>([\s\S]*?)<\/script>/.exec(appHtml)?.[1] ?? '';
const themeHash = `sha256-${createHash('sha256').update(themeScript.replaceAll('%sveltekit.assets%', base)).digest('base64')}`;

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
        'script-src': ['self', themeHash],
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
