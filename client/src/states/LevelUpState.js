import { GameEvents } from '../core/events.js';
import { GameState } from '../core/StateMachine.js';

/** Choix d'amélioration : overlay empilé au-dessus de « En jeu ». */
export class LevelUpState extends GameState {
  constructor({ screen, bus, input, session }) {
    super('LevelUp');
    this._screen = screen;
    this._bus = bus;
    this._input = input;
    this._session = session;
  }

  /** @param {{ level: number, choices: any[] }} offer */
  enter(offer) {
    this._choices = offer.choices;
    const upgrades = this._session.run?.system('upgrades');
    this._screen.render(
      { level: offer.level, choices: offer.choices, stacks: (id) => upgrades?.stacks.get(id) ?? 0 },
      { onChoose: (id) => this._choose(id) },
    );
    this._screen.show();
    // L'offre est résolue (par l'UI ou par l'autopilote) → on revient au jeu.
    this._offApplied = this._bus.on(GameEvents.UPGRADE_APPLIED, () => {
      if (this.machine.current === this) this.machine.pop();
    });
    this._offKeys = this._input.onKey?.(['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4'], (e) => {
      const index = Number(e.code.slice(-1)) - 1;
      if (this._choices[index]) this._choose(this._choices[index].id);
    });
  }

  exit() {
    this._offApplied();
    this._offKeys?.();
    this._screen.hide();
  }

  _choose(upgradeId) {
    this._bus.emit(GameEvents.UPGRADE_CHOSEN, { upgradeId });
  }
}
