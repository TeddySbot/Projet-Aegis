/**
 * Dépôt de profil local (Storage Web ou toute implémentation {getItem, setItem}).
 * Utilisé en secours si le serveur est injoignable, et dans les tests (stockage
 * en mémoire). Applique les MÊMES règles pures que le serveur (shared/meta).
 */
import { applyRunResult, createEmptyProfile, purchaseUpgrade, sanitizeProfile } from '../../../shared/meta/metaRules.js';

const KEY = 'aegis.profile.v1';

export class LocalProfileRepository {
  /** @param {{ storage: {getItem(k: string): string|null, setItem(k: string, v: string): void}, rewards: any, catalog: any[] }} deps */
  constructor({ storage, rewards, catalog }) {
    this._storage = storage;
    this._rewards = rewards;
    this._catalog = catalog;
    this.label = 'local';
  }

  async load() {
    try {
      return sanitizeProfile(JSON.parse(this._storage.getItem(KEY) ?? 'null'));
    } catch {
      return createEmptyProfile();
    }
  }

  async recordRun(summary) {
    const { profile, reward } = applyRunResult(await this.load(), summary, this._rewards);
    this._save(profile);
    return { profile, reward };
  }

  async purchase(upgradeId) {
    const r = purchaseUpgrade(await this.load(), upgradeId, this._catalog);
    if (!r.ok) throw new Error(r.error);
    this._save(r.profile);
    return r.profile;
  }

  async reset() {
    const profile = createEmptyProfile();
    this._save(profile);
    return profile;
  }

  _save(profile) {
    this._storage.setItem(KEY, JSON.stringify(profile));
  }
}

/** Stockage clé/valeur en mémoire (tests, navigateurs sans localStorage). */
export class MemoryStorage {
  constructor() {
    this._map = new Map();
  }
  getItem(k) {
    return this._map.has(k) ? this._map.get(k) : null;
  }
  setItem(k, v) {
    this._map.set(k, String(v));
  }
}
