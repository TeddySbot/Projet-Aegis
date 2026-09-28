import { h, formatTime } from '../dom.js';
import { Screen } from './Screen.js';

/** Menu principal : lancement de run, boutique de méta-progression, statistiques. */
export class MenuScreen extends Screen {
  constructor({ root }) {
    super({ root, className: 'menu-screen' });
  }

  /**
   * @param {{ profile: any, shop: any[], storageLabel: string, message?: string }} view
   * @param {{ onStart: () => void, onBuy: (id: string) => void, onReset: () => void }} actions
   */
  render(view, actions) {
    const { profile, shop, storageLabel, message } = view;
    const s = profile.stats;
    let resetArmed = false;
    const resetBtn = h('button.link-btn', {
      text: 'Réinitialiser la progression',
      onclick: () => {
        if (!resetArmed) {
          resetArmed = true;
          resetBtn.textContent = 'Cliquer à nouveau pour confirmer';
          return;
        }
        actions.onReset();
      },
    });

    this.el.replaceChildren(
      h('div.menu-layout', {}, [
        h('header.menu-title', {}, [
          h('div.logo', { text: '⛨' }),
          h('h1', { text: 'AEGIS' }),
          h('p.tagline', { text: 'Survivez aux vagues. Terrassez le Gardien déchu. Devenez plus fort à chaque run.' }),
          h('button.primary', { text: 'Lancer une run', onclick: actions.onStart }),
          h('p.controls', { text: 'Déplacement : ZQSD / WASD / flèches · Les armes tirent seules · Échap : pause' }),
        ]),
        h('div.menu-panel', {}, [
          h('div.panel-head', {}, [
            h('h2', { text: 'Sanctuaire' }),
            h('div.shards', { title: 'Éclats d\'Égide : monnaie persistante gagnée à chaque run' }, [h('span', { text: '◆ ' }), h('strong', { text: String(profile.shards) }), ' éclats']),
          ]),
          message ? h('p.menu-message', { text: message }) : null,
          h(
            'div.shop',
            {},
            shop.map((item) =>
              h('article.shop-item' + (item.cost === null ? '.maxed' : ''), {}, [
                h('div.shop-info', {}, [
                  h('h3', { text: item.name }),
                  h('p', { text: item.description }),
                  h('div.pips', {}, Array.from({ length: item.maxLevel }, (_, i) => h('span.pip' + (i < item.level ? '.on' : '')))),
                ]),
                h(
                  'button.buy',
                  {
                    disabled: !item.affordable,
                    onclick: () => actions.onBuy(item.id),
                    'aria-label': `Acheter ${item.name}`,
                  },
                  item.cost === null ? 'MAX' : [h('span', { text: '◆ ' }), String(item.cost)],
                ),
              ]),
            ),
          ),
          h('div.stats', {}, [
            stat('Runs', s.runs),
            stat('Victoires', s.victories),
            stat('Meilleur score', s.bestScore.toLocaleString('fr-FR')),
            stat('Plus longue survie', formatTime(s.bestTime)),
            stat('Éliminations', s.totalKills.toLocaleString('fr-FR')),
          ]),
          h('footer.menu-foot', {}, [h('span', { text: `Sauvegarde : ${storageLabel}` }), resetBtn]),
        ]),
      ]),
    );
  }
}

const stat = (label, value) => h('div.stat', {}, [h('span', { text: label }), h('strong', { text: String(value) })]);
