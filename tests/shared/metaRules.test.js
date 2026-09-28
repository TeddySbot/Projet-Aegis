import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRunResult, computeRunModifiers, createEmptyProfile, purchaseUpgrade, sanitizeProfile,
} from '../../shared/meta/metaRules.js';

const rewards = { shardsPerScore: 0.01, victoryBonus: 10, minShards: 1 };
const catalog = [
  { id: 'hp', costs: [5, 10], effect: { type: 'stat', stat: 'maxHp', op: 'add', valuePerLevel: 10 } },
  { id: 'blades', costs: [20], effect: { type: 'startingWeapon', weapon: 'orbit_blades' } },
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
  const profile = { ...createEmptyProfile(), upgrades: { hp: 2, blades: 1 } };
  assert.deepEqual(computeRunModifiers(profile, catalog), {
    statModifiers: [{ stat: 'maxHp', op: 'add', value: 20, source: 'hp' }],
    startingWeapons: ['orbit_blades'],
  });
});

test('un profil corrompu redevient un profil valide', () => {
  assert.deepEqual(sanitizeProfile('garbage'), createEmptyProfile());
  const p = sanitizeProfile({ shards: -3, upgrades: { hp: 'x', ok: 2 }, stats: { runs: 2.7 } });
  assert.equal(p.shards, 0);
  assert.deepEqual(p.upgrades, { ok: 2 });
  assert.equal(p.stats.runs, 2);
});
