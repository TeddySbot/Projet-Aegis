import { GameEvents } from '../../core/events.js';
import { GameSystem } from './GameSystem.js';

/**
 * RunDirector — horloge et conditions de fin de la run.
 *
 * Il agrège le résumé (score, éliminations, niveau, vague) uniquement à partir des
 * événements : si le système de score est désactivé, le score vaut simplement 0.
 * Fin de run : PLAYER_DIED → défaite ; ALL_WAVES_COMPLETED → victoire ; abandon().
 */
export class RunDirector extends GameSystem {
  /** @param {{ bus: any, world: import('../World.js').World }} deps */
  constructor({ bus, world }) {
    super('director', bus);
    this._world = world;
    this._secondAcc = 0;
    this.ended = false;
    this.summary = { outcome: null, duration: 0, score: 0, kills: 0, level: 1, wave: 0 };

    this.subs
      .on(GameEvents.ENEMY_KILLED, () => this.summary.kills++)
      .on(GameEvents.SCORE_CHANGED, ({ score }) => (this.summary.score = score))
      .on(GameEvents.LEVEL_UP, ({ level }) => (this.summary.level = level))
      .on(GameEvents.WAVE_STARTED, ({ index }) => (this.summary.wave = index + 1))
      .on(GameEvents.PLAYER_DIED, () => this.end('defeat'))
      .on(GameEvents.ALL_WAVES_COMPLETED, () => this.end('victory'));
  }

  update(dt) {
    if (this.ended) return;
    this._world.time += dt;
    this._secondAcc += dt;
    while (this._secondAcc >= 1) {
      this._secondAcc -= 1;
      this.bus.emit(GameEvents.RUN_TICK, { elapsed: Math.floor(this._world.time) });
    }
  }

  end(outcome) {
    if (this.ended) return;
    this.ended = true;
    this.summary.outcome = outcome;
    this.summary.duration = Math.round(this._world.time * 10) / 10;
    this.bus.emit(GameEvents.RUN_ENDED, { ...this.summary });
  }
}
