/**
 * World — état mutable d'UNE run (entités et temps).
 *
 * Simple conteneur de données : aucune logique de jeu ici. Les systèmes le lisent et
 * le modifient ; la couche présentation le lit uniquement (rendu).
 */
export class World {
  constructor() {
    /** @type {import('./entities/Player.js').Player|null} */
    this.player = null;
    /** @type {any[]} */
    this.enemies = [];
    /** @type {any[]} */
    this.projectiles = [];
    /** @type {any[]} */
    this.orbs = [];
    this.time = 0;
    this._nextId = 1;
  }

  nextId() {
    return this._nextId++;
  }

  /** Retire les entités marquées comme mortes / expirées. Appelé en fin de pas. */
  compact() {
    if (this.enemies.some((e) => e.dead)) this.enemies = this.enemies.filter((e) => !e.dead);
    if (this.projectiles.some((p) => p.dead)) this.projectiles = this.projectiles.filter((p) => !p.dead);
    if (this.orbs.some((o) => o.dead)) this.orbs = this.orbs.filter((o) => !o.dead);
  }
}
