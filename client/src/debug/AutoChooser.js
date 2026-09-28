import { GameEvents } from '../core/events.js';

/**
 * AutoChooser — choisit automatiquement une amélioration après un court délai
 * (mode démo `?autopilot=1`). Remplace l'humain sans que le gameplay le sache.
 */
export class AutoChooser {
  /** @param {{ bus: any, delayMs?: number, schedule?: (fn: Function, ms: number) => any }} deps */
  constructor({ bus, delayMs = 700, schedule = (fn, ms) => setTimeout(fn, ms) }) {
    this._off = bus.on(GameEvents.UPGRADE_CHOICES_OFFERED, ({ choices }) => {
      const pick = choices.find((c) => c.effects.some((fx) => fx.type === 'grantWeapon')) ?? choices[0];
      schedule(() => bus.emit(GameEvents.UPGRADE_CHOSEN, { upgradeId: pick.id }), delayMs);
    });
  }

  dispose() {
    this._off();
  }
}
