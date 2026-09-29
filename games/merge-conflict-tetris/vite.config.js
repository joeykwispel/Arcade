import { defineConfig } from 'vite';

// base './': the game is served from /games/merge-conflict-tetris/ in the hub, and must also work on its own.
// game.wasm is built from go/ by TinyGo first (build.mjs); Vite copies it like any other asset.
export default defineConfig({
  base: './',
  server: { port: 5183 },
  build: { assetsInlineLimit: 0, target: 'es2022' }
});
