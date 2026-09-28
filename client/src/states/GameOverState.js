import { GameEvents } from '../core/events.js';
import { SubscriptionGroup } from '../core/EventBus.js';
import { GameState } from '../core/StateMachine.js';

/** Fin de run : résumé + récompense de méta-progression (arrive de façon asynchrone). */
export class GameOverState extends GameState {
  constructor({ screen, bus, meta, input }) {
    super('GameOver');
    this._screen = screen;
    this._bus = bus;
    this._meta = meta;
    this._input = input;
  }

  /** @param {any} summary résumé émis avec RUN_ENDED */
  enter(summary) {
    this._screen.render({ summary }, { onReplay: () => this.machine.change('Playing'), onMenu: () => this.machine.change('Menu') });
    this._screen.show();

    this._subs = new SubscriptionGroup(this._bus)
      .on(GameEvents.META_RUN_RECORDED, ({ run, reward, profile }) => {
        if (run === summary) this._screen.showReward(reward, profile.shards);
      })
      .on(GameEvents.META_SAVE_FAILED, ({ message }) => this._screen.showSaveError(message));
    // Si la sauvegarde a déjà abouti avant l'entrée dans l'état :
    if (this._meta.lastResult?.run === summary) this._screen.showReward(this._meta.lastResult.reward, this._meta.profile.shards);

    this._offKeys = this._input.onKey?.(['Escape'], () => this.machine.change('Menu'));
  }

  exit() {
    this._subs.dispose();
    this._offKeys?.();
    this._screen.hide();
  }
}
