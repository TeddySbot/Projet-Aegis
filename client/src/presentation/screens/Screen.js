/**
 * Base des écrans DOM (menus superposés au canvas). Un écran est une vue « bête » :
 * il affiche des données et remonte les intentions de l'utilisateur via des callbacks.
 * La logique de navigation appartient aux états (src/states).
 */
export class Screen {
  /** @param {{ root: HTMLElement, className: string }} options */
  constructor({ root, className }) {
    this.el = document.createElement('section');
    this.el.className = `screen ${className}`;
    this.el.hidden = true;
    root.append(this.el);
  }

  show() {
    this.el.hidden = false;
    // focus le premier bouton pour la navigation clavier
    queueMicrotask(() => this.el.querySelector('button:not([disabled])')?.focus({ preventScroll: true }));
  }

  hide() {
    this.el.hidden = true;
    this.el.replaceChildren();
  }
}
