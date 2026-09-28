/**
 * DebugOverlay (`?debug=1`) — FPS, pile d'états, entités, systèmes actifs, événements/s.
 * Utile pour visualiser l'architecture en fonctionnement.
 */
export class DebugOverlay {
  /** @param {{ root: HTMLElement, bus: any, machine: any, session: any }} deps */
  constructor({ root, bus, machine, session }) {
    this._el = document.createElement('pre');
    this._el.className = 'debug-overlay';
    root.append(this._el);
    this._machine = machine;
    this._session = session;
    this._frames = 0;
    this._acc = 0;
    this._fps = 0;
    this._events = 0;
    this._eps = 0;
    // Espionne le bus sans le modifier : on enveloppe emit.
    const emit = bus.emit.bind(bus);
    bus.emit = (e, p) => {
      this._events++;
      emit(e, p);
    };
  }

  frame(elapsed) {
    this._frames++;
    this._acc += elapsed;
    if (this._acc >= 0.5) {
      this._fps = Math.round(this._frames / this._acc);
      this._eps = Math.round(this._events / this._acc);
      this._frames = 0;
      this._events = 0;
      this._acc = 0;
      const run = this._session.run;
      const w = run?.world;
      this._el.textContent = [
        `FPS ${this._fps} · événements/s ${this._eps}`,
        `États : ${this._machine.stackNames.join(' › ')}`,
        w ? `Ennemis ${w.enemies.length} · projectiles ${w.projectiles.length} · orbes ${w.orbs.length}` : '',
        run ? `Systèmes : ${[...run.systems.keys()].join(', ')}` : '',
        run?.disabled.length ? `Désactivés : ${run.disabled.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
  }
}
