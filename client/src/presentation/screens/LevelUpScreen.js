import { h } from '../dom.js';
import { Screen } from './Screen.js';

export class LevelUpScreen extends Screen {
  constructor({ root }) {
    super({ root, className: 'overlay-screen levelup-screen' });
  }

  /**
   * @param {{ level: number, choices: any[], stacks: (id: string) => number }} view
   * @param {{ onChoose: (id: string) => void }} actions
   */
  render({ level, choices, stacks }, { onChoose }) {
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
              h('span.stacks', { text: u.maxStacks > 1 ? `Niv. ${stacks(u.id) + 1} / ${u.maxStacks}` : 'Unique' }),
            ]),
          ),
        ),
      ]),
    );
  }
}
