import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// base './': the game is served from /games/deploy-tycoon/ in the hub, and must also work on its own.
export default defineConfig({
  base: './',
  plugins: [svelte()],
  server: { port: 5178 },
  build: { assetsInlineLimit: 0 }
});
