/**
 * Catalogue des événements du jeu — le « contrat » entre systèmes.
 *
 * Chaque système ne dépend que de ces noms et de la forme des payloads documentée
 * ici, jamais des autres systèmes. Ajouter un abonné (ex : un système de succès)
 * ne demande de modifier aucun émetteur.
 */
export const GameEvents = Object.freeze({
  // --- Cycle de vie d'une run ---------------------------------------------
  /** { seed: number, modifiers: object } */
  RUN_STARTED: 'run:started',
  /** { outcome: 'victory'|'defeat'|'abandon', duration: number } */
  RUN_ENDED: 'run:ended',
  /** Résumé agrégé, prêt pour l'UI et la méta : { outcome, duration, score, kills, level, wave } */
  RUN_SUMMARY_READY: 'run:summary-ready',
  /** { elapsed: number } — émis chaque seconde de jeu */
  RUN_TICK: 'run:tick',

  // --- Vagues ------------------------------------------------------------
  /** { index: number, total: number, wave: WaveDef } */
  WAVE_STARTED: 'wave:started',
  /** { index: number } */
  WAVE_COMPLETED: 'wave:completed',
  /** {} — toutes les vagues ont été survécues */
  ALL_WAVES_COMPLETED: 'wave:all-completed',

  // --- Ennemis & combat ---------------------------------------------------
  /** { enemy } */
  ENEMY_SPAWNED: 'enemy:spawned',
  /** { enemy, amount, x, y, critical: boolean } */
  ENEMY_DAMAGED: 'enemy:damaged',
  /** { enemy, typeId, x, y, xp, score } */
  ENEMY_KILLED: 'enemy:killed',
  /** { weaponId, x, y } */
  WEAPON_FIRED: 'weapon:fired',

  // --- Joueur ------------------------------------------------------------
  /** { amount, hp, maxHp } */
  PLAYER_DAMAGED: 'player:damaged',
  /** { amount, hp, maxHp } */
  PLAYER_HEALED: 'player:healed',
  /** {} */
  PLAYER_DIED: 'player:died',

  // --- Expérience & améliorations ----------------------------------------
  /** { x, y, value } */
  XP_ORB_SPAWNED: 'xp:orb-spawned',
  /** { amount, xp, xpToNext, level } */
  XP_GAINED: 'xp:gained',
  /** { level } */
  LEVEL_UP: 'xp:level-up',
  /** { level, choices: UpgradeDef[] } */
  UPGRADE_CHOICES_OFFERED: 'upgrade:choices-offered',
  /** { upgradeId } — émis par l'UI (ou l'IA de simulation) */
  UPGRADE_CHOSEN: 'upgrade:chosen',
  /** { upgrade, stacks } */
  UPGRADE_APPLIED: 'upgrade:applied',

  // --- Score --------------------------------------------------------------
  /** { score, delta } */
  SCORE_CHANGED: 'score:changed',

  // --- Méta-progression ---------------------------------------------------
  /** { profile } */
  PROFILE_UPDATED: 'meta:profile-updated',
  /** { run, profile, reward } */
  META_RUN_RECORDED: 'meta:run-recorded',
  /** { message } */
  META_SAVE_FAILED: 'meta:save-failed',
});
