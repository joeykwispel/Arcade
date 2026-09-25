// Runs each game's own tests (`npm test` in games/<slug>/, when it has one). Install first: `npm run build:games`.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const games = JSON.parse(readFileSync('games.json', 'utf8'));

for (const g of games) {
  const pkg = JSON.parse(readFileSync(`games/${g.slug}/package.json`, 'utf8'));
  if (!pkg.scripts?.test) {
    console.log(`\n${g.slug}: no tests`);
    continue;
  }
  console.log(`\n> npm test   (in games/${g.slug})`);
  execSync('npm test', { cwd: `games/${g.slug}`, stdio: 'inherit' });
}
