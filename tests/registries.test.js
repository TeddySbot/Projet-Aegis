/** Cohérence entre le vocabulaire des données (shared/) et les implémentations (client/). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENEMY_BEHAVIORS, UPGRADE_EFFECT_TYPES, WEAPON_KINDS, WEAPON_TARGETING } from '../shared/content/vocabulary.js';
import { enemyBehaviors } from '../client/src/gameplay/behaviors/enemyBehaviors.js';
import { upgradeEffects } from '../client/src/gameplay/upgrades/upgradeEffects.js';
import { targetingStrategies, weaponKinds } from '../client/src/gameplay/weapons/weaponKinds.js';

const same = (a, b) => assert.deepEqual([...a].sort(), [...b].sort());

test('chaque comportement d\'ennemi déclaré est implémenté', () => same(ENEMY_BEHAVIORS, Object.keys(enemyBehaviors)));
test('chaque type d\'arme déclaré est implémenté', () => same(WEAPON_KINDS, Object.keys(weaponKinds)));
test('chaque ciblage déclaré est implémenté', () => same(WEAPON_TARGETING, Object.keys(targetingStrategies)));
test('chaque effet d\'amélioration déclaré est implémenté', () => same(UPGRADE_EFFECT_TYPES, Object.keys(upgradeEffects)));
