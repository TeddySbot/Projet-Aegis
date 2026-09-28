/**
 * Stats — valeurs de base + modificateurs empilables.
 *
 *   valeur = (base + Σ add) × (1 + Σ mul)
 *
 * Utilisé pour le joueur (vitesse, dégâts…) et pour chaque arme (cooldown, nombre
 * de projectiles…). Les améliorations de run ET les améliorations méta passent par
 * ce même mécanisme : aucune ne modifie directement un champ.
 */
export class Stats {
  /** @param {Record<string, number>} base */
  constructor(base) {
    this._base = { ...base };
    /** @type {{stat: string, op: 'add'|'mul', value: number, source?: string}[]} */
    this._modifiers = [];
    this._cache = new Map();
  }

  addModifier(mod) {
    if (!(mod.stat in this._base)) throw new Error(`Stat inconnue : ${mod.stat}`);
    this._modifiers.push(mod);
    this._cache.delete(mod.stat);
  }

  get(stat) {
    if (this._cache.has(stat)) return this._cache.get(stat);
    if (!(stat in this._base)) throw new Error(`Stat inconnue : ${stat}`);
    let add = 0;
    let mul = 0;
    for (const m of this._modifiers) {
      if (m.stat !== stat) continue;
      if (m.op === 'add') add += m.value;
      else mul += m.value;
    }
    const value = (this._base[stat] + add) * (1 + mul);
    this._cache.set(stat, value);
    return value;
  }

  has(stat) {
    return stat in this._base;
  }

  /** Instantané de toutes les valeurs effectives (debug / UI). */
  snapshot() {
    return Object.fromEntries(Object.keys(this._base).map((k) => [k, this.get(k)]));
  }
}
