// Builds Stack Overflow into dist/: Zig compiles zig/wasm.zig to game.wasm (freestanding, no imports), then Vite
// builds the page around it. Needs `zig` 0.16 on the PATH (or ZIG pointing at it).
// `node build.mjs --test` runs the Zig tests instead.
import { execFileSync, execSync } from 'node:child_process';

const zig = process.env.ZIG ?? 'zig';
const run = (...args) => execFileSync(zig, args, { stdio: 'inherit' });

if (process.argv.includes('--test')) {
  run('test', 'zig/game.zig');
  process.exit(0);
}

run('build-exe', 'zig/wasm.zig', '-target', 'wasm32-freestanding', '-fno-entry', '-rdynamic', '-O', 'ReleaseSmall', '-femit-bin=game.wasm');
execSync('npx vite build', { stdio: 'inherit' });
