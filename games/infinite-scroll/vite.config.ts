import { defineConfig } from 'vite';

// base './': the game is served from /games/infinite-scroll/ in the hub, and must also work on its own.
export default defineConfig({
  base: './',
  server: { port: 5177 },
  build: { assetsInlineLimit: 0, chunkSizeWarningLimit: 800 }
});
