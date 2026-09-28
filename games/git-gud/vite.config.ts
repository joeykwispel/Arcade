import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './': the game is served from /games/git-gud/ in the hub, and must also work on its own.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5176 },
  build: { assetsInlineLimit: 0 }
});
