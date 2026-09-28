/**
 * DamageResolver — point unique d'application des dégâts aux ennemis.
 *
 * Toutes les armes passent par ici : la formule (puissance, critiques, recul) n'est
 * écrite qu'une fois, et les événements ENEMY_DAMAGED / ENEMY_KILLED sont toujours
 * émis de la même manière. C'est un service de la run, pas un système : il n'a pas
 * de `update()`.
 */
import { GameEvents } from '../core/events.js';
import { normalize } from '../core/math.js';

export class DamageResolver {
  /**
   * @param {{ bus: import('../core/EventBus.js').EventBus, player: import('./entities/Player.js').Player, rng: import('../core/Random.js').Random }} deps
   */
  constructor({ bus, player, rng }) {
    this._bus = bus;
    this._player = player;
    this._rng = rng;
  }

  /**
   * @param {any} enemy
   * @param {number} baseDamage
   * @param {{ knockback?: number, from?: {x:number,y:number} }} [options]
   * @returns {boolean} true si l'ennemi est mort
   */
  damageEnemy(enemy, baseDamage, { knockback = 0, from } = {}) {
    if (enemy.dead) return false;
    const stats = this._player.stats;
    const critical = this._rng.next() < stats.get('critChance');
    const amount = Math.max(1, Math.round(baseDamage * stats.get('might') * (critical ? stats.get('critMultiplier') : 1)));
    enemy.hp -= amount;
    enemy.hitFlash = 0.1;

    if (knockback > 0 && from) {
      const resist = enemy.def.knockbackResistance ?? 0;
      const d = normalize(enemy.x - from.x, enemy.y - from.y);
      enemy.kx += d.x * knockback * (1 - resist);
      enemy.ky += d.y * knockback * (1 - resist);
    }

    this._bus.emit(GameEvents.ENEMY_DAMAGED, { enemy, amount, x: enemy.x, y: enemy.y, critical });

    if (enemy.hp <= 0) {
      enemy.dead = true;
      this._bus.emit(GameEvents.ENEMY_KILLED, {
        enemy,
        typeId: enemy.typeId,
        x: enemy.x,
        y: enemy.y,
        xp: enemy.xp,
        score: enemy.score,
        boss: enemy.boss,
      });
      return true;
    }
    return false;
  }
}
