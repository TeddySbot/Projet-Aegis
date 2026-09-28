import { GameState } from '../core/StateMachine.js';

/** Menu principal + boutique de méta-progression. */
export class MenuState extends GameState {
  /** @param {{ screen: import('../presentation/screens/MenuScreen.js').MenuScreen, meta: import('../meta/MetaProgressionService.js').MetaProgressionService, hud: any, input: any }} deps */
  constructor({ screen, meta, hud, input }) {
    super('Menu');
    this._screen = screen;
    this._meta = meta;
    this._hud = hud;
    this._input = input;
  }

  enter() {
    this._hud.hide();
    this._render();
    this._screen.show();
    this._offKeys = this._input.onKey?.(['Enter'], (e) => {
      if (e.target?.tagName === 'BUTTON') return; // le bouton focalisé gère déjà Entrée
      this._start();
    });
  }

  exit() {
    this._offKeys?.();
    this._screen.hide();
  }

  _start() {
    this.machine.change('Playing');
  }

  _render(message) {
    this._screen.render(
      { profile: this._meta.profile, shop: this._meta.getShop(), storageLabel: this._meta.storageLabel, message },
      {
        onStart: () => this._start(),
        onBuy: async (id) => {
          try {
            await this._meta.purchase(id);
            this._render();
          } catch (err) {
            this._render(`Achat impossible : ${err.message}`);
          }
        },
        onReset: async () => {
          await this._meta.reset();
          this._render('Progression réinitialisée.');
        },
      },
    );
    this._screen.show();
  }
}
