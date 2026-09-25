// Vite plugin for `npm run dev`: serves /games/<slug>/ from games/<slug>/<outDir>, the game's own last build.
// The hub never bundles a game; build one with `npm run build` inside its folder (or `npm run build:games`).
import { existsSync, readFileSync } from 'node:fs';
import { staticHandler } from './static.mjs';

/** @returns {import('vite').Plugin} */
export function gamesDevServer() {
  return {
    name: 'play-games-dev-server',
    configureServer(server) {
      const games = JSON.parse(readFileSync('games.json', 'utf8'));
      for (const g of games) {
        const dir = `games/${g.slug}/${g.outDir ?? 'dist'}`;
        const serve = staticHandler(dir);
        server.middlewares.use(`/games/${g.slug}`, (req, res, next) => {
          if (!existsSync(dir)) {
            res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
            return res.end(`${g.slug} has not been built yet. Run \`npm run build:games\` (or \`npm run build\` in games/${g.slug}/).`);
          }
          // connect strips the mount path; a bare /games/<slug> needs the trailing slash for relative assets
          if (req.url === '' || /** @type {{ originalUrl?: string }} */ (req).originalUrl === `/games/${g.slug}`) {
            res.writeHead(301, { Location: `/games/${g.slug}/` });
            return res.end();
          }
          serve(req, res, next);
        });
      }
    }
  };
}
