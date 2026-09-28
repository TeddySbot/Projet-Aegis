/**
 * ScriptedWaveProvider — source de vagues finie, lue telle quelle dans `waves.json`
 * (mode campagne). Interface commune des fournisseurs de vagues :
 *   total : number | null   (null = infini)
 *   get(index) : WaveDef | null   (null = plus de vague → fin de la run)
 */
export class ScriptedWaveProvider {
  /** @param {any[]} waves */
  constructor(waves) {
    this._waves = waves;
    this.total = waves.length;
  }

  get(index) {
    return this._waves[index] ?? null;
  }
}
