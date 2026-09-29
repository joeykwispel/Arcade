// Builds Merge Conflict Tetris into dist/: TinyGo compiles go/ to game.wasm (a plain module, no JavaScript glue),
// then Vite builds the page around it. Needs `tinygo` (and Binaryen's `wasm-opt`, which TinyGo uses) on the PATH.
// `node build.mjs --test` runs the Go tests instead, with plain `go test`.
import { execSync } from 'node:child_process';

const run = (cmd, cwd = '.') => execSync(cmd, { stdio: 'inherit', cwd });

if (process.argv.includes('--test')) {
  run('go test ./...', 'go');
  process.exit(0);
}

run('tinygo build -target wasm-unknown -opt=z -no-debug -o ../game.wasm ./wasm', 'go');
run('npx vite build');
