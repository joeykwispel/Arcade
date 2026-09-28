import { defineConfig } from 'vite';

// base './': the game is served from /games/deploy-tycoon/ in the hub, and must also work on its own.
// public/elm.js (the compiled Elm app, made by build.mjs) is copied as it is.
export default defineConfig({
  base: './',
  server: { port: 5178 },
  build: { assetsInlineLimit: 0 }
});
