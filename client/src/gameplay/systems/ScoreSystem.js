import { GameEvents } from '../../core/events.js';
import { GameSystem } from './GameSystem.js';

/**
 * ScoreSystem — purement réactif : points par ennemi tué, points de survie par
 * seconde, bonus de victoire. Désactivable : le reste du jeu fonctionne (score = 0).
 */
export class ScoreSystem extends GameSystem {
  /** @param {{ bus: any, survivalPerSecond: number, victoryBonus: number }} deps */
  constructor({ bus, survivalPerSecond, victoryBonus }) {
    super('score', bus);
    this.score = 0;
    this.subs
      .on(GameEvents.ENEMY_KILLED, ({ score }) => this._add(score))
      .on(GameEvents.RUN_TICK, () => this._add(survivalPerSecond))
      .on(GameEvents.ALL_WAVES_COMPLETED, () => this._add(victoryBonus));
  }

  _add(delta) {
    if (!delta) return;
    this.score += delta;
    this.bus.emit(GameEvents.SCORE_CHANGED, { score: this.score, delta });
  }
}
