import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../../server/app.js';
import { FileProfileStore } from '../../server/persistence/FileProfileStore.js';
import { MemoryProfileStore } from '../../server/persistence/MemoryProfileStore.js';
import { ROOT, loadContent } from '../helpers.js';

let server;
let base;
const bundle = await loadContent();

before(async () => {
  const app = createApp({
    content: { bundle },
    profiles: new MemoryProfileStore(),
    publicDirs: { client: path.join(ROOT, 'client'), shared: path.join(ROOT, 'shared') },
    logger: { info() {}, warn() {}, error() {} },
  });
  server = app.server;
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const json = async (method, url, body) => {
  const res = await fetch(base + url, { method, body: body && JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
};

test('GET /api/content renvoie le contenu validé', async () => {
  const { status, body } = await json('GET', '/api/content');
  assert.equal(status, 200);
  assert.equal(body.enemies.length, bundle.enemies.length);
});

test('cycle méta : run → récompense → achat', async () => {
  let r = await json('POST', '/api/profile/runs', { outcome: 'victory', score: 5000, kills: 300, level: 10, wave: 3, duration: 160 });
  assert.equal(r.status, 201);
  const expected = Math.floor(5000 * bundle.config.rewards.shardsPerScore) + bundle.config.rewards.victoryBonus;
  assert.equal(r.body.reward, expected);
  r = await json('POST', '/api/profile/purchases', { upgradeId: 'meta_vitality' });
  assert.equal(r.status, 200);
  assert.equal(r.body.profile.upgrades.meta_vitality, 1);
  assert.equal(r.body.profile.shards, expected - bundle.metaUpgrades[0].costs[0]);
});

test('mode infini : le serveur crédite le bonus de boss et enregistre le record de vague', async () => {
  const before = (await json('GET', '/api/profile')).body.profile;
  const r = await json('POST', '/api/profile/runs', { mode: 'endless', outcome: 'defeat', cause: 'bossTimeout', score: 0, kills: 900, level: 40, wave: 30, bossKills: 2, duration: 900 });
  assert.equal(r.status, 201);
  assert.equal(r.body.reward, 2 * bundle.config.rewards.endlessBossKillBonus);
  assert.equal(r.body.profile.stats.bestEndlessWave, Math.max(30, before.stats.bestEndlessWave));
  assert.equal(r.body.profile.stats.victories, before.stats.victories);
});

test('achat refusé : amélioration inconnue ou solde insuffisant', async () => {
  assert.equal((await json('POST', '/api/profile/purchases', { upgradeId: 'nope' })).status, 404);
  await json('DELETE', '/api/profile');
  const r = await json('POST', '/api/profile/purchases', { upgradeId: 'meta_orbit_start' });
  assert.deepEqual([r.status, r.body.error], [409, 'not_enough_shards']);
});

test('erreurs HTTP : JSON invalide, route inconnue, méthode non permise', async () => {
  const bad = await fetch(base + '/api/profile/runs', { method: 'POST', body: '{oops' });
  assert.equal(bad.status, 400);
  assert.equal((await json('GET', '/api/nope')).status, 404);
  assert.equal((await json('PUT', '/api/profile')).status, 405);
});

test('fichiers statiques : client servi, reste du dépôt inaccessible', async () => {
  assert.equal((await fetch(base + '/')).status, 200);
  assert.equal((await fetch(base + '/client/src/main.js')).status, 200);
  assert.equal((await fetch(base + '/shared/meta/metaRules.js')).status, 200);
  assert.equal((await fetch(base + '/server/index.js')).status, 404);
  assert.equal((await fetch(base + '/client/%2e%2e/server/index.js')).status, 404);
  assert.equal((await fetch(base + '/data/config.json')).status, 404);
});

test('FileProfileStore : écriture atomique, relecture, fichier corrompu', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aegis-'));
  const store = new FileProfileStore({ dir, logger: { warn() {} } });
  assert.equal((await store.load()).shards, 0);
  await Promise.all([1, 2, 3].map((n) => store.update((p) => ({ profile: { ...p, shards: p.shards + n }, result: null }))));
  assert.equal((await store.load()).shards, 6, 'mises à jour concurrentes sérialisées');
  await fs.writeFile(path.join(dir, 'profile.json'), '{corrompu');
  assert.equal((await store.load()).shards, 0);
  const files = await fs.readdir(dir);
  assert.ok(files.some((f) => f.endsWith('.corrupt')));
  await fs.rm(dir, { recursive: true });
});
