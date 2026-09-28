import { h } from '../dom.js';
import { Screen } from './Screen.js';

export class PauseScreen extends Screen {
  constructor({ root }) {
    super({ root, className: 'overlay-screen pause-screen' });
  }

  /** @param {{ onResume: () => void, onAbandon: () => void }} actions */
  render(actions) {
    this.el.replaceChildren(
      h('div.dialog', {}, [
        h('h2', { text: 'Pause' }),
        h('button.primary', { text: 'Reprendre', onclick: actions.onResume }),
        h('button', { text: 'Abandonner la run', onclick: actions.onAbandon }),
        h('p.hint', { text: 'Échap pour reprendre' }),
      ]),
    );
  }
}
