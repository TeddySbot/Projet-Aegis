import { h } from '../dom.js';
import { Screen } from './Screen.js';

export class LevelUpScreen extends Screen {
  constructor({ root }) {
    super({ root, className: 'overlay-screen levelup-screen' });
  }

  /**
   * @param {{ level: number, choices: any[], stacks: (id: string) => number, limit?: (u: any) => number }} view
   * @param {{ onChoose: (id: string) => void }} actions
   */
  render({ level, choices, stacks, limit = (u) => u.maxStacks }, { onChoose }) {
    this.el.replaceChildren(
      h('div.levelup', {}, [
        h('h2', { text: `Niveau ${level} !` }),
        h('p.hint', { text: 'Choisissez une amélioration (touches 1 à ' + choices.length + ')' }),
        h(
          'div.cards',
          {},
          choices.map((u, i) =>
            h('button.card', { onclick: () => onChoose(u.id), dataset: { upgrade: u.id } }, [
              h('span.key', { text: String(i + 1) }),
              h('span.icon', { text: u.icon ?? '✦' }),
              h('strong', { text: u.name }),
              h('span.desc', { text: u.description }),
              h('span.stacks', { text: stackLabel(stacks(u.id) + 1, limit(u)) }),
            ]),
          ),
        ),
      ]),
    );
  }
}

/** « Niv. 3 / 5 », « Niv. 12 · ∞ » (sans plafond, mode infini) ou « Unique ». */
function stackLabel(next, max) {
  if (max === 1) return 'Unique';
  return Number.isFinite(max) ? `Niv. ${next} / ${max}` : `Niv. ${next} · ∞`;
}
