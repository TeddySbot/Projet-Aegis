/**
 * Fabrique d'ennemis à partir de leur définition de données (`enemies.json`).
 * Ajouter un type d'ennemi = ajouter une entrée JSON (et, si besoin, un comportement).
 */
export class EnemyFactory {
  /** @param {{ enemies: any[], world: import('../World.js').World }} deps */
  constructor({ enemies, world }) {
    this._defs = new Map(enemies.map((e) => [e.id, e]));
    this._world = world;
  }

  getDef(typeId) {
    const def = this._defs.get(typeId);
    if (!def) throw new Error(`Type d'ennemi inconnu : ${typeId}`);
    return def;
  }

  create(typeId, x, y) {
    const def = this.getDef(typeId);
    return {
      id: this._world.nextId(),
      typeId,
      def,
      x,
      y,
      radius: def.radius,
      hp: def.hp,
      maxHp: def.hp,
      speed: def.speed,
      color: def.color,
      boss: Boolean(def.boss),
      // vitesse de recul (knockback) qui s'amortit
      kx: 0,
      ky: 0,
      hitFlash: 0,
      dead: false,
      /** mémoire propre au comportement (charge, zigzag…) */
      brain: {},
    };
  }
}
