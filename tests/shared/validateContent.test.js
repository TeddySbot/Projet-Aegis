import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateContent } from '../../shared/content/validateContent.js';
import { loadContent } from '../helpers.js';

test('les données livrées sont valides', async () => {
  assert.deepEqual(validateContent(await loadContent()), []);
});

test('détecte une vague qui référence un ennemi inconnu', async () => {
  const c = await loadContent();
  c.waves.waves[0].spawns[0].enemy = 'dragon';
  assert.match(validateContent(c).join('\n'), /ennemi inconnu "dragon"/);
});

test('détecte une amélioration sur une stat ou une arme inexistante', async () => {
  const c = await loadContent();
  c.upgrades[0].effects[0].stat = 'mana';
  c.upgrades.find((u) => u.id === 'orbit_more_blades').effects[0].weapon = 'laser';
  const errors = validateContent(c).join('\n');
  assert.match(errors, /statistique inconnue "mana"/);
  assert.match(errors, /arme inconnue "laser"/);
});

test('détecte un comportement non implémenté et des identifiants dupliqués', async () => {
  const c = await loadContent();
  c.enemies[0].behavior = 'teleport';
  c.enemies[1].id = c.enemies[0].id;
  const errors = validateContent(c).join('\n');
  assert.match(errors, /behavior/);
  assert.match(errors, /identifiant dupliqué/);
});
