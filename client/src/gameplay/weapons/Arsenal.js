import { GameEvents } from '../../core/events.js';
import { WeaponInstance } from './WeaponInstance.js';

/** Arsenal — instancie les armes à partir de leurs définitions (`weapons.json`). */
export class Arsenal {
  /** @param {{ bus: any, weapons: any[] }} deps */
  constructor({ bus, weapons }) {
    this._bus = bus;
    this._defs = new Map(weapons.map((w) => [w.id, w]));
  }

  grant(player, weaponId) {
    if (player.hasWeapon(weaponId)) return false;
    const def = this._defs.get(weaponId);
    if (!def) throw new Error(`Arme inconnue : ${weaponId}`);
    player.weapons.set(weaponId, new WeaponInstance(def));
    this._bus.emit(GameEvents.WEAPON_GRANTED, { weaponId, name: def.name });
    return true;
  }
}
