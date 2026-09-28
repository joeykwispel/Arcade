import { defineConfig } from 'vitest/config';

// base './': the game is served from /games/infinite-scroll/ in the hub, and must also work on its own.
// The ReScript compiler writes a .res.mjs next to every .res file; Vite and Vitest pick those up.
export default defineConfig({
  base: './',
  server: { port: 5177 },
  build: { assetsInlineLimit: 0, chunkSizeWarningLimit: 800 },
  test: { include: ['src/**/*_test.res.mjs'] }
});
