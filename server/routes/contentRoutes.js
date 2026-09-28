import { sendJson } from '../http/respond.js';

/** GET /api/content — bundle complet des données de jeu validées. */
export function registerContentRoutes(router, { content }) {
  router.get('/api/content', (_req, res) => sendJson(res, 200, content.bundle));
}
