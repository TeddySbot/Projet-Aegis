import { h } from '../dom.js';
import { Screen } from './Screen.js';

/**
 * Sanctuaire : page dédiée aux améliorations permanentes (méta-progression).
 * Vue « bête » : affiche la boutique préparée par le MetaProgressionService et
 * remonte les intentions (achat, retour, réinitialisation) au SanctuaryState.
 */
export class SanctuaryScreen extends Screen {
  constructor({ root }) {
    super({ root, className: 'sanctuary-screen' });
  }

  /**
   * @param {{ profile: any, shop: any[], storageLabel: string, message?: { text: string, kind?: string }, highlight?: string }} view
   * @param {{ onBack: () => void, onBuy: (id: string) => void, onReset: () => void }} actions
   */
  render({ profile, shop, storageLabel, message, highlight }, actions) {
    const totalLevels = shop.reduce((n, item) => n + item.maxLevel, 0);
    const ownedLevels = shop.reduce((n, item) => n + item.level, 0);

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
      h('div.sanctuary-page', {}, [
        h('header.sanctuary-head', {}, [
          h('button.back-btn', { onclick: actions.onBack, 'aria-label': 'Retour au menu' }, [h('span', { text: '←' }), ' Retour']),
          h('div.sanctuary-title', {}, [
            h('h1', { text: 'Sanctuaire' }),
            h('p', { text: 'Dépensez vos éclats d’Égide : ces bonus s’appliquent au début de chaque run, dans tous les modes.' }),
          ]),
          h('div.sanctuary-wallet', {}, [
            h('span.wallet-label', { text: 'Éclats' }),
            h('strong', {}, [h('span', { text: '◆ ' }), (profile.shards ?? 0).toLocaleString('fr-FR')]),
            h('div.wallet-progress', { title: `${ownedLevels} / ${totalLevels} niveaux achetés` }, [
              h('div', { style: { width: `${totalLevels ? (ownedLevels / totalLevels) * 100 : 0}%` } }),
            ]),
            h('small', { text: `${ownedLevels} / ${totalLevels} niveaux` }),
          ]),
        ]),
        message ? h(`p.sanctuary-message.${message.kind ?? 'ok'}`, { text: message.text, role: 'status' }) : null,
        h('div.upgrade-grid', {}, shop.map((item) => upgradeCard(item, item.id === highlight, actions.onBuy))),
        h('footer.sanctuary-foot', {}, [
          h('span', { text: `Échap : retour · Sauvegarde : ${storageLabel}` }),
          resetBtn,
        ]),
      ]),
    );
  }
}

function upgradeCard(item, justBought, onBuy) {
  const maxed = item.cost === null;
  const cls = ['upgrade-card', maxed ? 'maxed' : '', item.affordable ? 'affordable' : '', justBought ? 'just-bought' : ''].filter(Boolean).join('.');
  return h(`article.${cls}`, {}, [
    h('div.upgrade-top', {}, [
      h('span.upgrade-icon', { text: item.icon ?? '✧', 'aria-hidden': 'true' }),
      h('span.upgrade-level', { text: maxed ? 'MAX' : `Niv. ${item.level} / ${item.maxLevel}` }),
    ]),
    h('h3', { text: item.name }),
    h('p', { text: item.description }),
    h('div.pips', {}, Array.from({ length: item.maxLevel }, (_, i) => h('span.pip' + (i < item.level ? '.on' : '')))),
    h(
      'button.buy',
      { disabled: !item.affordable, onclick: () => onBuy(item.id), 'aria-label': maxed ? `${item.name} : niveau maximum` : `Acheter ${item.name}` },
      maxed ? 'Niveau maximum' : [h('span', { text: 'Acheter · ◆ ' }), String(item.cost)],
    ),
  ]);
}
