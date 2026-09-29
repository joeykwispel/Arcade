import { defineConfig } from 'vite';

// base './': the game is served from /games/estimate-poker/ in the hub, and must also work on its own.
export default defineConfig({
  base: './',
  server: { port: 5189 },
  build: { assetsInlineLimit: 0, target: 'es2022' }
});
