/**
 * FileProfileStore — persistance du profil de méta-progression sur disque (JSON).
 *
 * - Écriture atomique (fichier temporaire + rename) : un crash pendant la sauvegarde
 *   ne corrompt pas le profil existant.
 * - Écritures sérialisées via une file de promesses : deux requêtes simultanées ne
 *   s'écrasent pas mutuellement.
 * - Un fichier illisible est mis de côté (.corrupt) et remplacé par un profil vierge.
 *
 * Interface (implémentable par une autre technologie : SQLite, cloud…) :
 *   load(): Promise<Profile>   save(profile): Promise<void>   update(fn): Promise<T>
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createEmptyProfile, sanitizeProfile } from '../../shared/meta/metaRules.js';

export class FileProfileStore {
  /** @param {{ dir: string, fileName?: string, logger?: Console }} options */
  constructor({ dir, fileName = 'profile.json', logger = console }) {
    this._dir = dir;
    this._file = path.join(dir, fileName);
    this._logger = logger;
    this._queue = Promise.resolve();
  }

  async load() {
    try {
      const raw = await fs.readFile(this._file, 'utf8');
      return sanitizeProfile(JSON.parse(raw));
    } catch (err) {
      if (err.code === 'ENOENT') return createEmptyProfile();
      const backup = `${this._file}.${Date.now()}.corrupt`;
      this._logger.warn(`[profile] sauvegarde illisible, déplacée vers ${backup}`);
      await fs.rename(this._file, backup).catch(() => {});
      return createEmptyProfile();
    }
  }

  async save(profile) {
    await fs.mkdir(this._dir, { recursive: true });
    const tmp = `${this._file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(profile, null, 2), 'utf8');
    await fs.rename(tmp, this._file);
  }

  /**
   * Lecture-modification-écriture exclusive.
   * @template T
   * @param {(profile: object) => { profile?: object, result: T }} mutator
   * @returns {Promise<T>}
   */
  update(mutator) {
    const task = this._queue.then(async () => {
      const current = await this.load();
      const { profile, result } = mutator(current);
      if (profile) await this.save(profile);
      return result;
    });
    this._queue = task.catch(() => {});
    return task;
  }
}
