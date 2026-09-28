// Builds Code Review Tinder with Flutter into build/web/ (games.json points the hub there).
//   --no-web-resources-cdn   CanvasKit comes from our own folder, not from Google's CDN (the CSP only allows 'self')
//   --pwa-strategy=none      no service worker: the arcade is a static site that should just update
// The .symbols files are for debugging the engine and aren't needed to play, so they're left out.
// `node build.mjs --test` runs the Dart tests instead. Needs `flutter` on the PATH.
import { execSync } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

if (process.argv.includes('--test')) {
  run('flutter test');
  process.exit(0);
}

run('flutter build web --release --no-web-resources-cdn --pwa-strategy=none --base-href /games/code-review-tinder/');

for (const f of readdirSync('build/web', { recursive: true }).map(String)) {
  if (f.endsWith('.symbols')) rmSync(join('build/web', f));
}
