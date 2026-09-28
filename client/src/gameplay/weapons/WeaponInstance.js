import { Stats } from '../Stats.js';

/**
 * Instance d'arme possédée par le joueur : définition (données) + stats modifiables
 * + état d'exécution propre au type d'arme (`runtime`).
 */
export class WeaponInstance {
  constructor(def) {
    this.id = def.id;
    this.def = def;
    this.kind = def.kind;
    this.stats = new Stats(def.stats);
    this.cooldownLeft = 0;
    /** état libre utilisé par la stratégie de l'arme (positions des lames…) */
    this.runtime = {};
  }
}
