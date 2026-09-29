import { defineConfig } from 'vite';

// base './': the game is served from /games/brainfuck-bomb/ in the hub, and must also work on its own.
// src/bf.wasm is assembled from the hand-written src/bf.wat first (build.mjs); Vite copies it as an asset.
export default defineConfig({
  base: './',
  server: { port: 5190 },
  build: { assetsInlineLimit: 0, target: 'es2022' }
});
