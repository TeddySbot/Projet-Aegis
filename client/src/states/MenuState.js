import { GameState } from '../core/StateMachine.js';

/**
 * Écran titre : choix du mode de jeu (campagne / infini), accès au Sanctuaire
 * (améliorations permanentes, état séparé) et statistiques du profil.
 */
export class MenuState extends GameState {
  /**
   * @param {{ screen: import('../presentation/screens/MenuScreen.js').MenuScreen,
   *   meta: import('../meta/MetaProgressionService.js').MetaProgressionService,
   *   hud: any, input: any, modes: ReturnType<typeof import('../app/modeSummaries.js').describeModes> }} deps
   */
  constructor({ screen, meta, hud, input, modes }) {
    super('Menu');
    this._screen = screen;
    this._meta = meta;
    this._hud = hud;
    this._input = input;
    this._modes = modes;
  }

  enter() {
    this._hud.hide();
    const shop = this._meta.getShop();
    this._screen.render(
      {
        profile: this._meta.profile,
        storageLabel: this._meta.storageLabel,
        modes: this._modes,
        affordable: shop.filter((item) => item.affordable).length,
      },
      {
        onStart: (mode) => this._start(mode),
        onOpenSanctuary: () => this.machine.change('Sanctuary'),
      },
    );
    this._screen.show();
    this._offKeys = this._input.onKey?.(['Enter', 'KeyI', 'KeyS'], (e) => {
      if (e.code === 'Enter' && e.target?.tagName === 'BUTTON') return; // le bouton focalisé gère déjà Entrée
      if (e.code === 'KeyS') this.machine.change('Sanctuary');
      else this._start(e.code === 'KeyI' ? 'endless' : 'story');
    });
  }

  exit() {
    this._offKeys?.();
    this._screen.hide();
  }

  /** @param {'story'|'endless'} mode */
  _start(mode) {
    this.machine.change('Playing', { mode });
  }
}
