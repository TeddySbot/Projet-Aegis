import { GameEvents } from '../../core/events.js';
import { GameSystem } from './GameSystem.js';

const MAGNET_SPEED = 460;

/** Formule de la courbe d'XP (données : config.run.xpCurve). */
export function xpForLevel(level, curve) {
  return Math.floor(curve.base * Math.pow(curve.growth, level - 1) + (curve.flat ?? 0) * (level - 1));
}

/**
 * XpSystem — orbes d'expérience lâchés par les ennemis, aimantation, ramassage,
 * montée de niveau. Réagit à ENEMY_KILLED sans connaître le système de combat.
 */
export class XpSystem extends GameSystem {
  /**
   * @param {{ bus: any, world: import('../World.js').World, xpCurve: any, orbLifetime?: number }} deps
   */
  constructor({ bus, world, xpCurve, orbLifetime = 45 }) {
    super('xp', bus);
    this._world = world;
    this._curve = xpCurve;
    this._orbLifetime = orbLifetime;
    this.level = 1;
    this.xp = 0;
    this.xpToNext = xpForLevel(1, xpCurve);

    this.subs.on(GameEvents.ENEMY_KILLED, ({ x, y, xp }) => {
      if (xp > 0) this._spawnOrb(x, y, xp);
    });
  }

  _spawnOrb(x, y, value) {
    const orb = { id: this._world.nextId(), x, y, value, life: this._orbLifetime, magnet: false, dead: false };
    this._world.orbs.push(orb);
    this.bus.emit(GameEvents.XP_ORB_SPAWNED, { x, y, value });
  }

  update(dt) {
    const { player, orbs } = this._world;
    if (!player.alive) return;
    const pickup = player.stats.get('pickupRadius');
    const pickupSq = pickup * pickup;
    const collect = player.radius + 6;
    for (const orb of orbs) {
      if (orb.dead) continue;
      orb.life -= dt;
      if (orb.life <= 0) {
        orb.dead = true;
        continue;
      }
      const dx = player.x - orb.x;
      const dy = player.y - orb.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= pickupSq) orb.magnet = true;
      if (orb.magnet) {
        const d = Math.sqrt(d2) || 1;
        const step = Math.min(d, MAGNET_SPEED * dt);
        orb.x += (dx / d) * step;
        orb.y += (dy / d) * step;
        if (d <= collect) {
          orb.dead = true;
          this._gain(orb.value * player.stats.get('xpGain'));
        }
      }
    }
  }

  _gain(amount) {
    this.xp += amount;
    let leveled = 0;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level += 1;
      this.xpToNext = xpForLevel(this.level, this._curve);
      leveled += 1;
    }
    this.bus.emit(GameEvents.XP_GAINED, { amount, xp: this.xp, xpToNext: this.xpToNext, level: this.level });
    for (let i = leveled - 1; i >= 0; i--) this.bus.emit(GameEvents.LEVEL_UP, { level: this.level - i });
  }
}
