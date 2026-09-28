import { formatTime, h } from '../dom.js';
import { Screen } from './Screen.js';

const TITLES = {
  victory: ['Victoire !', 'Le Gardien déchu est tombé.'],
  defeat: ['Défaite', 'Les ombres vous ont submergé.'],
  abandon: ['Run abandonnée', 'Repli stratégique.'],
};

/** Titre et sous-titre selon le mode et la cause de fin de run. */
function titleFor(summary) {
  if (summary.mode === 'endless') {
    if (summary.cause === 'bossTimeout') return ['Temps écoulé', `Le boss de la vague ${summary.wave} n'a pas été vaincu à temps.`];
    if (summary.outcome === 'defeat') return ['Défaite', `Les ombres vous ont submergé à la vague ${summary.wave}.`];
    return ['Run infinie abandonnée', `Repli à la vague ${summary.wave}.`];
  }
  return TITLES[summary.outcome] ?? TITLES.abandon;
}

export class GameOverScreen extends Screen {
  constructor({ root }) {
    super({ root, className: 'overlay-screen gameover-screen' });
  }

  /**
   * @param {{ summary: any }} view
   * @param {{ onReplay: () => void, onMenu: () => void }} actions
   */
  render({ summary }, actions) {
    const [title, subtitle] = titleFor(summary);
    const endless = summary.mode === 'endless';
    this._summary = summary;
    this.rewardEl = h('p.reward.pending', { text: 'Sauvegarde de la progression…' });
    this.recordEl = h('p.record');
    this.el.replaceChildren(
      h('div.dialog.gameover.' + summary.outcome + (endless ? '.endless' : ''), {}, [
        endless ? h('p.mode-tag', { text: '∞ Mode infini' }) : null,
        h('h2', { text: title }),
        h('p.subtitle', { text: subtitle }),
        this.recordEl,
        h('div.summary', {}, [
          item('Score', summary.score.toLocaleString('fr-FR')),
          item('Temps', formatTime(summary.duration)),
          item('Vague', String(summary.wave)),
          endless ? item('Boss vaincus', String(summary.bossKills ?? 0)) : null,
          item('Niveau', String(summary.level)),
          item('Éliminations', String(summary.kills)),
        ]),
        this.rewardEl,
        h('div.actions', {}, [
          h('button.primary', { text: endless ? 'Rejouer (infini)' : 'Rejouer', onclick: actions.onReplay }),
          h('button', { text: 'Menu / Sanctuaire', onclick: actions.onMenu }),
        ]),
      ]),
    );
  }

  showReward(reward, shards, newEndlessRecord = false) {
    if (!this.rewardEl) return;
    this.rewardEl.className = 'reward';
    this.rewardEl.replaceChildren(h('span', { text: `+${reward} ◆ éclats` }), h('small', { text: ` (total : ${shards})` }));
    if (newEndlessRecord && this.recordEl) this.recordEl.textContent = `★ Nouveau record : vague ${this._summary.wave} !`;
  }

  showSaveError(message) {
    if (!this.rewardEl) return;
    this.rewardEl.className = 'reward error';
    this.rewardEl.textContent = `Progression non sauvegardée : ${message}`;
  }
}

const item = (label, value) => h('div', {}, [h('span', { text: label }), h('strong', { text: value })]);
