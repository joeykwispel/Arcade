import { cpSync, mkdirSync } from 'node:fs';
import { defineConfig } from 'vite';

// Pyodide (CPython compiled to WebAssembly) is served from our own ./pyodide/ folder, not from a CDN:
// this copies the runtime files next to the build. The game's Python is imported as text (?raw) and run by it.
const PYODIDE_FILES = ['pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'];

const copyPyodide = () => ({
  name: 'copy-pyodide',
  apply: 'build',
  closeBundle() {
    mkdirSync('dist/pyodide', { recursive: true });
    for (const f of PYODIDE_FILES) cpSync(`node_modules/pyodide/${f}`, `dist/pyodide/${f}`);
  }
});

// base './': the game is served from /games/rm-rf-dungeon/ in the hub, and must also work on its own.
export default defineConfig({
  base: './',
  server: { port: 5182 },
  build: { assetsInlineLimit: 0 },
  optimizeDeps: { exclude: ['pyodide'] },
  plugins: [copyPyodide()]
});
