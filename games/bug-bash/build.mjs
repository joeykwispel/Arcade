// Builds the game into dist/:
//   1. cargo compiles the Rust crate to WebAssembly (wasm32-unknown-unknown, no wasm-bindgen, no wasm-pack)
//   2. esbuild bundles the thin page layer (web/main.js), its CSS and the font
// Every path is relative, so the folder works wherever it is served (/games/bug-bash/ in the hub, or on its own).
// `node build.mjs --serve` serves on http://localhost:5175 and rebuilds the .wasm when a Rust file changes.
import { execSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, rmSync, watch } from 'node:fs';
import * as esbuild from 'esbuild';

const serve = process.argv.includes('--serve');
const WASM = 'target/wasm32-unknown-unknown/release/bug_bash.wasm';

function buildWasm() {
  execSync('cargo build --release --target wasm32-unknown-unknown', { stdio: 'inherit' });
  mkdirSync('dist/assets', { recursive: true });
  copyFileSync(WASM, 'dist/assets/bug_bash.wasm');
}

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('index.html', 'dist/index.html');
cpSync('public', 'dist', { recursive: true });
buildWasm();

/** @type {esbuild.BuildOptions} */
const options = {
  entryPoints: ['web/main.js'],
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
  let timer;
  watch('src', { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        buildWasm();
      } catch {
        /* cargo already printed the error */
      }
    }, 150);
  });
  const { port } = await ctx.serve({ servedir: 'dist', port: 5175 });
  console.log(`Bug Bash on http://localhost:${port}/`);
} else {
  await esbuild.build(options);
}
