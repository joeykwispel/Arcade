// Builds Dev-Ware into dist/: `gleam build` compiles the Gleam (and Lustre) to JavaScript in build/dev/javascript/,
// then Vite builds the page around it. `node build.mjs --test` runs the Gleam tests instead.
//
// On Windows, Gleam needs permission to create symbolic links: turn on Developer Mode (Settings › System › For
// developers). Without it, this uses an earlier compile if there is one, and says so.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

if (process.argv.includes('--test')) {
  run('gleam test --target javascript');
  process.exit(0);
}

try {
  run('gleam build --target javascript');
} catch (err) {
  const compiled = existsSync('build/dev/javascript/dev_ware/dev_ware.mjs');
  if (process.platform !== 'win32' || !compiled) throw err;
  console.warn('\ngleam build failed (on Windows: turn on Developer Mode for symlinks); using the earlier compile in build/.\n');
}
run('npx vite build');
