import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameLoop } from '../../client/src/core/GameLoop.js';

test('pas fixe : le nombre de mises à jour ne dépend pas du découpage des frames', () => {
  let updates = 0;
  const loop = new GameLoop({ update: () => updates++, render: () => {}, step: 0.01, requestFrame: () => 0, cancelFrame: () => {}, now: () => 0 });
  for (let i = 0; i < 10; i++) loop.tick(0.1); // 1 s en 10 frames
  const a = updates;
  updates = 0;
  for (let i = 0; i < 100; i++) loop.tick(0.01); // 1 s en 100 frames
  assert.ok(Math.abs(a - 100) <= 1 && Math.abs(updates - 100) <= 1, `${a} / ${updates}`);
});

test('borne les grosses pauses (onglet en arrière-plan)', () => {
  let updates = 0;
  const loop = new GameLoop({ update: () => updates++, render: () => {}, step: 1 / 64, maxFrame: 0.25, requestFrame: () => 0, cancelFrame: () => {}, now: () => 0 });
  loop.tick(30);
  assert.equal(updates, 16);
});
