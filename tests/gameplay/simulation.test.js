import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateRun } from '../../tools/simulate-run.js';
import { loadContent } from '../helpers.js';

const content = await loadContent();

test('une run complète se termine sans erreur (victoire ou défaite)', async () => {
  const { summary, errors, picks } = await simulateRun({ content, seed: 3, maxSeconds: 420 });
  assert.deepEqual(errors, []);
  assert.ok(['victory', 'defeat'].includes(summary.outcome), `issue : ${summary.outcome}`);
  assert.ok(summary.kills > 50);
  assert.ok(picks.length > 3, 'des améliorations ont été choisies');
});

test('la simulation est déterministe pour une graine donnée', async () => {
  const a = await simulateRun({ content, seed: 7, maxSeconds: 30 });
  const b = await simulateRun({ content, seed: 7, maxSeconds: 30 });
  assert.deepEqual(a.summary, b.summary);
  assert.deepEqual(a.picks, b.picks);
});
