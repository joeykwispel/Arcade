// Serves the built site in dist/ the way GitHub Pages will: `npm run build`, then `npm run preview`.
// `--port 4173` picks the port (4173 by default).
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { staticHandler } from './static.mjs';

const i = process.argv.indexOf('--port');
const port = i > -1 ? Number(process.argv[i + 1]) : 4173;

if (!existsSync('dist/index.html')) {
  console.error('dist/ is empty. Run `npm run build` first.');
  process.exit(1);
}

createServer(staticHandler('dist')).listen(port, () => console.log(`Play preview on http://localhost:${port}/`));
