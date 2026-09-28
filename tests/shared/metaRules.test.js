import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRunResult, computeRunModifiers, createEmptyProfile, purchaseUpgrade, sanitizeProfile,
} from '../../shared/meta/metaRules.js';

const rewards = { shardsPerScore: 0.01, victoryBonus: 10, minShards: 1 };
const catalog = [
  { id: 'hp', costs: [5, 10], effect: { type: 'stat', stat: 'maxHp', op: 'add', valuePerLevel: 10 } },
  { id: 'blades', costs: [20], effect: { type: 'startingWeapon', weapon: 'orbit_blades' } },
  { id: 'edge', costs: [5, 5, 5], effect: { type: 'weaponStat', weapon: 'orbit_blades', stat: 'damage', op: 'mul', valuePerLevel: 0.1 } },
];

test('une run crédite la monnaie et met à jour les statistiques', () => {
  const { profile, reward } = applyRunResult(createEmptyProfile(), { outcome: 'victory', score: 1000, kills: 50, level: 8, wave: 3, duration: 150 }, rewards);
  assert.equal(reward, 20);
  assert.equal(profile.shards, 20);
  assert.equal(profile.stats.victories, 1);
  assert.equal(profile.stats.bestScore, 1000);
});

test('un résumé malformé est assaini (pas de monnaie négative ni injectée)', () => {
  const { profile, run } = applyRunResult(createEmptyProfile(), { outcome: 'hacked', score: -500, shards: 99999 }, rewards);
  assert.equal(run.outcome, 'abandon');
  assert.equal(run.score, 0);
  assert.equal(profile.shards, 0);
});

test('achat : coût, niveau max et solde insuffisant', () => {
  let p = { ...createEmptyProfile(), shards: 16 };
  let r = purchaseUpgrade(p, 'hp', catalog);
  assert.ok(r.ok);
  p = r.profile;
  assert.equal(p.shards, 11);
  r = purchaseUpgrade(p, 'hp', catalog);
  assert.ok(r.ok);
  assert.equal(r.profile.shards, 1);
  assert.deepEqual(purchaseUpgrade(r.profile, 'hp', catalog), { ok: false, error: 'max_level' });
  assert.deepEqual(purchaseUpgrade(r.profile, 'blades', catalog), { ok: false, error: 'not_enough_shards' });
  assert.deepEqual(purchaseUpgrade(r.profile, 'x', catalog), { ok: false, error: 'unknown_upgrade' });
});

test('le profil devient des modificateurs de run (données pour le gameplay)', () => {
  const profile = { ...createEmptyProfile(), upgrades: { hp: 2, blades: 1, edge: 3 } };
  const mods = computeRunModifiers(profile, catalog);
  assert.deepEqual(mods.statModifiers, [{ stat: 'maxHp', op: 'add', value: 20, source: 'hp' }]);
  assert.deepEqual(mods.startingWeapons, ['orbit_blades']);
  assert.equal(mods.weaponModifiers.length, 1);
  assert.deepEqual({ ...mods.weaponModifiers[0], value: Math.round(mods.weaponModifiers[0].value * 100) / 100 },
    { weapon: 'orbit_blades', stat: 'damage', op: 'mul', value: 0.3, source: 'edge' });
});

test('un profil corrompu redevient un profil valide', () => {
  assert.deepEqual(sanitizeProfile('garbage'), createEmptyProfile());
  const p = sanitizeProfile({ shards: -3, upgrades: { hp: 'x', ok: 2 }, stats: { runs: 2.7 } });
  assert.equal(p.shards, 0);
  assert.deepEqual(p.upgrades, { ok: 2 });
  assert.equal(p.stats.runs, 2);
});

test('mode infini : bonus par boss vaincu, record de vague, jamais de « victoire »', () => {
  const r = { ...rewards, endlessBossKillBonus: 5 };
  let { profile, reward, run } = applyRunResult(createEmptyProfile(), { mode: 'endless', outcome: 'defeat', score: 1000, kills: 300, level: 30, wave: 23, bossKills: 2, duration: 700 }, r);
  assert.equal(run.mode, 'endless');
  assert.equal(reward, 10 + 2 * 5);
  assert.equal(profile.stats.bestEndlessWave, 23);
  assert.equal(profile.stats.endlessBossKills, 2);
  assert.equal(profile.stats.victories, 0);

  // une run moins bonne ne bat pas le record ; une campagne ne le touche pas
  ({ profile } = applyRunResult(profile, { mode: 'endless', outcome: 'defeat', wave: 12, bossKills: 1, duration: 300 }, r));
  ({ profile } = applyRunResult(profile, { mode: 'story', outcome: 'victory', wave: 3, bossKills: 1, duration: 150 }, r));
  assert.equal(profile.stats.bestEndlessWave, 23);
  assert.equal(profile.stats.endlessBossKills, 3);

  const forged = applyRunResult(createEmptyProfile(), { mode: 'endless', outcome: 'victory', wave: 2, bossKills: 999, duration: 60 }, r);
  assert.equal(forged.run.outcome, 'abandon', 'une run infinie ne peut pas être gagnée');
  assert.equal(forged.run.bossKills, 2, 'au plus un boss par vague');
  assert.equal(applyRunResult(createEmptyProfile(), { mode: 'chess' }, r).run.mode, 'story');
});

test('un ancien profil (sans statistiques du mode infini) reste lisible', () => {
  const p = sanitizeProfile({ shards: 3, stats: { runs: 2, victories: 1, bestScore: 10, bestTime: 50, totalKills: 40 } });
  assert.equal(p.stats.bestEndlessWave, 0);
  assert.equal(p.stats.endlessBossKills, 0);
  assert.equal(p.stats.runs, 2);
});

test('plusieurs effets par amélioration méta, avec paliers (everyLevels)', () => {
  const multi = [{
    id: 'salvo',
    costs: Array(10).fill(1),
    effects: [
      { type: 'stat', stat: 'might', op: 'mul', valuePerLevel: 0.02 },
      { type: 'stat', stat: 'extraProjectiles', op: 'add', valuePerLevel: 1, everyLevels: 5 },
      { type: 'startingWeapon', weapon: 'nova' },
    ],
  }];
  const at = (lvl) => computeRunModifiers({ ...createEmptyProfile(), upgrades: { salvo: lvl } }, multi);
  assert.deepEqual(at(4).statModifiers.map((m) => m.stat), ['might'], 'palier 5 pas encore atteint');
  assert.deepEqual(at(4).startingWeapons, ['nova']);
  assert.equal(at(5).statModifiers.find((m) => m.stat === 'extraProjectiles').value, 1);
  assert.equal(at(10).statModifiers.find((m) => m.stat === 'extraProjectiles').value, 2);
  assert.deepEqual(at(0), { statModifiers: [], startingWeapons: [], weaponModifiers: [] });
});
