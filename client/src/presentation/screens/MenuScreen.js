import { h, formatTime } from '../dom.js';
import { Screen } from './Screen.js';

/**
 * Écran titre : les deux modes de jeu présentés côte à côte (campagne / infini),
 * accès au Sanctuaire et statistiques du profil. Vue « bête » : aucune logique de
 * navigation, uniquement des callbacks fournis par le MenuState.
 */
export class MenuScreen extends Screen {
  constructor({ root }) {
    super({ root, className: 'menu-screen' });
  }

  /**
   * @param {{ profile: any, storageLabel: string, affordable: number,
   *   modes: ReturnType<typeof import('../../app/modeSummaries.js').describeModes> }} view
   * @param {{ onStart: (mode: 'story'|'endless') => void, onOpenSanctuary: () => void }} actions
   */
  render(view, actions) {
    const { profile, storageLabel, affordable, modes } = view;
    const s = profile.stats;
    const fr = (n) => Number(n ?? 0).toLocaleString('fr-FR');

    const story = modeCard({
      theme: 'story',
      icon: '⛨',
      kicker: 'Campagne',
      title: 'Le siège d’Égide',
      text: `Survivez à ${modes.story.waves} vagues, puis abattez le boss final${modes.story.bossName ? ` : ${modes.story.bossName}` : ''}. Une run courte et complète.`,
      facts: [`${modes.story.waves} vagues`, `Boss : ${modes.story.bossName ?? '—'}`, `≈ ${modes.story.minutes} min`],
      records: [
        ['Victoires', fr(s.victories)],
        ['Meilleur score', fr(s.bestScore)],
      ],
      button: 'Lancer la campagne',
      key: 'Entrée',
      onPlay: () => actions.onStart('story'),
    });

    const e = modes.endless;
    const endless = modeCard({
      theme: 'endless',
      icon: '∞',
      kicker: 'Mode infini',
      title: 'L’Ascension sans fin',
      text: e.description,
      facts: [
        `Vagues de ${e.waveDuration} s`,
        `Boss toutes les ${e.bossEvery} vagues`,
        `${formatTime(e.bossTimeLimit)} pour l’abattre`,
        e.uncapped ? 'Améliorations sans limite' : null,
      ],
      records: [
        ['Record', s.bestEndlessWave ? `Vague ${s.bestEndlessWave}` : '—'],
        ['Boss vaincus', fr(s.endlessBossKills)],
      ],
      button: 'Entrer dans l’infini',
      key: 'I',
      onPlay: () => actions.onStart('endless'),
    });

    this.el.replaceChildren(
      h('div.title-page', {}, [
        h('header.hero', {}, [
          h('div.logo', { text: '⛨', 'aria-hidden': 'true' }),
          h('h1', { text: 'AEGIS' }),
          h('p.tagline', { text: 'Tenez la ligne face aux ombres. Chaque run vous rend plus fort.' }),
        ]),
        h('div.mode-grid', {}, [story, endless]),
        h('div.menu-bar', {}, [
          h('button.sanctuary-btn', { onclick: actions.onOpenSanctuary, 'aria-label': 'Ouvrir le Sanctuaire' }, [
            h('span.sanctuary-icon', { text: '✧' }),
            h('span.sanctuary-label', {}, [h('strong', { text: 'Sanctuaire' }), h('small', { text: 'Améliorations permanentes' })]),
            h('span.shards-pill', {}, [h('span', { text: '◆' }), h('strong', { text: fr(profile.shards) })]),
            affordable > 0 ? h('span.badge', { text: String(affordable), title: `${affordable} amélioration(s) achetable(s)` }) : null,
          ]),
          h('div.profile-stats', {}, [
            stat('Runs', fr(s.runs)),
            stat('Éliminations', fr(s.totalKills)),
            stat('Plus longue survie', formatTime(s.bestTime)),
          ]),
        ]),
        h('footer.title-foot', {}, [
          h('span', { text: 'ZQSD / WASD / flèches · les armes tirent seules · Échap : pause · S : Sanctuaire' }),
          h('span', { text: `Sauvegarde : ${storageLabel}` }),
        ]),
      ]),
    );
  }
}

function modeCard({ theme, icon, kicker, title, text, facts, records, button, key, onPlay }) {
  return h(`article.mode-card.${theme}`, {}, [
    h('div.mode-glow', { 'aria-hidden': 'true' }),
    h('div.mode-head', {}, [
      h('span.mode-icon', { text: icon, 'aria-hidden': 'true' }),
      h('div', {}, [h('p.mode-kicker', { text: kicker }), h('h2', { text: title })]),
    ]),
    h('p.mode-text', { text }),
    h('ul.mode-facts', {}, facts.filter(Boolean).map((f) => h('li', { text: f }))),
    h('div.mode-records', {}, records.map(([label, value]) => h('div', {}, [h('span', { text: label }), h('strong', { text: value })]))),
    h('button.mode-play', { onclick: onPlay }, [h('span', { text: button }), h('kbd', { text: key })]),
  ]);
}

const stat = (label, value) => h('div.stat', {}, [h('span', { text: label }), h('strong', { text: String(value) })]);
