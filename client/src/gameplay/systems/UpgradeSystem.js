import { GameEvents } from '../../core/events.js';
import { GameSystem } from './GameSystem.js';

/**
 * UpgradeSystem — à chaque LEVEL_UP, propose N améliorations tirées (pondérées)
 * parmi celles éligibles dans `upgrades.json`, puis applique celle choisie
 * (UPGRADE_CHOSEN, émis par l'UI ou par une IA) via le registre d'effets.
 *
 * Plusieurs montées de niveau simultanées sont mises en file : une offre à la fois.
 */
export class UpgradeSystem extends GameSystem {
  /**
   * @param {{
   *   bus: any, player: import('../entities/Player.js').Player, upgrades: any[],
   *   rng: import('../../core/Random.js').Random, choiceCount: number,
   *   effects: Record<string, Function>,
   *   arsenal: import('../weapons/Arsenal.js').Arsenal,
   * }} deps
   */
  constructor({ bus, player, upgrades, rng, choiceCount, effects, arsenal }) {
    super('upgrades', bus);
    this._player = player;
    this._upgrades = upgrades;
    this._rng = rng;
    this._choiceCount = choiceCount;
    this._effects = effects;
    this._effectCtx = {
      player,
      grantWeapon: (id) => arsenal.grant(player, id),
      heal: (amount) => {
        const healed = Math.min(amount, player.maxHp - player.hp);
        if (healed <= 0) return;
        player.hp += healed;
        bus.emit(GameEvents.PLAYER_HEALED, { amount: healed, hp: player.hp, maxHp: player.maxHp });
      },
    };
    /** @type {Map<string, number>} */
    this.stacks = new Map();
    this._queue = [];
    /** @type {{ level: number, choices: any[] } | null} */
    this.pendingOffer = null;

    this.subs.on(GameEvents.LEVEL_UP, ({ level }) => {
      this._queue.push(level);
      this._offerNext();
    });
    this.subs.on(GameEvents.UPGRADE_CHOSEN, ({ upgradeId }) => this._choose(upgradeId));
  }

  /** Améliorations actuellement proposables. */
  eligible() {
    return this._upgrades.filter((u) => {
      if ((this.stacks.get(u.id) ?? 0) >= u.maxStacks) return false;
      const req = u.requires ?? {};
      if (req.weapon && !this._player.hasWeapon(req.weapon)) return false;
      if (req.missingWeapon && this._player.hasWeapon(req.missingWeapon)) return false;
      return true;
    });
  }

  _offerNext() {
    if (this.pendingOffer || this._queue.length === 0) return;
    const level = this._queue.shift();
    const choices = this._rng.weightedSample(this.eligible(), this._choiceCount, (u) => u.weight);
    if (choices.length === 0) return this._offerNext(); // tout est au max : rien à proposer
    this.pendingOffer = { level, choices };
    this.bus.emit(GameEvents.UPGRADE_CHOICES_OFFERED, { level, choices });
  }

  _choose(upgradeId) {
    const offer = this.pendingOffer;
    if (!offer) return;
    const upgrade = offer.choices.find((u) => u.id === upgradeId);
    if (!upgrade) return;
    this.pendingOffer = null;
    this.apply(upgrade);
    this._offerNext();
  }

  /** Applique une amélioration (public : utilisé aussi par les tests / outils de debug). */
  apply(upgrade) {
    for (const fx of upgrade.effects) this._effects[fx.type](fx, this._effectCtx, upgrade.id);
    const stacks = (this.stacks.get(upgrade.id) ?? 0) + 1;
    this.stacks.set(upgrade.id, stacks);
    this.bus.emit(GameEvents.UPGRADE_APPLIED, { upgrade, stacks });
  }
}
