/**
 * Effets d'amélioration — pattern Stratégie indexé par `type` (voir `upgrades.json`).
 *
 * Une amélioration de run est une liste d'effets déclarés en données, par exemple :
 *   { "type": "stat", "stat": "might", "op": "mul", "value": 0.15 }
 *   { "type": "grantWeapon", "weapon": "nova" }
 * Ajouter un TYPE d'effet = une fonction ici + son nom dans shared/content/vocabulary.js.
 *
 * @typedef {{
 *   player: import('../entities/Player.js').Player,
 *   grantWeapon: (weaponId: string) => void,
 *   heal: (amount: number) => void,
 * }} EffectContext
 */

/** @type {Record<string, (effect: any, ctx: EffectContext, source: string) => void>} */
export const upgradeEffects = Object.freeze({
  stat(fx, { player }, source) {
    const before = player.maxHp;
    player.stats.addModifier({ stat: fx.stat, op: fx.op, value: fx.value, source });
    // Gagner des PV max augmente aussi les PV courants du même montant.
    if (fx.stat === 'maxHp') player.hp = Math.min(player.maxHp, player.hp + Math.max(0, player.maxHp - before));
  },

  heal(fx, { heal }) {
    heal(fx.amount);
  },

  grantWeapon(fx, { grantWeapon }) {
    grantWeapon(fx.weapon);
  },

  weaponStat(fx, { player }, source) {
    const weapon = player.weapons.get(fx.weapon);
    if (!weapon) return; // l'arme n'est pas possédée : l'effet est sans objet
    weapon.stats.addModifier({ stat: fx.stat, op: fx.op, value: fx.value, source });
  },
});
