import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// base './': the game is served from /games/null-pointer-dodge/ in the hub, and must also work on its own.
// Vue templates are compiled at build time, so the page runs Vue's runtime only: no eval, the CSP stays strict.
export default defineConfig({
  base: './',
  plugins: [vue()],
  server: { port: 5186 },
  build: { assetsInlineLimit: 0, target: 'es2022' }
});
