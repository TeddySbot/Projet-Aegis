import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ServiceContainer } from '../../client/src/core/ServiceContainer.js';

test('résolution paresseuse et mise en cache', () => {
  const c = new ServiceContainer();
  let built = 0;
  c.register('a', () => ({ n: ++built }));
  assert.equal(built, 0);
  assert.equal(c.resolve('a'), c.resolve('a'));
  assert.equal(built, 1);
});

test('les dépendances sont résolues via le conteneur', () => {
  const c = new ServiceContainer();
  c.value('config', { x: 3 });
  c.register('service', (c) => ({ x: c.resolve('config').x * 2 }));
  assert.equal(c.resolve('service').x, 6);
});

test('override permet de remplacer une implémentation', () => {
  const c = new ServiceContainer();
  c.register('repo', () => 'http');
  c.override('repo', () => 'local');
  assert.equal(c.resolve('repo'), 'local');
});

test('détecte les dépendances circulaires et les services inconnus', () => {
  const c = new ServiceContainer();
  c.register('a', (c) => c.resolve('b'));
  c.register('b', (c) => c.resolve('a'));
  assert.throws(() => c.resolve('a'), /circulaire/);
  assert.throws(() => c.resolve('nope'), /introuvable/);
  assert.throws(() => c.register('a', () => 1), /déjà enregistré/);
});
