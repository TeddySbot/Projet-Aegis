import { formatTime, h } from '../dom.js';
import { Screen } from './Screen.js';

const TITLES = {
  victory: ['Victoire !', 'Le Gardien déchu est tombé.'],
  defeat: ['Défaite', 'Les ombres vous ont submergé.'],
  abandon: ['Run abandonnée', 'Repli stratégique.'],
};

export class GameOverScreen extends Screen {
  constructor({ root }) {
    super({ root, className: 'overlay-screen gameover-screen' });
  }

  /**
   * @param {{ summary: any }} view
   * @param {{ onReplay: () => void, onMenu: () => void }} actions
   */
  render({ summary }, actions) {
    const [title, subtitle] = TITLES[summary.outcome] ?? TITLES.abandon;
    this.rewardEl = h('p.reward.pending', { text: 'Sauvegarde de la progression…' });
    this.el.replaceChildren(
      h('div.dialog.gameover.' + summary.outcome, {}, [
        h('h2', { text: title }),
        h('p.subtitle', { text: subtitle }),
        h('div.summary', {}, [
          item('Score', summary.score.toLocaleString('fr-FR')),
          item('Temps', formatTime(summary.duration)),
          item('Vague', String(summary.wave)),
          item('Niveau', String(summary.level)),
          item('Éliminations', String(summary.kills)),
        ]),
        this.rewardEl,
        h('div.actions', {}, [
          h('button.primary', { text: 'Rejouer', onclick: actions.onReplay }),
          h('button', { text: 'Menu / Sanctuaire', onclick: actions.onMenu }),
        ]),
      ]),
    );
  }

  showReward(reward, shards) {
    if (!this.rewardEl) return;
    this.rewardEl.className = 'reward';
    this.rewardEl.replaceChildren(h('span', { text: `+${reward} ◆ éclats` }), h('small', { text: ` (total : ${shards})` }));
  }

  showSaveError(message) {
    if (!this.rewardEl) return;
    this.rewardEl.className = 'reward error';
    this.rewardEl.textContent = `Progression non sauvegardée : ${message}`;
  }
}

const item = (label, value) => h('div', {}, [h('span', { text: label }), h('strong', { text: value })]);
