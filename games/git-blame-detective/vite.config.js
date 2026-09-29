import { defineConfig } from 'vite';

// base './': the game is served from /games/git-blame-detective/ in the hub, and must also work on its own.
// The OCaml is compiled to _build/default/bin/main.bc.js first (build.mjs); web/main.js imports it.
export default defineConfig({
  base: './',
  server: { port: 5191 },
  build: { assetsInlineLimit: 0, target: 'es2022' }
});
