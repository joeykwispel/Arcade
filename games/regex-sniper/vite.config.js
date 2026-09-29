import { defineConfig } from 'vite';

// base './': the game is served from /games/regex-sniper/ in the hub, and must also work on its own.
// ruby.wasm (Ruby 3.4 as WebAssembly, without the standard library) is copied from npm as an asset.
export default defineConfig({
  base: './',
  server: { port: 5184 },
  build: { assetsInlineLimit: 0, target: 'es2022' }
});
