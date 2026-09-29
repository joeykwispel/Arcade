import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

// base './': the game is served from /games/meeting-bingo/ in the hub, and must also work on its own.
// Solid compiles JSX to plain DOM code at build time: no runtime templates, no eval, a strict CSP.
export default defineConfig({
  base: './',
  plugins: [solid()],
  server: { port: 5187 },
  build: { assetsInlineLimit: 0, target: 'es2022' }
});
