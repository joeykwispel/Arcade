// Builds everything into one static dist/ for GitHub Pages:
//   1. the hub (SvelteKit) into dist/
//   2. every game in games.json with its own tooling, in its own folder, into games/<slug>/<outDir>
//   3. copies each game build to dist/games/<slug>/
// Games share nothing: each gets its own `npm ci` and its own `npm run build`.
// `--games-only` skips the hub and the copy step (handy for `npm run dev`).
import { execSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs';

const gamesOnly = process.argv.includes('--games-only');
const games = JSON.parse(readFileSync('games.json', 'utf8'));

/** @param {string} cmd @param {string} [cwd] */
const run = (cmd, cwd = '.') => {
  console.log(`\n> ${cmd}${cwd === '.' ? '' : `   (in ${cwd})`}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
};

if (!gamesOnly) run('npx vite build');

for (const g of games) {
  const dir = `games/${g.slug}`;
  if (!existsSync(`${dir}/package.json`)) throw new Error(`${dir}/package.json is missing (listed in games.json)`);
  run(existsSync(`${dir}/package-lock.json`) ? 'npm ci' : 'npm install', dir);
  run('npm run build', dir);

  const out = `${dir}/${g.outDir ?? 'dist'}`;
  if (!existsSync(`${out}/index.html`)) throw new Error(`${out}/index.html is missing after building ${g.slug}`);
  if (!gamesOnly) {
    rmSync(`dist/games/${g.slug}`, { recursive: true, force: true });
    cpSync(out, `dist/games/${g.slug}`, { recursive: true });
  }
}

console.log(gamesOnly ? `\nBuilt ${games.length} game(s).` : `\nBuilt the hub and ${games.length} game(s) into dist/.`);
