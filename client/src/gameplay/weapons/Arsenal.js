import { GameEvents } from '../../core/events.js';
import { WeaponInstance } from './WeaponInstance.js';

/**
 * Arsenal — instancie les armes à partir de leurs définitions (`weapons.json`).
 *
 * Les modificateurs d'arme issus de la méta-progression (`weaponModifiers`, données
 * pures) sont appliqués à chaque instanciation : une arme obtenue en cours de run
 * profite donc aussi de ses bonus permanents.
 */
export class Arsenal {
  /** @param {{ bus: any, weapons: any[], weaponModifiers?: {weapon: string, stat: string, op: 'add'|'mul', value: number, source?: string}[] }} deps */
  constructor({ bus, weapons, weaponModifiers = [] }) {
    this._bus = bus;
    this._defs = new Map(weapons.map((w) => [w.id, w]));
    this._weaponModifiers = weaponModifiers;
  }

  grant(player, weaponId) {
    if (player.hasWeapon(weaponId)) return false;
    const def = this._defs.get(weaponId);
    if (!def) throw new Error(`Arme inconnue : ${weaponId}`);
    const weapon = new WeaponInstance(def);
    for (const { weapon: target, ...mod } of this._weaponModifiers) {
      if (target === weaponId && weapon.stats.has(mod.stat)) weapon.stats.addModifier(mod);
    }
    player.weapons.set(weaponId, weapon);
    this._bus.emit(GameEvents.WEAPON_GRANTED, { weaponId, name: def.name });
    return true;
  }
}
