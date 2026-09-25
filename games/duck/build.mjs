// Builds the game into dist/ with plain esbuild: one JS bundle, one CSS file, the font files, and index.html.
// Every path is relative, so the folder works wherever it is served (/games/duck/ in the hub, or on its own).
// `node build.mjs --serve` starts a dev server with live rebuilds on http://localhost:5174.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import * as esbuild from 'esbuild';

const serve = process.argv.includes('--serve');

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('index.html', 'dist/index.html');
cpSync('public', 'dist', { recursive: true });

/** @type {esbuild.BuildOptions} */
const options = {
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  outdir: 'dist/assets',
  entryNames: '[name]',
  assetNames: '[name]-[hash]',
  loader: { '.woff2': 'file', '.woff': 'file' },
  minify: !serve,
  sourcemap: serve,
  logLevel: 'info'
};

if (serve) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: 'dist', port: 5174 });
  console.log(`Rubber Duck Run on http://localhost:${port}/`);
} else {
  await esbuild.build(options);
}
