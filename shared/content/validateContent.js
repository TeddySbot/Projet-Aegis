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
} from './vocabulary.js';

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
 * @param {{config: any, player: any, enemies: any[], weapons: any[], waves: any, upgrades: any[], metaUpgrades: any[]}} content
 * @returns {string[]} liste d'erreurs (vide si valide)
 */
export function validateContent(content) {
  const e = new Errors();
  const { config, player, enemies, weapons, waves, upgrades, metaUpgrades } = content ?? {};

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
  let enemyIds = new Set();
  if (!Array.isArray(enemies)) e.add('enemies', 'tableau attendu');
  else {
    enemyIds = uniqueIds(e, 'enemies', enemies);
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
    waves.waves.forEach((w, i) => {
      const p = `waves.waves[${i}]`;
      requireFields(e, p, w, { duration: [isPosNum, 'nombre > 0'], spawns: [Array.isArray, 'tableau'] });
      (w?.spawns ?? []).forEach((s, j) => {
        const sp = `${p}.spawns[${j}]`;
        if (!isObj(s)) return e.add(sp, 'objet attendu');
        if (!enemyIds.has(s.enemy)) e.add(`${sp}.enemy`, `ennemi inconnu "${s.enemy}"`);
        const periodic = s.interval !== undefined;
        const oneShot = s.at !== undefined;
        if (periodic === oneShot) e.add(sp, 'définir soit "interval" (périodique) soit "at" (ponctuel)');
        if (periodic && !isPosNum(s.interval)) e.add(`${sp}.interval`, 'nombre > 0 attendu');
        if (s.intervalEnd !== undefined && !isPosNum(s.intervalEnd)) e.add(`${sp}.intervalEnd`, 'nombre > 0 attendu');
        if (oneShot && !(isNum(s.at) && s.at >= 0)) e.add(`${sp}.at`, 'nombre ≥ 0 attendu');
      });
      if (w?.requiresBossKill) {
        const hasBoss = (w.spawns ?? []).some((s) => enemies?.find?.((en) => en.id === s.enemy)?.boss);
        if (!hasBoss) e.add(p, '"requiresBossKill" sans aucun boss dans les apparitions');
      }
    });
  }

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
        effect: [isObj, 'objet'],
      });
      const fx = m?.effect;
      if (!isObj(fx)) return;
      if (!META_EFFECT_TYPES.includes(fx.type)) return e.add(`${p}.effect.type`, `un de ${META_EFFECT_TYPES.join('|')}`);
      if (fx.type === 'stat') checkStatModifier(`${p}.effect`, fx, 'valuePerLevel');
      if (fx.type === 'startingWeapon' && !weaponIds.has(fx.weapon)) e.add(`${p}.effect.weapon`, `arme inconnue "${fx.weapon}"`);
    });
  }

  return e.list;
}
