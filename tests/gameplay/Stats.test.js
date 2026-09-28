import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Stats } from '../../client/src/gameplay/Stats.js';

test('valeur = (base + Σadd) × (1 + Σmul)', () => {
  const s = new Stats({ damage: 10 });
  s.addModifier({ stat: 'damage', op: 'add', value: 5 });
  s.addModifier({ stat: 'damage', op: 'mul', value: 0.1 });
  s.addModifier({ stat: 'damage', op: 'mul', value: 0.1 });
  assert.equal(s.get('damage'), 18);
});

test('refuse une stat inconnue', () => {
  const s = new Stats({ a: 1 });
  assert.throws(() => s.addModifier({ stat: 'b', op: 'add', value: 1 }), /inconnue/);
  assert.throws(() => s.get('b'), /inconnue/);
});
