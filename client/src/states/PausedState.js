import { GameState } from '../core/StateMachine.js';

/** Pause : overlay empilé au-dessus de « En jeu » (la run est figée, pas détruite). */
export class PausedState extends GameState {
  constructor({ screen, session, input }) {
    super('Paused');
    this._screen = screen;
    this._session = session;
    this._input = input;
  }

  enter() {
    this._screen.render({ onResume: () => this._resume(), onAbandon: () => this._abandon() });
    this._screen.show();
    this._offKeys = this._input.onKey?.(['Escape', 'KeyP'], () => this._resume());
  }

  exit() {
    this._offKeys?.();
    this._screen.hide();
  }

  _resume() {
    if (this.machine.current === this) this.machine.pop();
  }

  _abandon() {
    // La run émet RUN_ENDED (outcome « abandon ») ; l'état En jeu enchaîne vers Game Over.
    this._session.abandon();
    this._resume();
  }
}
