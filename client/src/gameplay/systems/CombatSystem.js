import { GameEvents } from '../../core/events.js';
import { circlesOverlap } from '../../core/math.js';
import { GameSystem } from './GameSystem.js';

/**
 * CombatSystem — collisions : projectiles ↔ ennemis, ennemis ↔ joueur.
 * Émet PLAYER_DAMAGED / PLAYER_DIED ; les dégâts aux ennemis passent par le DamageResolver.
 */
export class CombatSystem extends GameSystem {
  /**
   * @param {{ bus: any, world: import('../World.js').World, damage: import('../DamageResolver.js').DamageResolver, runConfig: { invulnerabilityAfterHit: number } }} deps
   */
  constructor({ bus, world, damage, runConfig }) {
    super('combat', bus);
    this._world = world;
    this._damage = damage;
    this._iframes = runConfig.invulnerabilityAfterHit;
  }

  update(dt) {
    this._updateProjectiles(dt);
    this._enemyContacts();
  }

  _updateProjectiles(dt) {
    const { projectiles, enemies } = this._world;
    for (const p of projectiles) {
      if (p.dead) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        p.dead = true;
        continue;
      }
      for (const e of enemies) {
        if (e.dead || p.hit.has(e.id) || !circlesOverlap(p, p.radius, e, e.radius)) continue;
        p.hit.add(e.id);
        this._damage.damageEnemy(e, p.damage, { knockback: 60, from: p });
        if (p.hit.size >= p.pierce) {
          p.dead = true;
          break;
        }
      }
    }
  }

  _enemyContacts() {
    const { player, enemies } = this._world;
    if (!player.alive || player.invulnerable > 0) return;
    for (const e of enemies) {
      if (e.dead || !circlesOverlap(player, player.radius, e, e.radius)) continue;
      const amount = Math.max(1, Math.round(e.def.damage - player.stats.get('armor')));
      player.hp = Math.max(0, player.hp - amount);
      player.invulnerable = this._iframes;
      this.bus.emit(GameEvents.PLAYER_DAMAGED, { amount, hp: player.hp, maxHp: player.maxHp, source: e.typeId });
      if (player.hp <= 0) {
        player.alive = false;
        this.bus.emit(GameEvents.PLAYER_DIED, {});
      }
      return; // un seul coup par fenêtre d'invulnérabilité
    }
  }
}
