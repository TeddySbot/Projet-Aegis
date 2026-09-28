/**
 * Fabrique de l'application HTTP. Ne lit aucune variable globale : toutes les
 * dépendances (contenu, stockage des profils, dossiers publics, logger) sont
 * injectées — l'app est donc instanciable telle quelle dans les tests.
 */
import http from 'node:http';
import path from 'node:path';
import { Router } from './http/Router.js';
import { HttpError, sendJson } from './http/respond.js';
import { createStaticHandler } from './http/staticFiles.js';
import { registerContentRoutes } from './routes/contentRoutes.js';
import { registerProfileRoutes } from './routes/profileRoutes.js';

/**
 * @param {{
 *   content: { bundle: object },
 *   profiles: { load(): Promise<object>, save(p: object): Promise<void>, update(fn: Function): Promise<any> },
 *   publicDirs: { client: string, shared: string },
 *   logger?: Pick<Console, 'info'|'warn'|'error'>,
 * }} deps
 */
export function createApp({ content, profiles, publicDirs, logger = console }) {
  const router = new Router();
  router.get('/api/health', (_req, res) => sendJson(res, 200, { status: 'ok' }));
  registerContentRoutes(router, { content });
  registerProfileRoutes(router, { profiles, content });

  const serveStatic = createStaticHandler({
    mounts: publicDirs,
    index: path.join(publicDirs.client, 'index.html'),
  });

  async function handle(req, res) {
    const { pathname } = new URL(req.url, 'http://localhost');
    try {
      if (pathname.startsWith('/api/')) {
        const match = router.match(req.method, pathname);
        if (!match) throw new HttpError(404, 'not_found');
        if (match.methodNotAllowed) throw new HttpError(405, 'method_not_allowed');
        await match.handler(req, res, match.params);
        return;
      }
      if ((req.method === 'GET' || req.method === 'HEAD') && (await serveStatic(req, res, pathname))) return;
      throw new HttpError(404, 'not_found');
    } catch (err) {
      if (err instanceof HttpError) return sendJson(res, err.status, { error: err.code });
      logger.error('[http] erreur interne', err);
      if (!res.headersSent) sendJson(res, 500, { error: 'internal_error' });
    }
  }

  return { handle, server: http.createServer(handle) };
}
