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

test('mode infini : détecte un boss inconnu ou qui n\'en est pas un, et un boss en vague normale', async () => {
  const c = await loadContent();
  c.endless.bosses = ['dragon', 'shade'];
  c.endless.spawnPools[0].enemy = 'warden';
  const errors = validateContent(c).join('\n');
  assert.match(errors, /endless\.bosses\[0\] : ennemi inconnu "dragon"/);
  assert.match(errors, /"shade" n'est pas un boss/);
  assert.match(errors, /un boss ne peut pas être un ennemi de vague normale/);
});

test('détecte un multiplicateur de vague inconnu, un chrono sans boss et un hardMaxStacks < maxStacks', async () => {
  const c = await loadContent();
  c.waves.waves[0].spawns[0].scale = { mana: 2 };
  c.waves.waves[0].bossTimeLimit = 30;
  c.upgrades[0].hardMaxStacks = 1;
  const errors = validateContent(c).join('\n');
  assert.match(errors, /scale\.mana/);
  assert.match(errors, /"bossTimeLimit" sans aucun boss/);
  assert.match(errors, /hardMaxStacks/);
});

test('améliorations méta : détecte une stat d\'arme ou une arme inconnue', async () => {
  const c = await loadContent();
  c.metaUpgrades.push(
    { id: 'x1', name: 'X1', costs: [1], effect: { type: 'weaponStat', weapon: 'nova', stat: 'pierce', op: 'add', valuePerLevel: 1 } },
    { id: 'x2', name: 'X2', costs: [1], effect: { type: 'weaponStat', weapon: 'laser', stat: 'damage', op: 'mul', valuePerLevel: 0.1 } },
  );
  const errors = validateContent(c).join('\n');
  assert.match(errors, /stat "pierce" absente de l'arme "nova"/);
  assert.match(errors, /arme inconnue "laser"/);
});

test('améliorations méta : chaque amélioration a 10 à 20 niveaux (hors formes invalides)', async () => {
  const c = await loadContent();
  for (const m of c.metaUpgrades) assert.ok(m.costs.length >= 10 && m.costs.length <= 20, `${m.id} : ${m.costs.length} niveaux`);
});

test('améliorations méta : détecte effect + effects, et un palier invalide', async () => {
  const c = await loadContent();
  c.metaUpgrades[0].effect = { type: 'stat', stat: 'maxHp', op: 'add', valuePerLevel: 1 };
  c.metaUpgrades[1].effects[0].everyLevels = 0;
  const errors = validateContent(c).join('\n');
  assert.match(errors, /soit "effects"/);
  assert.match(errors, /everyLevels : entier ≥ 1/);
});
