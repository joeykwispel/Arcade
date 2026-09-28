import { defineConfig } from 'vite';

// base './': the game is served from /games/dependency-hell/ in the hub, and must also work on its own.
// web/build/dh.mjs and dh.wasm come from Emscripten (build.mjs); Vite bundles them like any module and asset.
export default defineConfig({
  base: './',
  server: { port: 5180 },
  build: { assetsInlineLimit: 0, target: 'es2022' }
});
