// Builds the game into dist/:
//   1. `elm make --optimize` compiles src/Main.elm (and everything it imports) to one JavaScript file
//   2. esbuild minifies it into public/elm.js (Elm's own advice: its output compresses very well)
//   3. Vite builds the page: index.html, the small bootstrap (src/boot.js), the CSS and the font
// `node build.mjs --dev` does steps 1-2 without --optimize, for readable errors, and then starts Vite's dev server.
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { transform } from 'esbuild';

const dev = process.argv.includes('--dev');
const tmp = join(tmpdir(), `deploy-tycoon-elm-${process.pid}.js`);

execSync(`npx elm make src/Main.elm ${dev ? '' : '--optimize '}--output=${JSON.stringify(tmp)}`, { stdio: 'inherit' });
const { code } = await transform(readFileSync(tmp, 'utf8'), {
  minify: !dev,
  // Elm's generated helpers are pure: dropping unused ones is safe
  pure: ['F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9']
});
rmSync(tmp, { force: true });
mkdirSync('public', { recursive: true });
writeFileSync('public/elm.js', code);

execSync(dev ? 'npx vite' : 'npx vite build', { stdio: 'inherit' });
