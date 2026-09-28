import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventBus, SubscriptionGroup } from '../../client/src/core/EventBus.js';

test('les abonnés reçoivent le payload, dans l\'ordre d\'abonnement', () => {
  const bus = new EventBus();
  const calls = [];
  bus.on('a', (p) => calls.push(['1', p]));
  bus.on('a', (p) => calls.push(['2', p]));
  bus.emit('a', 42);
  assert.deepEqual(calls, [['1', 42], ['2', 42]]);
});

test('on() renvoie une fonction de désabonnement', () => {
  const bus = new EventBus();
  let n = 0;
  const off = bus.on('a', () => n++);
  bus.emit('a');
  off();
  bus.emit('a');
  assert.equal(n, 1);
  assert.equal(bus.listenerCount('a'), 0);
});

test('once() ne notifie qu\'une fois', () => {
  const bus = new EventBus();
  let n = 0;
  bus.once('a', () => n++);
  bus.emit('a');
  bus.emit('a');
  assert.equal(n, 1);
});

test('une erreur dans un handler n\'empêche pas les autres d\'être notifiés', () => {
  const errors = [];
  const bus = new EventBus({ onError: (err, event) => errors.push([err.message, event]) });
  let reached = false;
  bus.on('a', () => {
    throw new Error('boom');
  });
  bus.on('a', () => (reached = true));
  bus.emit('a');
  assert.equal(reached, true);
  assert.deepEqual(errors, [['boom', 'a']]);
});

test('se désabonner pendant un dispatch est sans effet sur le dispatch courant', () => {
  const bus = new EventBus();
  const calls = [];
  let offB;
  bus.on('a', () => {
    calls.push('A');
    offB();
  });
  offB = bus.on('a', () => calls.push('B'));
  bus.emit('a');
  bus.emit('a');
  assert.deepEqual(calls, ['A', 'B', 'A']);
});

test('SubscriptionGroup libère tous ses abonnements', () => {
  const bus = new EventBus();
  const group = new SubscriptionGroup(bus).on('a', () => {}).on('b', () => {});
  assert.equal(bus.listenerCount('a') + bus.listenerCount('b'), 2);
  group.dispose();
  assert.equal(bus.listenerCount('a') + bus.listenerCount('b'), 0);
});
