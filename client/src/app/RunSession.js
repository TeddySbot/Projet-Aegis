/**
 * RunSession — couche application : crée / détruit la run courante.
 *
 * Fait le pont entre la méta-progression (qui fournit des modificateurs de départ)
 * et le gameplay (qui les reçoit comme de simples données). Les états du jeu
 * (Playing, Pause, LevelUp…) passent par cette session au lieu de connaître
 * les détails de construction d'une run.
 */
import { Random } from '../core/Random.js';
import { Run } from '../gameplay/Run.js';

export class RunSession {
  /**
   * @param {{
   *   bus: any, content: any, input: any,
   *   getModifiers: () => { statModifiers: any[], startingWeapons: string[], weaponModifiers: any[] },
   *   disabledSystems?: string[], seed?: number | null,
   * }} deps
   */
  constructor({ bus, content, input, getModifiers, disabledSystems = [], seed = null }) {
    this._bus = bus;
    this._content = content;
    this._input = input;
    this._getModifiers = getModifiers;
    this._disabled = disabledSystems;
    this._fixedSeed = seed;
    /** @type {Run|null} */
    this.run = null;
  }

  get world() {
    return this.run?.world ?? null;
  }

  /** @param {string} [mode] mode de jeu (`story` | `endless`) */
  start(mode = 'story') {
    this.dispose();
    const seed = this._fixedSeed ?? Math.floor(Math.random() * 2 ** 31);
    this.run = new Run({
      content: this._content,
      bus: this._bus,
      input: this._input,
      rng: new Random(seed),
      seed,
      mode,
      modifiers: this._getModifiers(),
      disabled: this._disabled,
    });
    this.run.start();
    return this.run;
  }

  abandon() {
    if (this.run && !this.run.ended) this.run.abandon();
  }

  dispose() {
    this.run?.dispose();
    this.run = null;
  }
}
