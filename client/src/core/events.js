/**
 * Catalogue des événements du jeu — le « contrat » entre systèmes.
 *
 * Chaque système ne dépend que de ces noms et de la forme des payloads documentée
 * ici, jamais des autres systèmes. Ajouter un abonné (ex : un système de succès)
 * ne demande de modifier aucun émetteur.
 */
export const GameEvents = Object.freeze({
  // --- Cycle de vie d'une run ---------------------------------------------
  /** { mode: 'story'|'endless', seed, modifiers, disabled: string[], player: { hp, maxHp, weapons: {id, name}[] } } */
  RUN_STARTED: 'run:started',
  /**
   * Résumé de run : { mode, outcome: 'victory'|'defeat'|'abandon', cause: 'victory'|'death'|'bossTimeout'|'abandon',
   *   duration, score, kills, level, wave, bossKills }
   */
  RUN_ENDED: 'run:ended',
  /** { elapsed: number } — émis chaque seconde de jeu */
  RUN_TICK: 'run:tick',

  // --- Vagues ------------------------------------------------------------
  /** { index: number, total: number|null (null = infini), wave: WaveDef } */
  WAVE_STARTED: 'wave:started',
  /** { enemy, tier: number|null } — `enemy.name` porte le nom affiché (ex : « Gardien déchu · Palier 2 ») */
  BOSS_SPAWNED: 'wave:boss-spawned',
  /** { duration } — le boss doit être vaincu avant la fin du compte à rebours (`bossTimeLimit`) */
  BOSS_TIMER_STARTED: 'wave:boss-timer-started',
  /** { remaining: number (secondes entières), duration } */
  BOSS_TIMER_TICK: 'wave:boss-timer-tick',
  /** { expired: boolean, remaining } — expired = temps écoulé (défaite), sinon boss vaincu à temps */
  BOSS_TIMER_STOPPED: 'wave:boss-timer-stopped',
  /** { index: number } */
  WAVE_COMPLETED: 'wave:completed',
  /** {} — toutes les vagues ont été survécues */
  ALL_WAVES_COMPLETED: 'wave:all-completed',

  // --- Ennemis & combat ---------------------------------------------------
  /** { enemy } */
  ENEMY_SPAWNED: 'enemy:spawned',
  /** { enemy, amount, x, y, critical: boolean } */
  ENEMY_DAMAGED: 'enemy:damaged',
  /** { enemy, typeId, x, y, xp, score, boss: boolean } */
  ENEMY_KILLED: 'enemy:killed',
  /** { weaponId, kind, x, y, radius?, color } */
  WEAPON_FIRED: 'weapon:fired',
  /** { enemy } — un ennemi à charge prépare son attaque (télégraphie) */
  ENEMY_TELEGRAPH: 'enemy:telegraph',

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
  /** { weaponId, name } */
  WEAPON_GRANTED: 'weapon:granted',

  // --- Score --------------------------------------------------------------
  /** { score, delta } */
  SCORE_CHANGED: 'score:changed',

  // --- Méta-progression ---------------------------------------------------
  /** { profile } */
  PROFILE_UPDATED: 'meta:profile-updated',
  /** { run, profile, reward, newEndlessRecord: boolean } */
  META_RUN_RECORDED: 'meta:run-recorded',
  /** { message } */
  META_SAVE_FAILED: 'meta:save-failed',
});
