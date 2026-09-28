/**
 * Règles de méta-progression — fonctions PURES et isomorphes.
 *
 * Utilisées par le serveur (source de vérité : il calcule lui-même les récompenses
 * à partir du résumé de run, le client n'envoie jamais un solde de monnaie) et par
 * le dépôt local de secours côté navigateur. Aucune dépendance au gameplay : la
 * méta ne connaît qu'un « résumé de run » et un catalogue d'améliorations.
 */
import { GAME_MODES } from '../content/vocabulary.js';

export const PROFILE_VERSION = 1;

export function createEmptyProfile() {
  return {
    version: PROFILE_VERSION,
    shards: 0,
    totalShardsEarned: 0,
    upgrades: {},
    stats: { runs: 0, victories: 0, bestScore: 0, bestTime: 0, totalKills: 0, bestEndlessWave: 0, endlessBossKills: 0 },
    lastRun: null,
  };
}

const nonNegInt = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const nonNegNum = (v) => (Number.isFinite(v) && v > 0 ? v : 0);

/**
 * Normalise un profil lu depuis le disque / le réseau (migration de version,
 * champs manquants, valeurs corrompues). Ne lève jamais : un profil illisible
 * redevient un profil vierge plutôt que de bloquer le jeu.
 */
export function sanitizeProfile(raw) {
  const base = createEmptyProfile();
  if (!raw || typeof raw !== 'object') return base;
  const upgrades = {};
  if (raw.upgrades && typeof raw.upgrades === 'object') {
    for (const [id, lvl] of Object.entries(raw.upgrades)) {
      const n = nonNegInt(lvl);
      if (n > 0) upgrades[id] = n;
    }
  }
  const s = raw.stats ?? {};
  return {
    version: PROFILE_VERSION,
    shards: nonNegInt(raw.shards),
    totalShardsEarned: nonNegInt(raw.totalShardsEarned),
    upgrades,
    stats: {
      runs: nonNegInt(s.runs),
      victories: nonNegInt(s.victories),
      bestScore: nonNegInt(s.bestScore),
      bestTime: nonNegNum(s.bestTime),
      totalKills: nonNegInt(s.totalKills),
      bestEndlessWave: nonNegInt(s.bestEndlessWave),
      endlessBossKills: nonNegInt(s.endlessBossKills),
    },
    lastRun:
      raw.lastRun && typeof raw.lastRun === 'object'
        ? { ...sanitizeRunSummary(raw.lastRun), reward: nonNegInt(raw.lastRun.reward) }
        : null,
  };
}

const OUTCOMES = ['victory', 'defeat', 'abandon'];

/** Assainit un résumé de run reçu du client. */
export function sanitizeRunSummary(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const mode = GAME_MODES.includes(r.mode) ? r.mode : 'story';
  const wave = nonNegInt(r.wave);
  return {
    mode,
    // une run infinie ne se « gagne » jamais : elle s'arrête par défaite ou abandon
    outcome: OUTCOMES.includes(r.outcome) && !(mode === 'endless' && r.outcome === 'victory') ? r.outcome : 'abandon',
    score: nonNegInt(r.score),
    kills: nonNegInt(r.kills),
    level: Math.max(1, nonNegInt(r.level)),
    wave,
    // au plus un boss par vague atteinte (garde-fou contre un résumé incohérent)
    bossKills: Math.min(nonNegInt(r.bossKills), wave),
    duration: Math.round(nonNegNum(r.duration) * 10) / 10,
  };
}

/** Monnaie gagnée pour une run. */
export function computeReward(summary, rewards) {
  const base = Math.floor(summary.score * (rewards.shardsPerScore ?? 0));
  const bonus = summary.outcome === 'victory' ? rewards.victoryBonus ?? 0 : 0;
  const bossBonus = summary.mode === 'endless' ? (summary.bossKills ?? 0) * (rewards.endlessBossKillBonus ?? 0) : 0;
  const total = base + bonus + bossBonus;
  if (summary.outcome === 'abandon' && summary.duration < 5) return 0;
  return Math.max(total, rewards.minShards ?? 0);
}

/**
 * Applique le résultat d'une run au profil (immuable).
 * @returns {{ profile: object, reward: number, run: object }}
 */
