import { defineConfig } from 'vite';

/**
 * Fengari's JavaScript bridge builds a blank arrow function with `Function("return ()=>void 0;")`, so old transpilers
 * couldn't turn it into a normal function. That is string evaluation, which our Content-Security-Policy blocks
 * (rightly). It runs the first time Lua hands a function to JavaScript, like an event listener. Swap it for a plain
 * arrow function at build time; Vite keeps arrow functions as they are.
 */
const fengariWithoutEval = {
  name: 'fengari-without-eval',
  transform(code, id) {
    if (!id.includes('fengari-web')) return null;
    const out = code.replace('Function("return ()=>void 0;")', '(function () { return () => void 0; })');
    if (out === code) this.warn('fengari-web: the Function() call to replace was not found; check the CSP still holds');
    return { code: out, map: null };
  }
};

// base './': the game is served from /games/semicolon-snake/ in the hub, and must also work on its own.
export default defineConfig({
  base: './',
  plugins: [fengariWithoutEval],
  server: { port: 5179 },
  build: { assetsInlineLimit: 0 }
});
