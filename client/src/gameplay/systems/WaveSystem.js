import { GameEvents } from '../../core/events.js';
import { ScriptedWaveProvider } from '../waves/ScriptedWaveProvider.js';
import { GameSystem } from './GameSystem.js';

/**
 * WaveSystem — orchestre les vagues fournies par un « fournisseur de vagues »
 * (`waves.json` en campagne, générateur infini en mode infini : voir gameplay/waves/).
 *
 * Chaque vague a une durée et des règles d'apparition :
 *  - périodiques : { enemy, interval, intervalEnd?, batch?, start?, end?, scale?, label? }
 *    (l'intervalle est interpolé linéairement de `interval` à `intervalEnd` → montée en difficulté)
 *  - ponctuelles : { enemy, at, count?, scale?, label? }
 * `scale` multiplie les caractéristiques de l'ennemi (pv, dégâts, vitesse, taille, xp, score).
 * Une vague `requiresBossKill` ne se termine qu'une fois ses boss vaincus.
 * Une vague `bossTimeLimit` lance un compte à rebours à l'apparition du boss : s'il expire,
 * BOSS_TIMER_STOPPED { expired: true } est émis (le RunDirector en fait une défaite).
 *
 * Il ne sait rien du score, de l'XP ni de l'UI : il émet WAVE_STARTED, WAVE_COMPLETED,
 * ALL_WAVES_COMPLETED, ENEMY_SPAWNED, BOSS_SPAWNED et les événements BOSS_TIMER_*.
 */
export class WaveSystem extends GameSystem {
  /**
   * @param {{
   *   bus: any, world: import('../World.js').World,
   *   waves: any[] | { total: number|null, get(index: number): any },
   *   enemyFactory: import('../entities/EnemyFactory.js').EnemyFactory,
   *   rng: import('../../core/Random.js').Random,
   *   runConfig: { maxEnemies: number, spawnRadius: {min: number, max: number} },
   * }} deps
   */
  constructor({ bus, world, waves, enemyFactory, rng, runConfig }) {
    super('waves', bus);
    this._world = world;
    this._provider = Array.isArray(waves) ? new ScriptedWaveProvider(waves) : waves;
    this._factory = enemyFactory;
    this._rng = rng;
    this._cfg = runConfig;
    this.index = -1;
    this.waveTime = 0;
    this.finished = false;
    /** @type {any} */
    this.currentWave = null;
    this._rules = [];
    this._bosses = new Set();
    /** Compte à rebours de boss en cours : { remaining, duration, shown } | null */
    this.bossTimer = null;

    this.subs.on(GameEvents.ENEMY_KILLED, ({ enemy }) => this._bosses.delete(enemy));
    this.subs.on(GameEvents.RUN_STARTED, () => this._startWave(0));
  }

  update(dt) {
    if (this.finished || !this.currentWave) return;
    const wave = this.currentWave;
    this.waveTime += dt;

    for (const rule of this._rules) this._runRule(rule, wave);
    if (this.bossTimer && this._updateBossTimer(dt)) return;

    const timeUp = this.waveTime >= wave.duration;
    const bossesDown = !wave.requiresBossKill || (this._bossSpawned && this._bosses.size === 0);
    if (timeUp && bossesDown) {
      this.bus.emit(GameEvents.WAVE_COMPLETED, { index: this.index });
      if (!this._startWave(this.index + 1)) {
        this.finished = true;
        this.bus.emit(GameEvents.ALL_WAVES_COMPLETED, {});
      }
    }
  }

  /** @returns {boolean} true si le temps est écoulé (les vagues s'arrêtent). */
  _updateBossTimer(dt) {
    const timer = this.bossTimer;
    if (this._bosses.size === 0) {
      this.bossTimer = null;
      this.bus.emit(GameEvents.BOSS_TIMER_STOPPED, { expired: false, remaining: timer.remaining });
      return false;
    }
    timer.remaining = Math.max(0, timer.remaining - dt);
    const shown = Math.ceil(timer.remaining);
    if (shown !== timer.shown) {
      timer.shown = shown;
      this.bus.emit(GameEvents.BOSS_TIMER_TICK, { remaining: shown, duration: timer.duration });
    }
    if (timer.remaining > 0) return false;
    this.bossTimer = null;
    this.finished = true;
    this.bus.emit(GameEvents.BOSS_TIMER_STOPPED, { expired: true, remaining: 0 });
    return true;
  }

  /** @returns {boolean} false s'il n'y a plus de vague. */
  _startWave(index) {
    const wave = this._provider.get(index);
    if (!wave) return false;
    this.index = index;
    this.currentWave = wave;
    this.waveTime = 0;
    this._bossSpawned = false;
    this.bossTimer = null;
    this._rules = wave.spawns.map((def) => ({ def, next: def.start ?? def.at ?? 0, done: false }));
    this.bus.emit(GameEvents.WAVE_STARTED, { index, total: this._provider.total, wave });
    return true;
  }

  _runRule(rule, wave) {
    const { def } = rule;
    if (rule.done || this.waveTime < rule.next) return;

    if (def.at !== undefined) {
      rule.done = true;
      this._spawn(def, def.count ?? 1, true);
      return;
    }
    // Les règles périodiques continuent après la durée tant que la vague n'est pas finie
    // (ex : vague de boss) mais s'arrêtent à `end` si précisé.
    if (def.end !== undefined && this.waveTime > def.end) {
      rule.done = true;
      return;
    }
    const progress = Math.min(1, this.waveTime / wave.duration);
    const interval = def.interval + ((def.intervalEnd ?? def.interval) - def.interval) * progress;
    rule.next = this.waveTime + interval;
    this._spawn(def, def.batch ?? 1, false);
  }

  _spawn(rule, count, force) {
    const { player, enemies } = this._world;
    for (let i = 0; i < count; i++) {
      if (!force && enemies.length >= this._cfg.maxEnemies) return;
      const angle = this._rng.range(0, Math.PI * 2);
      const dist = this._rng.range(this._cfg.spawnRadius.min, this._cfg.spawnRadius.max);
      const enemy = this._factory.create(rule.enemy, player.x + Math.cos(angle) * dist, player.y + Math.sin(angle) * dist, {
        scale: rule.scale,
        label: rule.label,
      });
      enemies.push(enemy);
      this.bus.emit(GameEvents.ENEMY_SPAWNED, { enemy });
      if (enemy.boss) {
        this._bosses.add(enemy);
        this._bossSpawned = true;
        this.bus.emit(GameEvents.BOSS_SPAWNED, { enemy, tier: this.currentWave.bossTier ?? null });
        this._startBossTimer();
      }
    }
  }

  _startBossTimer() {
    const limit = this.currentWave.bossTimeLimit;
    if (!limit || this.bossTimer) return;
    this.bossTimer = { remaining: limit, duration: limit, shown: Math.ceil(limit) };
    this.bus.emit(GameEvents.BOSS_TIMER_STARTED, { duration: limit });
  }
}