export function applyRunResult(profile, rawSummary, rewards) {
  const run = sanitizeRunSummary(rawSummary);
  const reward = computeReward(run, rewards);
  const p = sanitizeProfile(profile);
  const endless = run.mode === 'endless';
  return {
    run,
    reward,
    profile: {
      ...p,
      shards: p.shards + reward,
      totalShardsEarned: p.totalShardsEarned + reward,
      stats: {
        runs: p.stats.runs + 1,
        victories: p.stats.victories + (run.outcome === 'victory' ? 1 : 0),
        bestScore: Math.max(p.stats.bestScore, run.score),
        bestTime: Math.max(p.stats.bestTime, run.duration),
        totalKills: p.stats.totalKills + run.kills,
        bestEndlessWave: endless ? Math.max(p.stats.bestEndlessWave, run.wave) : p.stats.bestEndlessWave,
        endlessBossKills: p.stats.endlessBossKills + (endless ? run.bossKills : 0),
      },
      lastRun: { ...run, reward },
    },
  };
}

export function upgradeLevel(profile, id) {
  return profile.upgrades?.[id] ?? 0;
}

/** Prix du prochain niveau, ou null si niveau max atteint. */
export function nextCost(profile, metaUpgrade) {
  const lvl = upgradeLevel(profile, metaUpgrade.id);
  return lvl < metaUpgrade.costs.length ? metaUpgrade.costs[lvl] : null;
}

/**
 * Achète le niveau suivant d'une amélioration méta.
 * @returns {{ ok: true, profile: object } | { ok: false, error: string }}
 */
export function purchaseUpgrade(profile, upgradeId, catalog) {
  const p = sanitizeProfile(profile);
  const meta = catalog.find((m) => m.id === upgradeId);
  if (!meta) return { ok: false, error: 'unknown_upgrade' };
  const cost = nextCost(p, meta);
  if (cost === null) return { ok: false, error: 'max_level' };
  if (p.shards < cost) return { ok: false, error: 'not_enough_shards' };
  return {
    ok: true,
    profile: { ...p, shards: p.shards - cost, upgrades: { ...p.upgrades, [upgradeId]: upgradeLevel(p, upgradeId) + 1 } },
  };
}

/**
 * Effets d'une amélioration méta : `effects` (liste) ou `effect` (forme historique à un seul effet).
 * @returns {any[]}
 */
export function metaEffects(meta) {
  if (Array.isArray(meta?.effects)) return meta.effects;
  return meta?.effect ? [meta.effect] : [];
}

/**
 * Nombre de « paliers » atteints par un effet au niveau `lvl`. Par défaut chaque
 * niveau compte ; avec `everyLevels: 5`, l'effet ne progresse qu'aux niveaux 5, 10…
 * (utile pour les stats entières : projectiles, perforation, nombre de lames).
 */
export function effectSteps(fx, lvl) {
  return Math.floor(lvl / (fx.everyLevels ?? 1));
}

/**
 * Traduit le profil en « modificateurs de run » : c'est la SEULE interface entre
 * méta-progression et gameplay. Le gameplay reçoit des données, pas un service.
 * @returns {{
 *   statModifiers: {stat: string, op: 'add'|'mul', value: number, source: string}[],
 *   startingWeapons: string[],
 *   weaponModifiers: {weapon: string, stat: string, op: 'add'|'mul', value: number, source: string}[],
 * }}
 */
export function computeRunModifiers(profile, catalog) {
  const statModifiers = [];
  const startingWeapons = [];
  const weaponModifiers = [];
  for (const meta of catalog) {
    const lvl = upgradeLevel(profile, meta.id);
    if (lvl <= 0) continue;
    for (const fx of metaEffects(meta)) {
      if (fx.type === 'startingWeapon') {
        startingWeapons.push(fx.weapon);
        continue;
      }
      const steps = effectSteps(fx, lvl);
      if (steps <= 0) continue; // palier pas encore atteint
      const value = fx.valuePerLevel * steps;
      if (fx.type === 'stat') statModifiers.push({ stat: fx.stat, op: fx.op, value, source: meta.id });
      else if (fx.type === 'weaponStat') weaponModifiers.push({ weapon: fx.weapon, stat: fx.stat, op: fx.op, value, source: meta.id });
    }
  }
  return { statModifiers, startingWeapons, weaponModifiers };
}
