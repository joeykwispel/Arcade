import { defineConfig } from 'vite';

// base './': the game is served from /games/sql-heist/ in the hub, and must also work on its own.
// sql.js (SQLite compiled to WebAssembly) is bundled, and its .wasm is copied as an asset.
export default defineConfig({
  base: './',
  server: { port: 5188 },
  build: { assetsInlineLimit: 0, target: 'es2022' }
});
