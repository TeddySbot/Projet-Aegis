/**
 * EndlessWaveProvider — génère à la demande une suite INFINIE de vagues à partir des
 * paramètres de `endless.json` (mode infini). Même interface que ScriptedWaveProvider :
 * le WaveSystem ne sait pas si ses vagues sont écrites à la main ou calculées.
 *
 *  - vague n (n = index + 1) : les règles de `spawnPools` débloquées (`fromWave ≤ n`),
 *    de plus en plus fréquentes (`intervalDecay`) et nombreuses (`batchPerWave`),
 *    avec des ennemis plus résistants (`enemyScaling` → champ `scale` des règles) ;
 *  - toutes les `bossEvery` vagues : une vague de boss. Le boss (tournant parmi `bosses`)
 *    grossit et se renforce à chaque palier (`bossScaling`) et doit être tué en moins
 *    de `bossTimeLimit` secondes (géré par le WaveSystem).
 *
 * Génération purement déterministe (aucun aléa) : la vague n est toujours identique.
 */
const round = (v) => Math.round(v * 1000) / 1000;

export class EndlessWaveProvider {
  /** @param {{ def: any, enemies: any[] }} deps */
  constructor({ def, enemies }) {
    this._def = def;
    this._enemies = new Map(enemies.map((e) => [e.id, e]));
    this.total = null;
  }

  /** @param {number} index index de vague (0 = première vague) */
  get(index) {
    const n = index + 1;
    return this.isBossWave(n) ? this._bossWave(n) : this._normalWave(n);
  }

  isBossWave(n) {
    return n % this._def.bossEvery === 0;
  }

  /** Multiplicateurs appliqués aux ennemis ordinaires de la vague n. */
  enemyScale(n) {
    const s = this._def.enemyScaling;
    const k = n - 1;
    return {
      hp: round((1 + (s.hpPerWave ?? 0) * k) * Math.pow(s.hpGrowth ?? 1, k)),
      damage: round(1 + (s.damagePerWave ?? 0) * k),
      speed: round(Math.min(s.maxSpeed ?? Infinity, 1 + (s.speedPerWave ?? 0) * k)),
      xp: round(1 + (s.xpPerWave ?? 0) * k),
      score: round(1 + (s.scorePerWave ?? 0) * k),
    };
  }

  /** Multiplicateurs du boss du palier `tier` (1 = premier boss). */
  bossScale(tier) {
    const s = this._def.bossScaling;
    const k = tier - 1;
    return {
      hp: round((s.hpStart ?? 1) * Math.pow(s.hpGrowth ?? 1, k)),
      damage: round(Math.pow(s.damageGrowth ?? 1, k)),
      speed: round(Math.min(s.maxSpeed ?? Infinity, Math.pow(s.speedGrowth ?? 1, k))),
      radius: round(Math.min(s.maxSize ?? Infinity, (s.sizeStart ?? 1) + (s.sizePerTier ?? 0) * k)),
      xp: round(Math.pow(s.xpGrowth ?? 1, k)),
      score: round(Math.pow(s.scoreGrowth ?? 1, k)),
    };
  }

  /** Règles d'apparition des ennemis ordinaires à la vague n (`rate` < 1 = moins d'ennemis). */
  _pools(n, rate = 1) {
    const d = this._def;
    const scale = this.enemyScale(n);
    const minInterval = d.minInterval ?? 0.1;
    return d.spawnPools
      .filter((pool) => pool.fromWave <= n)
      .map((pool) => {
        const age = n - pool.fromWave;
        const decay = Math.pow(d.intervalDecay ?? 1, age);
        const interval = Math.max(minInterval, pool.interval * decay) / rate;
        const intervalEnd = Math.max(minInterval, (pool.intervalEnd ?? pool.interval) * decay) / rate;
        const batch = Math.min(pool.maxBatch ?? Infinity, Math.round(pool.batch + (pool.batchPerWave ?? 0) * age));
        return { enemy: pool.enemy, interval: round(interval), intervalEnd: round(intervalEnd), batch: Math.max(1, batch), scale };
      });
  }

  _normalWave(n) {
    const d = this._def;
    const names = d.waveNames ?? [];
    const slot = (n - 1) % d.bossEvery;
    return {
      id: `endless_${n}`,
      name: names.length ? names[slot % names.length] : `Vague ${n}`,
      duration: d.waveDuration,
      spawns: this._pools(n),
    };
  }

  _bossWave(n) {
    const d = this._def;
    const tier = n / d.bossEvery;
    const bossId = d.bosses[(tier - 1) % d.bosses.length];
    const label = `${this._enemies.get(bossId)?.name ?? bossId} · Palier ${tier}`;
    const delay = d.bossSpawnDelay ?? 0;
    return {
      id: `endless_${n}`,
      name: label,
      // La vague se termine dès que le boss est tué (durée = délai d'apparition).
      duration: Math.max(0.1, delay),
      requiresBossKill: true,
      bossTimeLimit: d.bossTimeLimit,
      bossTier: tier,
      spawns: [{ enemy: bossId, at: delay, count: 1, label, scale: this.bossScale(tier) }, ...this._pools(n, d.bossWaveSpawnRate ?? 1)],
    };
  }
}
