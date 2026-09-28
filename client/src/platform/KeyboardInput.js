/**
 * KeyboardInput — lit le clavier du navigateur.
 *
 * Utilise `event.code` (position physique) : WASD sur QWERTY = ZQSD sur AZERTY.
 * Expose l'interface d'entrée attendue par le gameplay (`getMoveVector`) et un
 * mécanisme d'abonnement aux touches d'action pour l'UI (`onKey`).
 */
const MOVE = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

export class KeyboardInput {
  /** @param {{ target?: EventTarget }} [options] */
  constructor({ target = window } = {}) {
    this._down = new Set();
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
    this._onKeyDown = (e) => {
      if (MOVE[e.code] || e.code === 'Space') e.preventDefault();
      if (!e.repeat) for (const fn of [...(this._listeners.get(e.code) ?? [])]) fn(e);
      this._down.add(e.code);
    };
    this._onKeyUp = (e) => this._down.delete(e.code);
    this._onBlur = () => this._down.clear();
    target.addEventListener('keydown', this._onKeyDown);
    target.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
  }

  getMoveVector() {
    let x = 0;
    let y = 0;
    for (const code of this._down) {
      const m = MOVE[code];
      if (m) {
        x += m[0];
        y += m[1];
      }
    }
    return { x: Math.sign(x), y: Math.sign(y) };
  }

  /**
   * @param {string[]} codes
   * @param {(e: KeyboardEvent) => void} handler
   * @returns {() => void} désabonnement
   */
  onKey(codes, handler) {
    for (const code of codes) {
      if (!this._listeners.has(code)) this._listeners.set(code, new Set());
      this._listeners.get(code).add(handler);
    }
    return () => codes.forEach((c) => this._listeners.get(c)?.delete(handler));
  }
}
