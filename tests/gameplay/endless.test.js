/**
 * Mode infini : génération de vagues sans fin, boss tous les N vagues avec compte à
 * rebours, ennemis renforcés, améliorations sans plafond.
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
import { EndlessWaveProvider } from '../../client/src/gameplay/waves/EndlessWaveProvider.js';
import { WaveSystem } from '../../client/src/gameplay/systems/WaveSystem.js';
import { UpgradeSystem } from '../../client/src/gameplay/systems/UpgradeSystem.js';
import { Run } from '../../client/src/gameplay/Run.js';
import { validateWaveDef } from '../../shared/content/validateContent.js';
import { simulateRun } from '../../tools/simulate-run.js';
import { idleInput, loadContent, recordEvents } from '../helpers.js';

const content = await loadContent();
const provider = () => new EndlessWaveProvider({ def: content.endless, enemies: content.enemies });

function makeWorld() {
  const world = new World();
  world.player = new Player({ def: content.player });
  return world;
}

test('EndlessWaveProvider : les vagues ne s\'arrêtent jamais et restent valides', () => {
  const p = provider();
  assert.equal(p.total, null);
  for (let i = 0; i < 120; i++) {
    const wave = p.get(i);
    assert.ok(wave, `vague ${i + 1}`);
    assert.deepEqual(validateWaveDef(wave, content.enemies, `vague ${i + 1}`), []);
  }
  assert.ok(p.get(9999));
});

test('EndlessWaveProvider : un boss chronométré toutes les `bossEvery` vagues', () => {
  const p = provider();
  const every = content.endless.bossEvery;
  for (let n = 1; n <= every * 3; n++) {
    const wave = p.get(n - 1);
    const bossRules = wave.spawns.filter((s) => content.enemies.find((e) => e.id === s.enemy)?.boss);
    if (n % every === 0) {
      assert.equal(bossRules.length, 1, `vague ${n} : un boss`);
      assert.equal(wave.requiresBossKill, true);
      assert.equal(wave.bossTimeLimit, content.endless.bossTimeLimit);
      assert.equal(wave.bossTier, n / every);
    } else {
      assert.equal(bossRules.length, 0, `vague ${n} : pas de boss`);
      assert.equal(wave.bossTimeLimit, undefined);
    }
  }
});

test('EndlessWaveProvider : le boss est de plus en plus gros et puissant à chaque palier', () => {
  const p = provider();
  let prev = null;
  for (let tier = 1; tier <= 8; tier++) {
    const s = p.bossScale(tier);
    assert.ok(s.radius > 1, 'boss plus gros que sa taille de base');
    if (prev) {
      assert.ok(s.hp > prev.hp, `pv palier ${tier}`);
      assert.ok(s.damage > prev.damage, `dégâts palier ${tier}`);
      assert.ok(s.radius >= prev.radius, `taille palier ${tier}`);
    }
    prev = s;
  }
  assert.ok(p.bossScale(100).radius <= content.endless.bossScaling.maxSize, 'taille plafonnée');
});

test('EndlessWaveProvider : les ennemis ordinaires se renforcent de vague en vague', () => {
  const p = provider();
  const a = p.enemyScale(1);
  const b = p.enemyScale(25);
  assert.deepEqual(a, { hp: 1, damage: 1, speed: 1, xp: 1, score: 1 });
  for (const k of ['hp', 'damage', 'xp', 'score']) assert.ok(b[k] > a[k], k);
  assert.ok(p.get(29).spawns.length >= p.get(0).spawns.length, 'de nouveaux ennemis se débloquent');
});

test('EnemyFactory : `scale` multiplie les caractéristiques sans toucher à la définition', () => {
  const world = makeWorld();
  const factory = new EnemyFactory({ enemies: content.enemies, world });
  const def = factory.getDef('warden');
  const e = factory.create('warden', 0, 0, { scale: { hp: 2, damage: 1.5, radius: 3, speed: 1.1, xp: 2, score: 2 }, label: 'Gardien · Palier 2' });
  assert.equal(e.maxHp, def.hp * 2);
  assert.equal(e.hp, e.maxHp);
  assert.equal(e.damage, def.damage * 1.5);
  assert.equal(e.radius, def.radius * 3);
  assert.equal(e.xp, def.xp * 2);
  assert.equal(e.name, 'Gardien · Palier 2');
  assert.equal(def.hp, factory.getDef('warden').hp, 'définition partagée intacte');
});

function bossWaveSystem(bossTimeLimit) {
  const bus = new EventBus();
  const log = recordEvents(bus);
  const world = makeWorld();
  const waves = [
    { id: 'boss', duration: 0.1, requiresBossKill: true, bossTimeLimit, spawns: [{ enemy: 'warden', at: 0 }] },
    { id: 'next', duration: 5, spawns: [{ enemy: 'shade', interval: 1 }] },
  ];
  const sys = new WaveSystem({
    bus, world, waves, rng: new Random(1),
    enemyFactory: new EnemyFactory({ enemies: content.enemies, world }),
    runConfig: { maxEnemies: 100, spawnRadius: { min: 100, max: 200 } },
  });
  bus.emit(E.RUN_STARTED, {});
  return { bus, log, world, sys };
}

test('WaveSystem : le compte à rebours de boss expire → BOSS_TIMER_STOPPED { expired: true }', () => {
  const { log, sys } = bossWaveSystem(2);
  for (let i = 0; i < 60 * 3; i++) sys.update(1 / 60);
  assert.deepEqual(log.of(E.BOSS_TIMER_STARTED), [{ duration: 2 }]);
  assert.deepEqual(log.of(E.BOSS_TIMER_TICK).map((t) => t.remaining), [1, 0]);
  assert.deepEqual(log.of(E.BOSS_TIMER_STOPPED), [{ expired: true, remaining: 0 }]);
  assert.equal(sys.finished, true, 'plus aucune vague après l\'échec');
  assert.equal(log.of(E.WAVE_STARTED).length, 1);
});

test('WaveSystem : boss vaincu à temps → le chrono s\'arrête et la vague suivante commence', () => {
  const { bus, log, world, sys } = bossWaveSystem(60);
  for (let i = 0; i < 30; i++) sys.update(1 / 60);
  bus.emit(E.ENEMY_KILLED, { enemy: world.enemies.find((e) => e.boss), boss: true });
  sys.update(1 / 60);
  const [stopped] = log.of(E.BOSS_TIMER_STOPPED);
  assert.equal(stopped.expired, false);
  assert.ok(stopped.remaining > 59);
  assert.deepEqual(log.of(E.WAVE_STARTED).map((w) => w.wave.id), ['boss', 'next']);
  for (let i = 0; i < 60 * 70; i++) sys.update(1 / 60);
  assert.equal(log.of(E.BOSS_TIMER_STOPPED).length, 1, 'aucun chrono fantôme');
});

test('Run infinie : un boss non vaincu à temps met fin à la run (défaite « bossTimeout »)', () => {
  const c = structuredClone(content);
  Object.assign(c.endless, { bossEvery: 1, bossTimeLimit: 1.5, bossSpawnDelay: 0 });
  const bus = new EventBus();
  const run = new Run({ content: c, bus, input: idleInput, rng: new Random(4), mode: 'endless', disabled: ['weapons'] });
  let summary = null;
  bus.on(E.RUN_ENDED, (s) => (summary = s));
  run.start();
  for (let i = 0; i < 60 * 3 && !run.ended; i++) run.update(1 / 60);
  assert.equal(summary.mode, 'endless');
  assert.equal(summary.outcome, 'defeat');
  assert.equal(summary.cause, 'bossTimeout');
  assert.equal(summary.wave, 1);
  assert.equal(summary.bossKills, 0);
  run.dispose();
});

test('Run infinie : courbe d\'XP surchargée par le mode, mode annoncé dans RUN_STARTED', () => {
  const bus = new EventBus();
  const log = recordEvents(bus);
  const run = new Run({ content, bus, input: idleInput, rng: new Random(1), mode: 'endless' });
  run.start();
  assert.equal(log.of(E.RUN_STARTED)[0].mode, 'endless');
  assert.equal(log.of(E.WAVE_STARTED)[0].total, null);
  assert.deepEqual(run.system('xp')._curve, content.endless.runOverrides.xpCurve);
  assert.equal(run.system('upgrades').uncapped, true);
  run.dispose();
  assert.throws(() => new Run({ content, bus, input: idleInput, rng: new Random(1), mode: 'pvp' }), /Mode de jeu inconnu/);
});

test('UpgradeSystem sans plafond : dépasse maxStacks, respecte hardMaxStacks, l\'unique reste unique', () => {
  const bus = new EventBus();
  const world = makeWorld();
  const arsenal = new Arsenal({ bus, weapons: content.weapons });
  arsenal.grant(world.player, 'arcane_bolt');
  const make = (uncapped) =>
    new UpgradeSystem({ bus, player: world.player, upgrades: content.upgrades, rng: new Random(3), choiceCount: 3, effects: upgradeEffects, arsenal, uncapped });
  const capped = make(false);
  const free = make(true);
  const might = content.upgrades.find((u) => u.id === 'might');
  const haste = content.upgrades.find((u) => u.id === 'haste');
  const unlock = content.upgrades.find((u) => u.id === 'unlock_nova');
  assert.equal(capped.stackLimit(might), might.maxStacks);
  assert.equal(free.stackLimit(might), Infinity);
  assert.equal(free.stackLimit(haste), haste.hardMaxStacks);
  assert.equal(free.stackLimit(unlock), 1);

  for (let i = 0; i < might.maxStacks + 5; i++) free.apply(might);
  assert.equal(free.stacks.get('might'), might.maxStacks + 5);
  assert.ok(free.eligible().some((u) => u.id === 'might'), 'toujours proposable');
  for (let i = 0; i < haste.hardMaxStacks; i++) free.apply(haste);
  assert.ok(!free.eligible().some((u) => u.id === 'haste'), 'garde-fou atteint');
  capped.dispose();
  free.dispose();
});

test('simulation : une run infinie dépasse le premier boss sans erreur', async () => {
  const { summary, errors } = await simulateRun({ content, seed: 3, mode: 'endless', maxSeconds: 420 });
  assert.deepEqual(errors, []);
  assert.equal(summary.mode, 'endless');
  assert.ok(summary.wave > content.endless.bossEvery, `vague atteinte : ${summary.wave}`);
  assert.ok(summary.bossKills >= 1);
});
