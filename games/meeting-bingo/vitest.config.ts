import { defineConfig } from 'vitest/config';

// The rules tests need no DOM: run them in plain Node, without vite-plugin-solid (which would ask for jsdom).
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] }
});
