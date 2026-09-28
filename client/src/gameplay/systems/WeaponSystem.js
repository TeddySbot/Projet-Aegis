import { GameSystem } from './GameSystem.js';

/**
 * WeaponSystem — fait fonctionner chaque arme possédée par le joueur via la
 * stratégie correspondant à son `kind`.
 */
export class WeaponSystem extends GameSystem {
  /**
   * @param {{ bus: any, world: import('../World.js').World, damage: import('../DamageResolver.js').DamageResolver, rng: any, weaponKinds: Record<string, {update: Function}> }} deps
   */
  constructor({ bus, world, damage, rng, weaponKinds }) {
    super('weapons', bus);
    this._world = world;
    this._kinds = weaponKinds;
    this._ctx = { world, player: world.player, damage, rng, emit: (e, p) => bus.emit(e, p) };
  }

  update(dt) {
    if (!this._world.player.alive) return;
    for (const weapon of this._world.player.weapons.values()) this._kinds[weapon.kind].update(weapon, this._ctx, dt);
  }
}
