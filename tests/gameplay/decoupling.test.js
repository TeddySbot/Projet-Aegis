/**
 * Découplage : chaque système optionnel peut être retiré sans casser la run,
 * et aucun abonnement ne survit à la fin d'une run.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../../client/src/core/EventBus.js';
import { GameEvents } from '../../client/src/core/events.js';
import { Random } from '../../client/src/core/Random.js';
import { OPTIONAL_SYSTEMS, Run } from '../../client/src/gameplay/Run.js';
import { AutopilotInput } from '../../client/src/debug/AutopilotInput.js';
import { loadContent } from '../helpers.js';

const content = await loadContent();

function play(disabled, seconds, mode = 'story') {
  const errors = [];
  const bus = new EventBus({ onError: (err, event) => errors.push(`${event}: ${err.message}`) });
  let run;
  run = new Run({ content, bus, input: new AutopilotInput({ getWorld: () => run.world }), rng: new Random(11), disabled, mode });
  bus.on(GameEvents.UPGRADE_CHOICES_OFFERED, ({ choices }) => queueMicrotask(() => bus.emit(GameEvents.UPGRADE_CHOSEN, { upgradeId: choices[0].id })));
  run.start();
  return { run, bus, errors, steps: seconds * 60 };
}

async function advance({ run, steps }) {
  for (let i = 0; i < steps && !run.ended; i++) {
    run.update(1 / 60);
    if (run.pendingOffer) await new Promise((r) => setImmediate(r));
  }
}

for (const id of OPTIONAL_SYSTEMS) {
  test(`la run tourne sans le système « ${id} »`, async () => {
    const ctx = play([id], 40);
    await advance(ctx);
    assert.deepEqual(ctx.errors, []);
    assert.ok(!ctx.run.systems.has(id));
    assert.ok(ctx.run.world.time > 0);
  });
}

test('la run tourne avec TOUS les systèmes optionnels désactivés', async () => {
  const ctx = play(OPTIONAL_SYSTEMS, 20);
  await advance(ctx);
  assert.deepEqual(ctx.errors, []);
  assert.deepEqual([...ctx.run.systems.keys()], ['player', 'combat', 'director']);
});

test('les systèmes requis ne peuvent pas être désactivés', () => {
  const ctx = play(['player', 'combat', 'director'], 0);
  assert.deepEqual([...ctx.run.systems.keys()].filter((k) => ['player', 'combat', 'director'].includes(k)).length, 3);
});

for (const mode of ['story', 'endless'])
test(`dispose() libère tous les abonnements de la run (mode ${mode})`, async () => {
  const ctx = play([], 10, mode);
  await advance(ctx);
  ctx.run.dispose();
  for (const event of Object.values(GameEvents)) {
    // seul l'abonné du test (UPGRADE_CHOICES_OFFERED) doit subsister
    const expected = event === GameEvents.UPGRADE_CHOICES_OFFERED ? 1 : 0;
    assert.equal(ctx.bus.listenerCount(event), expected, event);
  }
});
