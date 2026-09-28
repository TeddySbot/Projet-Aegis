/**
 * GameLoop — boucle à pas de temps fixe (« fix your timestep »).
 *
 * La logique avance par pas constants (`step`, 60 Hz par défaut) : le gameplay est
 * déterministe et indépendant du framerate. Le rendu reçoit un `alpha` d'interpolation.
 *
 * Le planificateur (`requestFrame`) et l'horloge (`now`) sont injectés : en test ou
 * en simulation headless on peut piloter la boucle manuellement via `tick()`.
 */
export class GameLoop {
  /**
   * @param {{
   *   update: (dt: number) => void,
   *   render: (alpha: number) => void,
   *   step?: number,
   *   maxFrame?: number,
   *   requestFrame?: (cb: (t: number) => void) => any,
   *   cancelFrame?: (id: any) => void,
   *   now?: () => number,
   * }} options
   */
  constructor({ update, render, step = 1 / 60, maxFrame = 0.25, requestFrame, cancelFrame, now }) {
    this._update = update;
    this._render = render;
    this.step = step;
    this._maxFrame = maxFrame;
    this._requestFrame = requestFrame ?? ((cb) => globalThis.requestAnimationFrame(cb));
    this._cancelFrame = cancelFrame ?? ((id) => globalThis.cancelAnimationFrame(id));
    this._now = now ?? (() => performance.now());
    this._acc = 0;
    this._last = 0;
    this._frameId = null;
    this.running = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._last = this._now();
    const frame = () => {
      if (!this.running) return;
      const t = this._now();
      this.tick((t - this._last) / 1000);
      this._last = t;
      this._frameId = this._requestFrame(frame);
    };
    this._frameId = this._requestFrame(frame);
  }

  stop() {
    this.running = false;
    if (this._frameId !== null) this._cancelFrame(this._frameId);
    this._frameId = null;
  }

  /** Avance la boucle de `elapsed` secondes réelles. */
  tick(elapsed) {
    // Borne haute : évite la « spirale de la mort » après un onglet en arrière-plan.
    this._acc += Math.min(Math.max(elapsed, 0), this._maxFrame);
    while (this._acc >= this.step) {
      this._update(this.step);
      this._acc -= this.step;
    }
    this._render(this._acc / this.step);
  }
}
