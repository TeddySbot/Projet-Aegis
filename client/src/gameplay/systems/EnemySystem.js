import { GameSystem } from './GameSystem.js';

const KNOCKBACK_DAMPING = 8;
const SEPARATION_STRENGTH = 60;

/**
 * EnemySystem — déplacement des ennemis via leur stratégie de comportement,
 * recul, séparation (évite l'empilement) et recyclage des ennemis trop éloignés.
 */
export class EnemySystem extends GameSystem {
  /**
   * @param {{
   *   bus: any, world: import('../World.js').World,
   *   behaviors: Record<string, Function>,
   *   rng: import('../../core/Random.js').Random,
   *   runConfig: { despawnRadius: number, spawnRadius: {min: number, max: number} },
   * }} deps
   */
  constructor({ bus, world, behaviors, rng, runConfig }) {
    super('enemies', bus);
    this._world = world;
    this._behaviors = behaviors;
    this._rng = rng;
    this._cfg = runConfig;
    this._emit = (event, payload) => bus.emit(event, payload);
  }

  update(dt) {
    const { enemies, player, time } = this._world;
    const ctx = { player, time, emit: this._emit };
    const despawnSq = this._cfg.despawnRadius ** 2;

    for (const e of enemies) {
      if (e.dead) continue;
      const behavior = this._behaviors[e.def.behavior];
      const v = behavior(e, ctx, dt);
      e.x += (v.vx + e.kx) * dt;
      e.y += (v.vy + e.ky) * dt;
      const damp = Math.exp(-KNOCKBACK_DAMPING * dt);
      e.kx *= damp;
      e.ky *= damp;
      if (e.hitFlash > 0) e.hitFlash -= dt;

      // Un ennemi semé loin derrière réapparaît devant : la pression reste constante.
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      if (!e.boss && dx * dx + dy * dy > despawnSq) {
        const a = this._rng.range(0, Math.PI * 2);
        e.x = player.x + Math.cos(a) * this._cfg.spawnRadius.min;
        e.y = player.y + Math.sin(a) * this._cfg.spawnRadius.min;
      }
    }
    this._separate(enemies, dt);
  }

  /** Répulsion douce entre ennemis qui se chevauchent (O(n²), suffisant pour ~250 entités). */
  _separate(enemies, dt) {
    const n = enemies.length;
    for (let i = 0; i < n; i++) {
      const a = enemies[i];
      for (let j = i + 1; j < n; j++) {
        const b = enemies[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = a.radius + b.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const push = ((min - d) / min) * SEPARATION_STRENGTH * dt;
        const nx = dx / d;
        const ny = dy / d;
        // les boss (et gros ennemis) sont moins déplacés
        const wa = b.radius / min;
        const wb = a.radius / min;
        a.x -= nx * push * wa * 2;
        a.y -= ny * push * wa * 2;
        b.x += nx * push * wb * 2;
        b.y += ny * push * wb * 2;
      }
    }
  }
}
