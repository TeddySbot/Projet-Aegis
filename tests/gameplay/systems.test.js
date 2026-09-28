/**
 * Tests unitaires des systèmes, chacun isolé avec des doublures minimales :
 * aucun n'a besoin des autres systèmes pour fonctionner — c'est le découplage.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../../client/src/core/EventBus.js';
import { GameEvents as E } from '../../client/src/core/events.js';
import { Random } from '../../client/src/core/Random.js';
import { World } from '../../client/src/gameplay/World.js';
import { Player } from '../../client/src/gameplay/entities/Player.js';
import { EnemyFactory } from '../../client/src/gameplay/entities/EnemyFactory.js';
import { Arsenal } from '../../client/src/gameplay/weapons/Arsenal.js';
import { upgradeEffects } from '../../client/src/gameplay/upgrades/upgradeEffects.js';
import { WaveSystem } from '../../client/src/gameplay/systems/WaveSystem.js';
import { XpSystem, xpForLevel } from '../../client/src/gameplay/systems/XpSystem.js';
import { UpgradeSystem } from '../../client/src/gameplay/systems/UpgradeSystem.js';
import { ScoreSystem } from '../../client/src/gameplay/systems/ScoreSystem.js';
import { RunDirector } from '../../client/src/gameplay/systems/RunDirector.js';
import { loadContent, recordEvents } from '../helpers.js';

const content = await loadContent();

function makeWorld() {
  const world = new World();
  world.player = new Player({ def: content.player });
  return world;
}

test('ScoreSystem : réagit aux éliminations sans connaître le combat', () => {
  const bus = new EventBus();
  const score = new ScoreSystem({ bus, survivalPerSecond: 2, victoryBonus: 100 });
  bus.emit(E.ENEMY_KILLED, { score: 10 });
  bus.emit(E.RUN_TICK, { elapsed: 1 });
  bus.emit(E.ALL_WAVES_COMPLETED, {});
  assert.equal(score.score, 112);
  score.dispose();
  bus.emit(E.ENEMY_KILLED, { score: 10 });
  assert.equal(score.score, 112, 'après dispose, plus aucune réaction');
});

test('XpSystem : un ennemi tué lâche un orbe ; le ramasser fait monter de niveau', () => {
  const bus = new EventBus();
  const log = recordEvents(bus);
  const world = makeWorld();
  const curve = { base: 3, growth: 1, flat: 0 };
  const xp = new XpSystem({ bus, world, xpCurve: curve });
  bus.emit(E.ENEMY_KILLED, { x: 0, y: 0, xp: 7 });
  assert.equal(world.orbs.length, 1);
  xp.update(1 / 60);
  assert.equal(xp.level, 3); // 7 xp : niveau 2 à 3, niveau 3 à 6
  assert.deepEqual(log.of(E.LEVEL_UP).map((p) => p.level), [2, 3]);
  assert.equal(xp.xp, 1);
});

test('xpForLevel suit la courbe de données', () => {
  assert.equal(xpForLevel(1, { base: 5, growth: 2, flat: 0 }), 5);
  assert.equal(xpForLevel(3, { base: 5, growth: 2, flat: 1 }), 22);
});

test('WaveSystem : enchaîne les vagues de waves.json et signale la fin', () => {
  const bus = new EventBus();
  const log = recordEvents(bus);
  const world = makeWorld();
  const waves = [
    { id: 'w1', duration: 1, spawns: [{ enemy: 'shade', interval: 0.25, batch: 1 }] },
    { id: 'w2', duration: 1, spawns: [{ enemy: 'brute', at: 0.5 }] },
  ];
  const sys = new WaveSystem({
    bus, world, waves, rng: new Random(1),
    enemyFactory: new EnemyFactory({ enemies: content.enemies, world }),
    runConfig: { maxEnemies: 100, spawnRadius: { min: 100, max: 200 } },
  });
  bus.emit(E.RUN_STARTED, {});
  for (let i = 0; i < 130; i++) sys.update(1 / 60);
  assert.deepEqual(log.of(E.WAVE_STARTED).map((w) => w.index), [0, 1]);
  assert.equal(log.of(E.ALL_WAVES_COMPLETED).length, 1);
  assert.ok(world.enemies.filter((e) => e.typeId === 'shade').length >= 4);
  assert.equal(world.enemies.filter((e) => e.typeId === 'brute').length, 1);
});

test('WaveSystem : une vague de boss ne se termine pas tant que le boss vit', () => {
  const bus = new EventBus();
  const world = makeWorld();
  const waves = [{ id: 'boss', duration: 0.5, requiresBossKill: true, spawns: [{ enemy: 'warden', at: 0 }] }];
  const sys = new WaveSystem({
    bus, world, waves, rng: new Random(1),
    enemyFactory: new EnemyFactory({ enemies: content.enemies, world }),
    runConfig: { maxEnemies: 100, spawnRadius: { min: 100, max: 200 } },
  });
  let done = false;
  bus.on(E.ALL_WAVES_COMPLETED, () => (done = true));
  bus.emit(E.RUN_STARTED, {});
  for (let i = 0; i < 120; i++) sys.update(1 / 60);
  assert.equal(done, false);
  const boss = world.enemies.find((e) => e.boss);
  bus.emit(E.ENEMY_KILLED, { enemy: boss });
  sys.update(1 / 60);
  assert.equal(done, true);
});

test('UpgradeSystem : propose des choix éligibles et applique les effets de données', () => {
  const bus = new EventBus();
  const log = recordEvents(bus);
  const world = makeWorld();
  const arsenal = new Arsenal({ bus, weapons: content.weapons });
  arsenal.grant(world.player, 'arcane_bolt');
  const sys = new UpgradeSystem({ bus, player: world.player, upgrades: content.upgrades, rng: new Random(3), choiceCount: 3, effects: upgradeEffects, arsenal });

  // Les améliorations d'une arme non possédée ne sont pas proposées.
  const eligible = sys.eligible().map((u) => u.id);
  assert.ok(!eligible.includes('orbit_more_blades'));
  assert.ok(eligible.includes('unlock_orbit_blades'));

  bus.emit(E.LEVEL_UP, { level: 2 });
  const [offer] = log.of(E.UPGRADE_CHOICES_OFFERED);
  assert.equal(offer.choices.length, 3);
  assert.equal(new Set(offer.choices.map((c) => c.id)).size, 3, 'choix distincts');

  // Application directe d'une amélioration d'arme depuis les données
  const unlock = content.upgrades.find((u) => u.id === 'unlock_orbit_blades');
  sys.apply(unlock);
  assert.ok(world.player.hasWeapon('orbit_blades'));
  assert.ok(!sys.eligible().some((u) => u.id === 'unlock_orbit_blades'), 'maxStacks respecté');
  assert.ok(sys.eligible().some((u) => u.id === 'orbit_more_blades'), 'prérequis satisfait');

  const might = content.upgrades.find((u) => u.id === 'might');
  const before = world.player.stats.get('might');
  sys.apply(might);
  assert.ok(Math.abs(world.player.stats.get('might') - before * 1.15) < 1e-9);
});

test('UpgradeSystem : plusieurs montées de niveau sont proposées une à une', () => {
  const bus = new EventBus();
  const log = recordEvents(bus);
  const world = makeWorld();
  const arsenal = new Arsenal({ bus, weapons: content.weapons });
  const sys = new UpgradeSystem({ bus, player: world.player, upgrades: content.upgrades, rng: new Random(3), choiceCount: 3, effects: upgradeEffects, arsenal });
  bus.emit(E.LEVEL_UP, { level: 2 });
  bus.emit(E.LEVEL_UP, { level: 3 });
  assert.equal(log.of(E.UPGRADE_CHOICES_OFFERED).length, 1);
  bus.emit(E.UPGRADE_CHOSEN, { upgradeId: sys.pendingOffer.choices[0].id });
  assert.equal(log.of(E.UPGRADE_CHOICES_OFFERED).length, 2);
  assert.equal(sys.pendingOffer.level, 3);
});

test('RunDirector : agrège le résumé à partir des seuls événements', () => {
  const bus = new EventBus();
  const world = makeWorld();
  const dir = new RunDirector({ bus, world });
  let summary = null;
  bus.on(E.RUN_ENDED, (s) => (summary = s));
  for (let i = 0; i < 125; i++) dir.update(1 / 60);
  bus.emit(E.WAVE_STARTED, { index: 1 });
  bus.emit(E.ENEMY_KILLED, {});
  bus.emit(E.SCORE_CHANGED, { score: 77 });
  bus.emit(E.LEVEL_UP, { level: 4 });
  bus.emit(E.PLAYER_DIED, {});
  bus.emit(E.PLAYER_DIED, {}); // idempotent
  assert.deepEqual(summary, { outcome: 'defeat', duration: 2.1, score: 77, kills: 1, level: 4, wave: 2 });
});
