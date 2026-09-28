/**
 * Fabrique d'ennemis à partir de leur définition de données (`enemies.json`).
 * Ajouter un type d'ennemi = ajouter une entrée JSON (et, si besoin, un comportement).
 *
 * Les caractéristiques de combat sont COPIÉES sur l'instance (pv, dégâts, vitesse,
 * taille, xp, score) afin qu'une vague puisse les multiplier (`scale`) sans toucher
 * à la définition partagée — c'est ainsi que le mode infini renforce ses ennemis.
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

  /**
   * @param {string} typeId
   * @param {number} x
   * @param {number} y
   * @param {{ scale?: { hp?: number, damage?: number, speed?: number, radius?: number, xp?: number, score?: number }, label?: string }} [options]
   */
  create(typeId, x, y, { scale = {}, label } = {}) {
    const def = this.getDef(typeId);
    const hp = Math.max(1, Math.round(def.hp * (scale.hp ?? 1)));
    return {
      id: this._world.nextId(),
      typeId,
      def,
      name: label ?? def.name,
      x,
      y,
      radius: def.radius * (scale.radius ?? 1),
      hp,
      maxHp: hp,
      speed: def.speed * (scale.speed ?? 1),
      damage: def.damage * (scale.damage ?? 1),
      xp: def.xp * (scale.xp ?? 1),
      score: Math.round(def.score * (scale.score ?? 1)),
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
