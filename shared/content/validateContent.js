/**
 * Validation du contenu de jeu (données JSON).
 *
 * Exécutée au démarrage du serveur (fail fast : un fichier de données invalide
 * empêche le lancement avec un message clair) et réutilisée par l'outil
 * `npm run validate-data` et les tests. Code isomorphe : aucun import Node ni DOM.
 *
 * On vérifie la forme ET l'intégrité référentielle (une vague qui référence un
 * ennemi inexistant, une amélioration qui cible une arme inconnue…).
 */
import {
  ENEMY_BEHAVIORS,
  WEAPON_KINDS,
  WEAPON_TARGETING,
  UPGRADE_EFFECT_TYPES,
  META_EFFECT_TYPES,
  MODIFIER_OPS,
  ENEMY_SCALE_KEYS,
} from './vocabulary.js';
import { metaEffects } from '../meta/metaRules.js';

class Errors {
  constructor() {
    this.list = [];
  }
  add(path, msg) {
    this.list.push(`${path} : ${msg}`);
  }
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isPosNum = (v) => isNum(v) && v > 0;
const isStr = (v) => typeof v === 'string' && v.length > 0;

function requireFields(errors, path, obj, spec) {
  if (!isObj(obj)) {
    errors.add(path, 'objet attendu');
    return false;
  }
  for (const [key, check] of Object.entries(spec)) {
    const [fn, label] = check;
    if (!fn(obj[key])) errors.add(`${path}.${key}`, `${label} attendu (reçu ${JSON.stringify(obj[key])})`);
  }
  return true;
}

function uniqueIds(errors, path, list) {
  const ids = new Set();
  list.forEach((item, i) => {
    if (!isObj(item) || !isStr(item.id)) return errors.add(`${path}[${i}].id`, 'identifiant manquant');
    if (ids.has(item.id)) errors.add(`${path}[${i}].id`, `identifiant dupliqué "${item.id}"`);
    ids.add(item.id);
  });
  return ids;
}

/**
 * Valide une définition de vague (écrite dans `waves.json` ou générée par le mode infini).
 * @param {Errors} e
 * @param {string} p chemin pour les messages
 * @param {any} w vague
 * @param {any[]} enemies définitions d'ennemis
 */
function checkWave(e, p, w, enemies) {
  const enemyById = new Map((Array.isArray(enemies) ? enemies : []).map((en) => [en?.id, en]));
  requireFields(e, p, w, { duration: [isPosNum, 'nombre > 0'], spawns: [Array.isArray, 'tableau'] });
  if (w?.bossTimeLimit !== undefined && !isPosNum(w.bossTimeLimit)) e.add(`${p}.bossTimeLimit`, 'nombre > 0 attendu');
  (w?.spawns ?? []).forEach((s, j) => {
    const sp = `${p}.spawns[${j}]`;
    if (!isObj(s)) return e.add(sp, 'objet attendu');
    if (!enemyById.has(s.enemy)) e.add(`${sp}.enemy`, `ennemi inconnu "${s.enemy}"`);
    const periodic = s.interval !== undefined;
    const oneShot = s.at !== undefined;
    if (periodic === oneShot) e.add(sp, 'définir soit "interval" (périodique) soit "at" (ponctuel)');
    if (periodic && !isPosNum(s.interval)) e.add(`${sp}.interval`, 'nombre > 0 attendu');
    if (s.intervalEnd !== undefined && !isPosNum(s.intervalEnd)) e.add(`${sp}.intervalEnd`, 'nombre > 0 attendu');
    if (oneShot && !(isNum(s.at) && s.at >= 0)) e.add(`${sp}.at`, 'nombre ≥ 0 attendu');
    if (s.label !== undefined && !isStr(s.label)) e.add(`${sp}.label`, 'texte attendu');
    if (s.scale !== undefined) {
      if (!isObj(s.scale)) e.add(`${sp}.scale`, 'objet attendu');
      else
        for (const [k, v] of Object.entries(s.scale)) {
          if (!ENEMY_SCALE_KEYS.includes(k)) e.add(`${sp}.scale.${k}`, `un de ${ENEMY_SCALE_KEYS.join('|')}`);
          else if (!isPosNum(v)) e.add(`${sp}.scale.${k}`, 'nombre > 0 attendu');
        }
    }
  });
  const hasBoss = (w?.spawns ?? []).some((s) => enemyById.get(s?.enemy)?.boss);
  if (w?.requiresBossKill && !hasBoss) e.add(p, '"requiresBossKill" sans aucun boss dans les apparitions');
  if (w?.bossTimeLimit !== undefined && !hasBoss) e.add(p, '"bossTimeLimit" sans aucun boss dans les apparitions');
}

/**
 * Valide une vague isolée (utile pour les vagues générées à la volée par le mode infini).
 * @returns {string[]} liste d'erreurs
 */
export function validateWaveDef(wave, enemies, path = 'wave') {
  const e = new Errors();
  checkWave(e, path, wave, enemies);
  return e.list;
}

/** Validation de `endless.json` (paramètres du générateur de vagues infinies). */
function checkEndless(e, endless, enemies) {
  const p = 'endless';
  if (!requireFields(e, p, endless, {
    waveDuration: [isPosNum, 'nombre > 0'],
    bossEvery: [(v) => Number.isInteger(v) && v >= 1, 'entier ≥ 1'],
    bossTimeLimit: [isPosNum, 'nombre > 0'],
    bosses: [(v) => Array.isArray(v) && v.length > 0, 'tableau non vide'],
    spawnPools: [(v) => Array.isArray(v) && v.length > 0, 'tableau non vide'],
    enemyScaling: [isObj, 'objet'],
    bossScaling: [isObj, 'objet'],
  })) return;
  const enemyById = new Map((Array.isArray(enemies) ? enemies : []).map((en) => [en?.id, en]));
  endless.bosses.forEach((id, i) => {
    const def = enemyById.get(id);
    if (!def) e.add(`${p}.bosses[${i}]`, `ennemi inconnu "${id}"`);
    else if (!def.boss) e.add(`${p}.bosses[${i}]`, `"${id}" n'est pas un boss`);
  });
  endless.spawnPools.forEach((pool, i) => {
    const pp = `${p}.spawnPools[${i}]`;
    if (!requireFields(e, pp, pool, {
      enemy: [(v) => enemyById.has(v), 'ennemi connu'],
      fromWave: [(v) => Number.isInteger(v) && v >= 1, 'entier ≥ 1'],
      interval: [isPosNum, 'nombre > 0'],
      batch: [isPosNum, 'nombre > 0'],
    })) return;
    if (enemyById.get(pool.enemy)?.boss) e.add(`${pp}.enemy`, 'un boss ne peut pas être un ennemi de vague normale');
    for (const k of ['intervalEnd', 'batchPerWave', 'maxBatch']) {
      if (pool[k] !== undefined && !(isNum(pool[k]) && pool[k] >= 0)) e.add(`${pp}.${k}`, 'nombre ≥ 0 attendu');
    }
  });
  if (!endless.spawnPools.some((pool) => pool?.fromWave === 1)) e.add(`${p}.spawnPools`, 'au moins une règle doit commencer à la vague 1');
  for (const [k, v] of Object.entries(endless.enemyScaling)) if (!(isNum(v) && v >= 0)) e.add(`${p}.enemyScaling.${k}`, 'nombre ≥ 0 attendu');
  for (const [k, v] of Object.entries(endless.bossScaling)) if (!isPosNum(v)) e.add(`${p}.bossScaling.${k}`, 'nombre > 0 attendu');
  if (endless.intervalDecay !== undefined && !(isPosNum(endless.intervalDecay) && endless.intervalDecay <= 1)) e.add(`${p}.intervalDecay`, 'nombre dans ]0, 1]');
  if (endless.runOverrides?.xpCurve !== undefined) {
    requireFields(e, `${p}.runOverrides.xpCurve`, endless.runOverrides.xpCurve, { base: [isPosNum, 'nombre > 0'], growth: [(v) => isNum(v) && v >= 1, 'nombre ≥ 1'] });
  }
}

/**
 * @param {{config: any, player: any, enemies: any[], weapons: any[], waves: any, upgrades: any[], metaUpgrades: any[], endless: any}} content
 * @returns {string[]} liste d'erreurs (vide si valide)
 */
export function validateContent(content) {
  const e = new Errors();
  const { config, player, enemies, weapons, waves, upgrades, metaUpgrades, endless } = content ?? {};

  // --- config -------------------------------------------------------------
  if (requireFields(e, 'config', config, { run: [isObj, 'objet'], rewards: [isObj, 'objet'] })) {
    const run = config.run ?? {};
    requireFields(e, 'config.run', run, {
      upgradeChoices: [(v) => Number.isInteger(v) && v >= 1, 'entier ≥ 1'],
      xpCurve: [isObj, 'objet'],
      maxEnemies: [isPosNum, 'nombre > 0'],
      spawnRadius: [isObj, 'objet'],
      despawnRadius: [isPosNum, 'nombre > 0'],
    });
    if (isObj(run.xpCurve)) {
      requireFields(e, 'config.run.xpCurve', run.xpCurve, { base: [isPosNum, 'nombre > 0'], growth: [(v) => isNum(v) && v >= 1, 'nombre ≥ 1'] });
    }
    requireFields(e, 'config.rewards', config.rewards, {
      shardsPerScore: [(v) => isNum(v) && v >= 0, 'nombre ≥ 0'],
      victoryBonus: [(v) => isNum(v) && v >= 0, 'nombre ≥ 0'],
    });
    const bossBonus = config.rewards?.endlessBossKillBonus;
    if (bossBonus !== undefined && !(isNum(bossBonus) && bossBonus >= 0)) e.add('config.rewards.endlessBossKillBonus', 'nombre ≥ 0 attendu');
  }

  // --- armes ---------------------------------------------------------------
  let weaponIds = new Set();
  if (!Array.isArray(weapons)) e.add('weapons', 'tableau attendu');
  else {
    weaponIds = uniqueIds(e, 'weapons', weapons);
    weapons.forEach((w, i) => {
      requireFields(e, `weapons[${i}]`, w, { name: [isStr, 'texte'], kind: [(v) => WEAPON_KINDS.includes(v), `un de ${WEAPON_KINDS.join('|')}`], stats: [isObj, 'objet'] });
      if (w?.targeting !== undefined && !WEAPON_TARGETING.includes(w.targeting)) {
        e.add(`weapons[${i}].targeting`, `un de ${WEAPON_TARGETING.join('|')}`);
      }
      if (isObj(w?.stats)) {
        for (const [k, v] of Object.entries(w.stats)) if (!isNum(v)) e.add(`weapons[${i}].stats.${k}`, 'nombre attendu');
      }
    });
  }
  const weaponById = new Map((Array.isArray(weapons) ? weapons : []).map((w) => [w?.id, w]));

  // --- joueur --------------------------------------------------------------
  let statKeys = new Set();
  if (requireFields(e, 'player', player, { radius: [isPosNum, 'nombre > 0'], baseStats: [isObj, 'objet'], startingWeapons: [Array.isArray, 'tableau'] })) {
    if (isObj(player.baseStats)) {
      statKeys = new Set(Object.keys(player.baseStats));
      for (const [k, v] of Object.entries(player.baseStats)) if (!isNum(v)) e.add(`player.baseStats.${k}`, 'nombre attendu');
      if (!(player.baseStats.maxHp > 0)) e.add('player.baseStats.maxHp', 'doit être > 0');
    }
    (player.startingWeapons ?? []).forEach((id, i) => {
      if (!weaponIds.has(id)) e.add(`player.startingWeapons[${i}]`, `arme inconnue "${id}"`);
    });
  }

  // --- ennemis ------------------------------------------------------------
  if (!Array.isArray(enemies)) e.add('enemies', 'tableau attendu');
  else {
    uniqueIds(e, 'enemies', enemies);
    enemies.forEach((en, i) =>
      requireFields(e, `enemies[${i}]`, en, {
        name: [isStr, 'texte'],
        behavior: [(v) => ENEMY_BEHAVIORS.includes(v), `un de ${ENEMY_BEHAVIORS.join('|')}`],
        hp: [isPosNum, 'nombre > 0'],
        speed: [(v) => isNum(v) && v >= 0, 'nombre ≥ 0'],
        damage: [(v) => isNum(v) && v >= 0, 'nombre ≥ 0'],
        radius: [isPosNum, 'nombre > 0'],
        xp: [(v) => isNum(v) && v >= 0, 'nombre ≥ 0'],
        score: [(v) => isNum(v) && v >= 0, 'nombre ≥ 0'],
      }),
    );
  }

  // --- vagues -------------------------------------------------------------
  if (!isObj(waves) || !Array.isArray(waves.waves) || waves.waves.length === 0) e.add('waves.waves', 'tableau non vide attendu');
  else {
    uniqueIds(e, 'waves.waves', waves.waves);
    waves.waves.forEach((w, i) => checkWave(e, `waves.waves[${i}]`, w, enemies));
  }

  // --- mode infini ------------------------------------------------------------
  checkEndless(e, endless, enemies);

  // --- effets partagés ------------------------------------------------------
  const checkStatModifier = (path, fx, valueKey) => {
    if (!statKeys.has(fx.stat)) e.add(`${path}.stat`, `statistique inconnue "${fx.stat}"`);
    if (!MODIFIER_OPS.includes(fx.op)) e.add(`${path}.op`, `un de ${MODIFIER_OPS.join('|')}`);
    if (!isNum(fx[valueKey])) e.add(`${path}.${valueKey}`, 'nombre attendu');
  };

  // --- améliorations de run ----------------------------------------------------
  if (!Array.isArray(upgrades) || upgrades.length === 0) e.add('upgrades', 'tableau non vide attendu');
  else {
    uniqueIds(e, 'upgrades', upgrades);
    upgrades.forEach((u, i) => {
      const p = `upgrades[${i}]`;
      requireFields(e, p, u, {
        name: [isStr, 'texte'],
        weight: [(v) => isNum(v) && v >= 0, 'nombre ≥ 0'],
        maxStacks: [(v) => Number.isInteger(v) && v >= 1, 'entier ≥ 1'],
        effects: [(v) => Array.isArray(v) && v.length > 0, 'tableau non vide'],
      });
      if (u?.hardMaxStacks !== undefined && !(Number.isInteger(u.hardMaxStacks) && u.hardMaxStacks >= u.maxStacks)) {
        e.add(`${p}.hardMaxStacks`, 'entier ≥ maxStacks attendu');
      }
      if (u?.requires) {
        for (const key of ['weapon', 'missingWeapon']) {
          if (u.requires[key] !== undefined && !weaponIds.has(u.requires[key])) e.add(`${p}.requires.${key}`, `arme inconnue "${u.requires[key]}"`);
        }
      }
      (u?.effects ?? []).forEach((fx, j) => {
        const fp = `${p}.effects[${j}]`;
        if (!isObj(fx) || !UPGRADE_EFFECT_TYPES.includes(fx.type)) return e.add(`${fp}.type`, `un de ${UPGRADE_EFFECT_TYPES.join('|')}`);
        if (fx.type === 'stat') checkStatModifier(fp, fx, 'value');
        if (fx.type === 'heal' && !isPosNum(fx.amount)) e.add(`${fp}.amount`, 'nombre > 0 attendu');
        if (fx.type === 'grantWeapon' && !weaponIds.has(fx.weapon)) e.add(`${fp}.weapon`, `arme inconnue "${fx.weapon}"`);
        if (fx.type === 'weaponStat') {
          const weapon = weaponById.get(fx.weapon);
          if (!weapon) e.add(`${fp}.weapon`, `arme inconnue "${fx.weapon}"`);
          else if (!(fx.stat in (weapon.stats ?? {}))) e.add(`${fp}.stat`, `stat "${fx.stat}" absente de l'arme "${fx.weapon}"`);
          if (!MODIFIER_OPS.includes(fx.op)) e.add(`${fp}.op`, `un de ${MODIFIER_OPS.join('|')}`);
          if (!isNum(fx.value)) e.add(`${fp}.value`, 'nombre attendu');
        }
      });
    });
  }

  // --- améliorations méta ------------------------------------------------------
  if (!Array.isArray(metaUpgrades)) e.add('metaUpgrades', 'tableau attendu');
  else {
    uniqueIds(e, 'metaUpgrades', metaUpgrades);
    metaUpgrades.forEach((m, i) => {
      const p = `metaUpgrades[${i}]`;
      requireFields(e, p, m, {
        name: [isStr, 'texte'],
        costs: [(v) => Array.isArray(v) && v.length > 0 && v.every((c) => Number.isInteger(c) && c > 0), 'tableau d\'entiers > 0'],
      });
      // `effects` (liste) ou `effect` (forme historique à un seul effet), pas les deux
      if ((m?.effects === undefined) === (m?.effect === undefined)) e.add(p, 'définir soit "effects" (tableau) soit "effect" (objet)');
      else if (m.effects !== undefined && !(Array.isArray(m.effects) && m.effects.length > 0)) e.add(`${p}.effects`, 'tableau non vide attendu');
      metaEffects(m).forEach((fx, j) => {
        const fp = m.effects ? `${p}.effects[${j}]` : `${p}.effect`;
        if (!isObj(fx) || !META_EFFECT_TYPES.includes(fx.type)) return e.add(`${fp}.type`, `un de ${META_EFFECT_TYPES.join('|')}`);
        if (fx.type === 'stat') checkStatModifier(fp, fx, 'valuePerLevel');
        if (fx.type === 'startingWeapon' && !weaponIds.has(fx.weapon)) e.add(`${fp}.weapon`, `arme inconnue "${fx.weapon}"`);
        if (fx.type === 'weaponStat') {
          const weapon = weaponById.get(fx.weapon);
          if (!weapon) e.add(`${fp}.weapon`, `arme inconnue "${fx.weapon}"`);
          else if (!(fx.stat in (weapon.stats ?? {}))) e.add(`${fp}.stat`, `stat "${fx.stat}" absente de l'arme "${fx.weapon}"`);
          if (!MODIFIER_OPS.includes(fx.op)) e.add(`${fp}.op`, `un de ${MODIFIER_OPS.join('|')}`);
          if (!isNum(fx.valuePerLevel)) e.add(`${fp}.valuePerLevel`, 'nombre attendu');
        }
        if (fx.everyLevels !== undefined && !(Number.isInteger(fx.everyLevels) && fx.everyLevels >= 1)) {
          e.add(`${fp}.everyLevels`, 'entier ≥ 1 attendu');
        }
      });
      if (m?.icon !== undefined && !isStr(m.icon)) e.add(`${p}.icon`, 'texte attendu');
    });
  }

  return e.list;
}
