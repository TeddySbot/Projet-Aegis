/**
 * Générateur pseudo-aléatoire à graine (mulberry32).
 * Injecté dans les systèmes de gameplay : une même graine rejoue la même run,
 * ce qui rend les tests et la simulation headless reproductibles.
 */
export class Random {
  constructor(seed = Date.now()) {
    this._state = seed >>> 0;
  }

  /** Flottant dans [0, 1). */
  next() {
    let t = (this._state = (this._state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + (max - min) * this.next();
  }

  int(min, maxInclusive) {
    return Math.floor(this.range(min, maxInclusive + 1));
  }

  pick(array) {
    return array[Math.floor(this.next() * array.length)];
  }

  /**
   * Tire jusqu'à `count` éléments distincts, pondérés par `weightOf(item)`.
   * @template T
   * @param {T[]} items
   * @param {number} count
   * @param {(item: T) => number} weightOf
   * @returns {T[]}
   */
  weightedSample(items, count, weightOf) {
    const pool = items.filter((it) => weightOf(it) > 0);
    const out = [];
    while (out.length < count && pool.length) {
      const total = pool.reduce((s, it) => s + weightOf(it), 0);
      let r = this.next() * total;
      let idx = 0;
      for (; idx < pool.length - 1; idx++) {
        r -= weightOf(pool[idx]);
        if (r < 0) break;
      }
      out.push(pool.splice(idx, 1)[0]);
    }
    return out;
  }
}
