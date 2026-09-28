/**
 * ContentRepository — charge et valide les données de jeu depuis `data/`.
 *
 * Le contenu (ennemis, vagues, armes, améliorations…) vit dans des fichiers JSON
 * éditables sans toucher au code. Le serveur les valide au démarrage (fail fast)
 * et les sert au client en un seul bundle via GET /api/content.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { validateContent } from '../../shared/content/validateContent.js';

export const CONTENT_FILES = {
  config: 'config.json',
  player: 'player.json',
  enemies: 'enemies.json',
  weapons: 'weapons.json',
  waves: 'waves.json',
  upgrades: 'upgrades.json',
  metaUpgrades: 'meta-upgrades.json',
  endless: 'endless.json',
};

export class ContentValidationError extends Error {
  constructor(errors) {
    super(`Données de jeu invalides :\n  - ${errors.join('\n  - ')}`);
    this.errors = errors;
  }
}

export class ContentRepository {
  /** @param {{ dataDir: string, readFile?: (p: string) => Promise<string> }} options */
  constructor({ dataDir, readFile }) {
    this._dataDir = dataDir;
    this._readFile = readFile ?? ((p) => fs.readFile(p, 'utf8'));
    this._bundle = null;
  }

  /** Charge tous les fichiers, valide, et met le bundle en cache. */
  async load() {
    const bundle = {};
    const errors = [];
    for (const [key, file] of Object.entries(CONTENT_FILES)) {
      const full = path.join(this._dataDir, file);
      try {
        bundle[key] = JSON.parse(await this._readFile(full));
      } catch (err) {
        errors.push(`${file} : ${err.code === 'ENOENT' ? 'fichier manquant' : `JSON illisible (${err.message})`}`);
      }
    }
    if (errors.length === 0) errors.push(...validateContent(bundle));
    if (errors.length) throw new ContentValidationError(errors);
    this._bundle = Object.freeze(bundle);
    return this._bundle;
  }

  get bundle() {
    if (!this._bundle) throw new Error('ContentRepository : load() doit être appelé avant usage');
    return this._bundle;
  }
}
