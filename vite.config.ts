import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { gamesDevServer } from './scripts/games-dev-server.mjs';

export default defineConfig({
  // gamesDevServer: in `npm run dev`, serves each game's own build from games/<slug>/dist at /games/<slug>/
  plugins: [sveltekit(), gamesDevServer()],
  test: { include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'], environment: 'node' }
});
