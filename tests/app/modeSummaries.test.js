import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeModes } from '../../client/src/app/modeSummaries.js';
import { loadContent } from '../helpers.js';

test('describeModes : les cartes de l\'écran titre sont dérivées des données', async () => {
  const c = await loadContent();
  const m = describeModes(c);
  assert.equal(m.story.waves, c.waves.waves.length);
  assert.equal(m.story.bossName, 'Gardien déchu');
  assert.equal(m.endless.bossEvery, c.endless.bossEvery);
  assert.equal(m.endless.bossTimeLimit, c.endless.bossTimeLimit);
  assert.equal(m.endless.uncapped, true);

  c.waves.waves[2].duration += 120;
  assert.equal(describeModes(c).story.minutes, m.story.minutes + 2, 'suit les durées de waves.json');
});
