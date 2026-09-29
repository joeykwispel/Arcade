import { defineConfig } from 'vite';

// base './': the game is served from /games/legacy-archaeology/ in the hub, and must also work on its own.
// @php-wasm's loaders import their .wasm files expecting a URL back (like webpack's asset modules): give them one.
// Only PHP 8.4 is in the build (@php-wasm/web-8-4); the browser downloads one of its two builds (JSPI or asyncify).
const phpWasmUrls = {
  name: 'php-wasm-urls',
  enforce: 'pre',
  async resolveId(id, importer) {
    if (importer?.includes('@php-wasm') && id.endsWith('.wasm')) return this.resolve(`${id}?url`, importer);
    return null;
  }
};

export default defineConfig({
  base: './',
  server: { port: 5192 },
  plugins: [phpWasmUrls],
  build: { assetsInlineLimit: 0, target: 'es2022', chunkSizeWarningLimit: 2000 }
});
