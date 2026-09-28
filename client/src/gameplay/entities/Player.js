import { Stats } from '../Stats.js';

/**
 * Entité joueur. Ses statistiques sont construites à partir des données
 * (`player.json`) puis des modificateurs de méta-progression reçus en paramètre.
 */
export class Player {
  /**
   * @param {{ def: any, modifiers?: { statModifiers: any[] } }} options
   */
  constructor({ def, modifiers }) {
    this.x = 0;
    this.y = 0;
    this.radius = def.radius;
    this.color = def.color ?? '#5ee7ff';
    this.stats = new Stats(def.baseStats);
    for (const mod of modifiers?.statModifiers ?? []) this.stats.addModifier(mod);
    this.hp = this.maxHp;
    this.invulnerable = 0;
    this.facing = { x: 1, y: 0 };
    this.moving = false;
    this.alive = true;
    /** @type {Map<string, import('../weapons/WeaponInstance.js').WeaponInstance>} */
    this.weapons = new Map();
  }

  get maxHp() {
    return Math.max(1, Math.round(this.stats.get('maxHp')));
  }

  hasWeapon(id) {
    return this.weapons.has(id);
  }
}
