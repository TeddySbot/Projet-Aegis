import { GameEvents } from '../../core/events.js';
import { GameSystem } from './GameSystem.js';

/**
 * WaveSystem — orchestre les vagues définies dans `waves.json`.
 *
 * Chaque vague a une durée et des règles d'apparition :
 *  - périodiques : { enemy, interval, intervalEnd?, batch?, start?, end? }
 *    (l'intervalle est interpolé linéairement de `interval` à `intervalEnd` → montée en difficulté)
 *  - ponctuelles : { enemy, at, count? }
 * Une vague `requiresBossKill` ne se termine qu'une fois ses boss vaincus.
 *
 * Il ne sait rien du score, de l'XP ni de l'UI : il émet WAVE_STARTED, WAVE_COMPLETED,
 * ALL_WAVES_COMPLETED, ENEMY_SPAWNED, BOSS_SPAWNED.
 */
export class WaveSystem extends GameSystem {
  /**
   * @param {{
   *   bus: any, world: import('../World.js').World, waves: any[],
   *   enemyFactory: import('../entities/EnemyFactory.js').EnemyFactory,
   *   rng: import('../../core/Random.js').Random,
   *   runConfig: { maxEnemies: number, spawnRadius: {min: number, max: number} },
   * }} deps
   */
  constructor({ bus, world, waves, enemyFactory, rng, runConfig }) {
    super('waves', bus);
    this._world = world;
    this._waves = waves;
    this._factory = enemyFactory;
    this._rng = rng;
    this._cfg = runConfig;
    this.index = -1;
    this.waveTime = 0;
    this.finished = false;
    this._rules = [];
    this._bosses = new Set();

    this.subs.on(GameEvents.ENEMY_KILLED, ({ enemy }) => this._bosses.delete(enemy));
    this.subs.on(GameEvents.RUN_STARTED, () => this._startWave(0));
  }

  get currentWave() {
    return this._waves[this.index] ?? null;
  }

  update(dt) {
    if (this.finished || this.index < 0) return;
    const wave = this.currentWave;
    this.waveTime += dt;

    for (const rule of this._rules) this._runRule(rule, wave);

    const timeUp = this.waveTime >= wave.duration;
    const bossesDown = !wave.requiresBossKill || (this._bossSpawned && this._bosses.size === 0);
    if (timeUp && bossesDown) {
      this.bus.emit(GameEvents.WAVE_COMPLETED, { index: this.index });
      if (this.index + 1 < this._waves.length) this._startWave(this.index + 1);
      else {
        this.finished = true;
        this.bus.emit(GameEvents.ALL_WAVES_COMPLETED, {});
      }
    }
  }

  _startWave(index) {
    this.index = index;
    this.waveTime = 0;
    this._bossSpawned = false;
    const wave = this._waves[index];
    this._rules = wave.spawns.map((def) => ({ def, next: def.start ?? def.at ?? 0, done: false }));
    this.bus.emit(GameEvents.WAVE_STARTED, { index, total: this._waves.length, wave });
  }

  _runRule(rule, wave) {
    const { def } = rule;
    if (rule.done || this.waveTime < rule.next) return;

    if (def.at !== undefined) {
      rule.done = true;
      this._spawn(def.enemy, def.count ?? 1, true);
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
    this._spawn(def.enemy, def.batch ?? 1, false);
  }

  _spawn(typeId, count, force) {
    const { player, enemies } = this._world;
    for (let i = 0; i < count; i++) {
      if (!force && enemies.length >= this._cfg.maxEnemies) return;
      const angle = this._rng.range(0, Math.PI * 2);
      const dist = this._rng.range(this._cfg.spawnRadius.min, this._cfg.spawnRadius.max);
      const enemy = this._factory.create(typeId, player.x + Math.cos(angle) * dist, player.y + Math.sin(angle) * dist);
      enemies.push(enemy);
      this.bus.emit(GameEvents.ENEMY_SPAWNED, { enemy });
      if (enemy.boss) {
        this._bosses.add(enemy);
        this._bossSpawned = true;
        this.bus.emit(GameEvents.BOSS_SPAWNED, { enemy });
      }
    }
  }
}
