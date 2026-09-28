/**
 * Routes de méta-progression. Le serveur est la source de vérité :
 *  - il calcule lui-même la monnaie gagnée à partir du résumé de run,
 *  - il vérifie le coût et le niveau max avant tout achat.
 */
import { HttpError, readJsonBody, sendJson } from '../http/respond.js';
import { applyRunResult, createEmptyProfile, purchaseUpgrade } from '../../shared/meta/metaRules.js';

const PURCHASE_ERRORS = {
  unknown_upgrade: 404,
  max_level: 409,
  not_enough_shards: 409,
};

export function registerProfileRoutes(router, { profiles, content }) {
  router.get('/api/profile', async (_req, res) => {
    sendJson(res, 200, { profile: await profiles.load() });
  });

  // Enregistre la fin d'une run → crédite la monnaie.
  router.post('/api/profile/runs', async (req, res) => {
    const summary = await readJsonBody(req);
    const { rewards } = content.bundle.config;
    const result = await profiles.update((current) => {
      const r = applyRunResult(current, summary, rewards);
      return { profile: r.profile, result: r };
    });
    sendJson(res, 201, result);
  });

  // Achète le niveau suivant d'une amélioration permanente.
  router.post('/api/profile/purchases', async (req, res) => {
    const { upgradeId } = await readJsonBody(req);
    if (typeof upgradeId !== 'string') throw new HttpError(400, 'upgradeId_required');
    const outcome = await profiles.update((current) => {
      const r = purchaseUpgrade(current, upgradeId, content.bundle.metaUpgrades);
      return { profile: r.ok ? r.profile : undefined, result: r };
    });
    if (!outcome.ok) throw new HttpError(PURCHASE_ERRORS[outcome.error] ?? 400, outcome.error);
    sendJson(res, 200, { profile: outcome.profile });
  });

  // Réinitialise la progression.
  router.delete('/api/profile', async (_req, res) => {
    const profile = createEmptyProfile();
    await profiles.save(profile);
    sendJson(res, 200, { profile });
  });
}
