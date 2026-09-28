/** Implémentation en mémoire de l'interface ProfileStore (tests, mode démo). */
import { createEmptyProfile, sanitizeProfile } from '../../shared/meta/metaRules.js';

export class MemoryProfileStore {
  constructor(initial = createEmptyProfile()) {
    this._profile = sanitizeProfile(initial);
  }
  async load() {
    return structuredClone(this._profile);
  }
  async save(profile) {
    this._profile = structuredClone(profile);
  }
  async update(mutator) {
    const { profile, result } = mutator(await this.load());
    if (profile) await this.save(profile);
    return result;
  }
}
