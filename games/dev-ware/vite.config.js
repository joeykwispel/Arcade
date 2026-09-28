import { defineConfig } from 'vite';

// base './': the game is served from /games/dev-ware/ in the hub, and must also work on its own.
// The Gleam code is compiled to build/dev/javascript/ first (build.mjs); Vite bundles it like any other module.
export default defineConfig({
  base: './',
  server: { port: 5181 },
  build: { assetsInlineLimit: 0 }
});
