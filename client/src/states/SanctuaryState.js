import { GameState } from '../core/StateMachine.js';

/**
 * Sanctuaire : boutique des améliorations PERMANENTES (méta-progression), sur sa
 * propre page. Accessible depuis le menu ; Échap ou « Retour » y ramène.
 * Toute la logique d'achat est dans le MetaProgressionService (serveur autoritaire).
 */
export class SanctuaryState extends GameState {
  /**
   * @param {{ screen: import('../presentation/screens/SanctuaryScreen.js').SanctuaryScreen,
   *   meta: import('../meta/MetaProgressionService.js').MetaProgressionService, input: any }} deps
   */
  constructor({ screen, meta, input }) {
    super('Sanctuary');
    this._screen = screen;
    this._meta = meta;
    this._input = input;
  }

  enter() {
    this._render();
    this._screen.show();
    this._offKeys = this._input.onKey?.(['Escape', 'Backspace'], () => this._back());
  }

  exit() {
    this._offKeys?.();
    this._screen.hide();
  }

  _back() {
    if (this.machine.current === this) this.machine.change('Menu');
  }

  /** @param {{ text: string, kind?: 'ok'|'error' }} [message] @param {string} [highlight] amélioration juste achetée */
  _render(message, highlight) {
    this._screen.render(
      { profile: this._meta.profile, shop: this._meta.getShop(), storageLabel: this._meta.storageLabel, message, highlight },
      {
        onBack: () => this._back(),
        onBuy: async (id) => {
          try {
            await this._meta.purchase(id);
            const item = this._meta.getShop().find((s) => s.id === id);
            this._render({ text: `${item?.name ?? id} : niveau ${item?.level} atteint.`, kind: 'ok' }, id);
          } catch (err) {
            this._render({ text: `Achat impossible : ${err.message}`, kind: 'error' });
          }
        },
        onReset: async () => {
          await this._meta.reset();
          this._render({ text: 'Progression réinitialisée.', kind: 'ok' });
        },
      },
    );
  }
}
