/**
 * Dépôt de profil adossé au serveur Node : c'est lui qui calcule les récompenses
 * et valide les achats. Interface commune à tous les dépôts de profil :
 *   load() · recordRun(summary) → {profile, reward} · purchase(id) → profile · reset() → profile
 */
export class HttpProfileRepository {
  /** @param {{ api: import('../platform/ApiClient.js').ApiClient }} deps */
  constructor({ api }) {
    this._api = api;
    this.label = 'serveur';
  }
  async load() {
    return (await this._api.get('/api/profile')).profile;
  }
  async recordRun(summary) {
    const { profile, reward } = await this._api.post('/api/profile/runs', summary);
    return { profile, reward };
  }
  async purchase(upgradeId) {
    return (await this._api.post('/api/profile/purchases', { upgradeId })).profile;
  }
  async reset() {
    return (await this._api.delete('/api/profile')).profile;
  }
}
