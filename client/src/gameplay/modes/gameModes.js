/**
 * Modes de jeu — pattern Stratégie indexé par nom (`GAME_MODES` dans shared/content/vocabulary.js).
 *
 * Un mode ne crée aucun système : il configure la run à partir du contenu
 *  - `waves` : le fournisseur de vagues (fini et scénarisé, ou infini et généré) ;
 *  - `runConfig` : la configuration de run (éventuellement surchargée, ex : courbe d'XP) ;
 *  - `upgradesUncapped` : les améliorations peuvent-elles dépasser `maxStacks` ?
 * Ajouter un mode = une entrée ici + son nom dans le vocabulaire partagé.
 */
import { ScriptedWaveProvider } from '../waves/ScriptedWaveProvider.js';
import { EndlessWaveProvider } from '../waves/EndlessWaveProvider.js';

/** @type {Record<string, { configure: (content: any) => { waves: { total: number|null, get(i: number): any }, runConfig: any, upgradesUncapped: boolean } }>} */
export const gameModes = Object.freeze({
  story: {
    configure: (content) => ({
      waves: new ScriptedWaveProvider(content.waves.waves),
      runConfig: content.config.run,
      upgradesUncapped: false,
    }),
  },
  endless: {
    configure: (content) => ({
      waves: new EndlessWaveProvider({ def: content.endless, enemies: content.enemies }),
      runConfig: { ...content.config.run, ...(content.endless.runOverrides ?? {}) },
      upgradesUncapped: Boolean(content.endless.upgrades?.uncapped),
    }),
  },
});

export const DEFAULT_MODE = 'story';
