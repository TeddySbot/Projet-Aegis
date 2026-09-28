/**
 * MetaProgressionService — progression persistante ENTRE les runs.
 *
 * Découplage avec le gameplay :
 *  - en entrée, il n'écoute qu'un événement : RUN_ENDED (résumé de run) ;
 *  - en sortie, il ne fournit que des données : `getRunModifiers()`
 *    (modificateurs de stats + armes de départ) consommées à la création d'une run.
 * Le gameplay ignore totalement l'existence de ce service, et ce service ignore
 * tout des systèmes de gameplay.
 *
 * Le stockage est abstrait derrière un dépôt (serveur HTTP ou local).
 */
import { GameEvents } from '../core/events.js';
import { computeRunModifiers, createEmptyProfile, nextCost, upgradeLevel } from '../../../shared/meta/metaRules.js';

export class MetaProgressionService {
  /**
   * @param {{ bus: import('../core/EventBus.js').EventBus, repository: any, catalog: any[] }} deps
   */
  constructor({ bus, repository, catalog }) {
    this._bus = bus;
    this._repo = repository;
    this.catalog = catalog;
    this.profile = createEmptyProfile();
    this.lastResult = null;
    this._unsub = bus.on(GameEvents.RUN_ENDED, (summary) => this.recordRun(summary));
  }

  get storageLabel() {
    return this._repo.label ?? 'inconnu';
  }

  async load() {
    this.profile = await this._repo.load();
    this._bus.emit(GameEvents.PROFILE_UPDATED, { profile: this.profile });
    return this.profile;
  }

  /** Modificateurs de départ issus des améliorations achetées. */
  getRunModifiers() {
    return computeRunModifiers(this.profile, this.catalog);
  }

  /** Vue prête à afficher de la boutique méta. */
  getShop() {
    return this.catalog.map((m) => {
      const level = upgradeLevel(this.profile, m.id);
      const cost = nextCost(this.profile, m);
      return { ...m, level, maxLevel: m.costs.length, cost, affordable: cost !== null && this.profile.shards >= cost };
    });
  }

  async recordRun(summary) {
    // Lu AVANT l'enregistrement : permet d'annoncer un nouveau record du mode infini.
    const previousBest = this.profile.stats?.bestEndlessWave ?? 0;
    try {
      const { profile, reward } = await this._repo.recordRun(summary);
      this.profile = profile;
      const newEndlessRecord = summary.mode === 'endless' && summary.wave > previousBest;
      this.lastResult = { run: summary, reward, newEndlessRecord };
      this._bus.emit(GameEvents.META_RUN_RECORDED, { run: summary, reward, profile, newEndlessRecord });
      this._bus.emit(GameEvents.PROFILE_UPDATED, { profile });
    } catch (err) {
      this._bus.emit(GameEvents.META_SAVE_FAILED, { message: String(err?.message ?? err) });
    }
  }

  async purchase(upgradeId) {
    this.profile = await this._repo.purchase(upgradeId);
    this._bus.emit(GameEvents.PROFILE_UPDATED, { profile: this.profile });
    return this.profile;
  }

  async reset() {
    this.profile = await this._repo.reset();
    this._bus.emit(GameEvents.PROFILE_UPDATED, { profile: this.profile });
  }

  dispose() {
    this._unsub();
  }
}
