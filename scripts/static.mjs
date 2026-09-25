// A tiny static file handler that behaves like GitHub Pages: /dir/ serves dir/index.html, /dir redirects to /dir/,
// and unknown paths get 404.html. Used by `npm run preview` (serve.mjs) and by the dev server for game builds.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

/** @type {Record<string, string>} */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};

/**
 * Resolves a URL path inside `root`, or null when there is no such file.
 * @param {string} root absolute directory
 * @param {string} urlPath decoded path, starting with "/"
 */
export function resolveFile(root, urlPath) {
  const file = normalize(join(root, urlPath));
  // never serve anything outside the root
  if (file !== root && !file.startsWith(root + sep)) return null;
  if (!existsSync(file)) return null;
  if (statSync(file).isDirectory()) {
    const index = join(file, 'index.html');
    return existsSync(index) ? { file: index, redirect: !urlPath.endsWith('/') } : null;
  }
  return { file, redirect: false };
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {string} file
 * @param {number} [status]
 */
export function send(res, file, status = 200) {
  res.writeHead(status, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
  createReadStream(file).pipe(res);
}

/**
 * Serves `root`. Calls `next()` for misses when given (middleware), otherwise answers with 404.html.
 * @param {string} root
 */
export function staticHandler(root) {
  root = resolve(root);
  /** @param {import('node:http').IncomingMessage} req @param {import('node:http').ServerResponse} res @param {() => void} [next] */
  return (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let path;
    try {
      path = decodeURIComponent(url.pathname);
    } catch {
      path = url.pathname;
    }
    const hit = resolveFile(root, path);
    if (hit?.redirect) {
      res.writeHead(301, { Location: `${url.pathname}/${url.search}` });
      return res.end();
    }
    if (hit) return send(res, hit.file);
    if (next) return next();
    const notFound = join(root, '404.html');
    if (existsSync(notFound)) return send(res, notFound, 404);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  };
}
