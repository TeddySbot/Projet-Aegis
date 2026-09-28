/**
 * FxLayer — effets visuels purement cosmétiques, pilotés par les événements.
 *
 * Il ne lit ni ne modifie jamais l'état de jeu : il réagit aux événements
 * (ennemi tué → particules, dégâts → chiffres flottants, joueur touché →
 * tremblement d'écran…). Chaque famille d'effets est désactivable via
 * `config.systems` sans aucun impact sur le gameplay.
 */
import { GameEvents } from '../core/events.js';
import { SubscriptionGroup } from '../core/EventBus.js';

const MAX_PARTICLES = 600;
const MAX_TEXTS = 80;

export class FxLayer {
  /**
   * @param {{ bus: any, options: { floatingText?: boolean, screenShake?: boolean }, random?: () => number }} deps
   */
  constructor({ bus, options, random = Math.random }) {
    this._rand = random;
    this.options = { floatingText: true, screenShake: true, ...options };
    this.particles = [];
    this.texts = [];
    this.rings = [];
    this.shake = 0;
    this.damageFlash = 0;
    this.banner = null;

    this._subs = new SubscriptionGroup(bus)
      .on(GameEvents.RUN_STARTED, () => this.clear())
      .on(GameEvents.ENEMY_DAMAGED, ({ amount, x, y, critical }) => {
        if (!this.options.floatingText || this.texts.length >= MAX_TEXTS) return;
        this.texts.push({
          x: x + (this._rand() - 0.5) * 12, y: y - 10, vy: -55, life: 0.6, max: 0.6,
          text: String(amount), color: critical ? '#ffd166' : '#ffffff', size: critical ? 18 : 13,
        });
      })
      .on(GameEvents.ENEMY_KILLED, ({ enemy, x, y, boss }) => {
        this._burst(x, y, enemy.color, boss ? 80 : 9, boss ? 340 : 160);
        if (boss) {
          this._shake(18);
          this.rings.push({ x, y, radius: 10, maxRadius: 320, life: 0.8, max: 0.8, color: enemy.color });
        }
      })
      .on(GameEvents.PLAYER_DAMAGED, () => {
        this._shake(7);
        this.damageFlash = 0.25;
      })
      .on(GameEvents.WEAPON_FIRED, ({ kind, x, y, radius, color }) => {
        if (kind === 'pulse') this.rings.push({ x, y, radius: 12, maxRadius: radius, life: 0.35, max: 0.35, color });
      })
      .on(GameEvents.LEVEL_UP, () => (this._levelFlash = 0.6))
      .on(GameEvents.WAVE_STARTED, ({ index, total, wave }) =>
        this._showBanner(total ? `Vague ${index + 1} / ${total}` : `Vague ${index + 1}`, wave.name ?? ''),
      )
      .on(GameEvents.BOSS_SPAWNED, ({ enemy }) => {
        this._showBanner('⚠ Boss', enemy.name ?? enemy.def.name, '#f15bb5');
        this._shake(10);
      });
  }

  clear() {
    this.particles.length = 0;
    this.texts.length = 0;
    this.rings.length = 0;
    this.shake = 0;
    this.damageFlash = 0;
    this.banner = null;
  }

  _showBanner(title, subtitle, color = '#5ee7ff') {
    this.banner = { title, subtitle, color, life: 2.6, max: 2.6 };
  }

  _shake(amount) {
    if (this.options.screenShake) this.shake = Math.min(24, this.shake + amount);
  }

  _burst(x, y, color, count, speed) {
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
      const a = this._rand() * Math.PI * 2;
      const s = speed * (0.3 + this._rand() * 0.7);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, max: 0.5, color, size: 2 + this._rand() * 3 });
    }
  }

  /** Avance les effets (appelé uniquement pendant le jeu actif : figés en pause). */
  update(dt) {
    const step = (list, fn) => {
      for (let i = list.length - 1; i >= 0; i--) {
        const it = list[i];
        it.life -= dt;
        if (it.life <= 0) list.splice(i, 1);
        else fn(it);
      }
    };
    step(this.particles, (p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
    });
    step(this.texts, (t) => {
      t.y += t.vy * dt;
    });
    step(this.rings, (r) => {
      r.radius += (r.maxRadius - r.radius) * Math.min(1, dt * 14);
    });
    this.shake = Math.max(0, this.shake - dt * 40);
    this.damageFlash = Math.max(0, this.damageFlash - dt);
    this._levelFlash = Math.max(0, (this._levelFlash ?? 0) - dt);
    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) this.banner = null;
    }
  }

  get levelFlash() {
    return this._levelFlash ?? 0;
  }

  shakeOffset() {
    if (this.shake <= 0) return { x: 0, y: 0 };
    return { x: (this._rand() - 0.5) * this.shake, y: (this._rand() - 0.5) * this.shake };
  }

  dispose() {
    this._subs.dispose();
  }
}
