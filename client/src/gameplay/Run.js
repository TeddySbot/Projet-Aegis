/**
 * Run — assemble une partie à partir du contenu, de modificateurs et d'une source d'entrée.
 *
 * C'est la « composition root » du gameplay : elle instancie le monde, le joueur,
 * les services de la run et la liste ORDONNÉE des systèmes. Chaque système est
 * décrit par une fabrique ; on peut en désactiver par identifiant (`disabled`)
 * pour démontrer / tester le découplage (ex : `?disable=score,xp` dans l'URL).
 *
 * La run ne dépend ni du DOM, ni du réseau, ni de la méta-progression : elle
 * tourne telle quelle dans Node (tests, simulation headless).
 */
import { GameEvents } from '../core/events.js';
import { World } from './World.js';
import { Player } from './entities/Player.js';
import { EnemyFactory } from './entities/EnemyFactory.js';
import { DamageResolver } from './DamageResolver.js';
import { Arsenal } from './weapons/Arsenal.js';
import { weaponKinds } from './weapons/weaponKinds.js';
import { enemyBehaviors } from './behaviors/enemyBehaviors.js';
import { upgradeEffects } from './upgrades/upgradeEffects.js';
import { PlayerSystem } from './systems/PlayerSystem.js';
import { WaveSystem } from './systems/WaveSystem.js';
import { EnemySystem } from './systems/EnemySystem.js';
import { WeaponSystem } from './systems/WeaponSystem.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { XpSystem } from './systems/XpSystem.js';
import { UpgradeSystem } from './systems/UpgradeSystem.js';
import { ScoreSystem } from './systems/ScoreSystem.js';
import { RunDirector } from './systems/RunDirector.js';

/**
 * Systèmes dans leur ordre de mise à jour. `required` : indispensable à la
 * cohérence d'une run (ne peut pas être désactivé).
 * @type {{ id: string, required?: boolean, create: (d: any) => import('./systems/GameSystem.js').GameSystem }[]}
 */
export const SYSTEM_DEFINITIONS = [
  { id: 'player', required: true, create: (d) => new PlayerSystem({ bus: d.bus, world: d.world, input: d.input }) },
  {
    id: 'waves',
    create: (d) =>
      new WaveSystem({ bus: d.bus, world: d.world, waves: d.content.waves.waves, enemyFactory: d.enemyFactory, rng: d.rng, runConfig: d.runConfig }),
  },
  { id: 'enemies', create: (d) => new EnemySystem({ bus: d.bus, world: d.world, behaviors: enemyBehaviors, rng: d.rng, runConfig: d.runConfig }) },
  { id: 'weapons', create: (d) => new WeaponSystem({ bus: d.bus, world: d.world, damage: d.damage, rng: d.rng, weaponKinds }) },
  { id: 'combat', required: true, create: (d) => new CombatSystem({ bus: d.bus, world: d.world, damage: d.damage, runConfig: d.runConfig }) },
  { id: 'xp', create: (d) => new XpSystem({ bus: d.bus, world: d.world, xpCurve: d.runConfig.xpCurve, orbLifetime: d.runConfig.orbLifetime }) },
  {
    id: 'upgrades',
    create: (d) =>
      new UpgradeSystem({
        bus: d.bus,
        player: d.world.player,
        upgrades: d.content.upgrades,
        rng: d.rng,
        choiceCount: d.runConfig.upgradeChoices,
        effects: upgradeEffects,
        arsenal: d.arsenal,
      }),
  },
  {
    id: 'score',
    create: (d) => new ScoreSystem({ bus: d.bus, survivalPerSecond: d.runConfig.survivalScorePerSecond ?? 0, victoryBonus: d.runConfig.victoryScoreBonus ?? 0 }),
  },
  { id: 'director', required: true, create: (d) => new RunDirector({ bus: d.bus, world: d.world }) },
];

export const OPTIONAL_SYSTEMS = SYSTEM_DEFINITIONS.filter((s) => !s.required).map((s) => s.id);

export class Run {
  /**
   * @param {{
   *   content: any,
   *   bus: import('../core/EventBus.js').EventBus,
   *   input: { getMoveVector(): {x: number, y: number} },
   *   rng: import('../core/Random.js').Random,
   *   seed?: number,
   *   modifiers?: { statModifiers: any[], startingWeapons: string[] },
   *   disabled?: Iterable<string>,
   * }} options
   */
  constructor({ content, bus, input, rng, seed = 0, modifiers = { statModifiers: [], startingWeapons: [] }, disabled = [] }) {
    this.bus = bus;
    this.world = new World();
    this.world.player = new Player({ def: content.player, modifiers });

    const disabledSet = new Set(disabled);
    const deps = {
      bus,
      content,
      input,
      rng,
      world: this.world,
      runConfig: content.config.run,
      enemyFactory: new EnemyFactory({ enemies: content.enemies, world: this.world }),
      damage: new DamageResolver({ bus, player: this.world.player, rng }),
      arsenal: new Arsenal({ bus, weapons: content.weapons }),
    };

    /** @type {Map<string, import('./systems/GameSystem.js').GameSystem>} */
    this.systems = new Map();
    for (const def of SYSTEM_DEFINITIONS) {
      if (!def.required && disabledSet.has(def.id)) continue;
      this.systems.set(def.id, def.create(deps));
    }
    this.disabled = [...disabledSet].filter((id) => OPTIONAL_SYSTEMS.includes(id));

    const startWeapons = new Set([...content.player.startingWeapons, ...(modifiers.startingWeapons ?? [])]);
    for (const id of startWeapons) deps.arsenal.grant(this.world.player, id);

    this._seed = seed;
    this._modifiers = modifiers;
  }

  /** Démarre la run (les systèmes réagissent à RUN_STARTED, ex : première vague). */
  start() {
    const p = this.world.player;
    this.bus.emit(GameEvents.RUN_STARTED, {
      seed: this._seed,
      modifiers: this._modifiers,
      disabled: this.disabled,
      player: { hp: p.hp, maxHp: p.maxHp, weapons: [...p.weapons.values()].map((w) => ({ id: w.id, name: w.def.name })) },
    });
  }

  get director() {
    return /** @type {RunDirector} */ (this.systems.get('director'));
  }

  get ended() {
    return this.director.ended;
  }

  /** Offre d'amélioration en attente (null si aucune ou système désactivé). */
  get pendingOffer() {
    return /** @type {UpgradeSystem|undefined} */ (this.systems.get('upgrades'))?.pendingOffer ?? null;
  }

  system(id) {
    return this.systems.get(id) ?? null;
  }

  update(dt) {
    if (this.ended) return;
    for (const system of this.systems.values()) {
      system.update(dt);
      if (this.ended) break;
    }
    this.world.compact();
  }

  abandon() {
    this.director.end('abandon');
  }

  dispose() {
    for (const system of this.systems.values()) system.dispose();
    this.systems.clear();
  }
}
