/**
 * Service de fichiers statiques restreint à une liste blanche de dossiers.
 * Protège contre la traversée de répertoires (`/client/../server/...`).
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/**
 * @param {{ mounts: Record<string, string>, index: string }} options
 *   mounts : préfixe d'URL → dossier sur disque (ex : { client: '/app/client' })
 *   index  : fichier servi pour "/"
 */
export function createStaticHandler({ mounts, index }) {
  return async function serveStatic(req, res, pathname) {
    let file;
    if (pathname === '/' || pathname === '/index.html') file = index;
    else {
      const [, mount, ...rest] = pathname.split('/');
      const base = mounts[mount];
      if (!base || rest.some((seg) => seg.startsWith('.'))) return false;
      file = path.resolve(base, ...rest.map(decodeURIComponent));
      if (!file.startsWith(base + path.sep)) return false;
    }
    try {
      const body = await fs.readFile(file);
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
        'Content-Length': body.length,
        'Cache-Control': 'no-cache',
      });
      res.end(req.method === 'HEAD' ? undefined : body);
      return true;
    } catch (err) {
      if (err.code === 'ENOENT' || err.code === 'EISDIR') return false;
      throw err;
    }
  };
}
