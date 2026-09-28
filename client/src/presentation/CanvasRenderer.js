/**
 * CanvasRenderer — dessine le monde de la run sur un <canvas> 2D.
 *
 * Lecture seule : il consulte le `World` et le `FxLayer` mais ne modifie rien.
 * Remplacer ce rendu (WebGL, PixiJS…) n'impacterait aucun système de gameplay.
 */
const GRID = 64;
const TAU = Math.PI * 2;

export class CanvasRenderer {
  /** @param {{ canvas: HTMLCanvasElement, fx: import('./FxLayer.js').FxLayer }} deps */
  constructor({ canvas, fx }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.fx = fx;
    this.width = 0;
    this.height = 0;
    this._resize = () => this.resize();
    window.addEventListener('resize', this._resize);
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = Math.floor(this.width * dpr);
    this.canvas.height = Math.floor(this.height * dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** @param {import('../gameplay/World.js').World} world */
  render(world) {
    const { ctx, width: w, height: h, fx } = this;
    const player = world.player;
    const shake = fx.shakeOffset();
    const camX = player.x - w / 2 + shake.x;
    const camY = player.y - h / 2 + shake.y;

    this._background(camX, camY);
    ctx.save();
    ctx.translate(-camX, -camY);

    this._orbs(world.orbs, world.time);
    this._rings();
    this._enemies(world.enemies, world.time);
    this._weapons(player);
    this._projectiles(world.projectiles);
    this._player(player, world.time);
    this._particles();
    this._texts();

    ctx.restore();
    this._bossIndicators(world, camX, camY);
    this._overlays();
  }

  _background(camX, camY) {
    const { ctx, width: w, height: h } = this;
    ctx.fillStyle = '#0a0d16';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(94, 231, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -((camX % GRID) + GRID) % GRID; x < w; x += GRID) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
    }
    for (let y = -((camY % GRID) + GRID) % GRID; y < h; y += GRID) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
    }
    ctx.stroke();
    // Repère de l'origine de l'arène
    ctx.strokeStyle = 'rgba(94, 231, 255, 0.12)';
    ctx.beginPath();
    ctx.arc(-camX, -camY, 40, 0, TAU);
    ctx.stroke();
  }

  _orbs(orbs, time) {
    const { ctx } = this;
    for (const o of orbs) {
      const s = 4 + Math.min(4, o.value) + Math.sin(time * 6 + o.id) * 0.8;
      ctx.fillStyle = o.value >= 5 ? '#b8f2ff' : '#3ddc97';
      ctx.globalAlpha = o.life < 3 ? 0.4 + 0.6 * Math.abs(Math.sin(time * 10)) : 1;
      ctx.beginPath();
      ctx.moveTo(o.x, o.y - s);
      ctx.lineTo(o.x + s * 0.7, o.y);
      ctx.lineTo(o.x, o.y + s);
      ctx.lineTo(o.x - s * 0.7, o.y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _enemies(enemies, time) {
    const { ctx } = this;
    for (const e of enemies) {
      // Télégraphie de la charge
      if (e.brain.mode === 'windup') {
        ctx.strokeStyle = `rgba(255, 80, 80, ${0.5 + 0.5 * Math.sin(time * 30)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 8, 0, TAU);
        ctx.stroke();
        if (e.brain.dir) {
          ctx.strokeStyle = 'rgba(255, 80, 80, 0.25)';
          ctx.lineWidth = e.radius;
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(e.x + e.brain.dir.x * 220, e.y + e.brain.dir.y * 220);
          ctx.stroke();
        }
      }
      ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : e.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.arc(e.x, e.y + e.radius * 0.2, e.radius * 0.6, 0, TAU);
      ctx.fill();
      // yeux
      ctx.fillStyle = '#0a0d16';
      const eye = Math.max(1.5, e.radius * 0.16);
      ctx.beginPath();
      ctx.arc(e.x - e.radius * 0.3, e.y - e.radius * 0.2, eye, 0, TAU);
      ctx.arc(e.x + e.radius * 0.3, e.y - e.radius * 0.2, eye, 0, TAU);
      ctx.fill();

      if (e.boss || e.hp < e.maxHp) {
        const bw = e.boss ? e.radius * 2.4 : e.radius * 1.8;
        const bx = e.x - bw / 2;
        const by = e.y - e.radius - (e.boss ? 16 : 9);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(bx, by, bw, e.boss ? 6 : 3);
        ctx.fillStyle = e.boss ? '#f15bb5' : '#ef476f';
        ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), e.boss ? 6 : 3);
      }
    }
  }

  _weapons(player) {
    const { ctx } = this;
    for (const weapon of player.weapons.values()) {
      if (weapon.kind !== 'orbit' || !weapon.runtime.blades) continue;
      ctx.fillStyle = weapon.def.color;
      for (const b of weapon.runtime.blades) {
        const a = weapon.runtime.angle * 3;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(0, -b.radius);
        ctx.lineTo(b.radius * 0.45, 0);
        ctx.lineTo(0, b.radius);
        ctx.lineTo(-b.radius * 0.45, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

  _projectiles(projectiles) {
    const { ctx } = this;
    ctx.globalCompositeOperation = 'lighter';
    for (const p of projectiles) {
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = p.radius * 1.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  _player(p, time) {
    const { ctx } = this;
    if (!p.alive) return;
    if (p.invulnerable > 0 && Math.floor(time * 20) % 2 === 0) ctx.globalAlpha = 0.45;
    // halo
    const halo = ctx.createRadialGradient(p.x, p.y, p.radius * 0.5, p.x, p.y, p.radius * 3);
    halo.addColorStop(0, 'rgba(94, 231, 255, 0.35)');
    halo.addColorStop(1, 'rgba(94, 231, 255, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * 3, 0, TAU);
    ctx.fill();
    // bouclier (hexagone)
    ctx.fillStyle = p.color;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + Math.PI / 6;
      ctx.lineTo(p.x + Math.cos(a) * p.radius, p.y + Math.sin(a) * p.radius);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x + p.facing.x * 4, p.y + p.facing.y * 4, p.radius * 0.35, 0, TAU);
    ctx.fill();
    if (this.fx.levelFlash > 0) {
      ctx.strokeStyle = `rgba(255, 209, 102, ${this.fx.levelFlash})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + (0.6 - this.fx.levelFlash) * 120, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  _rings() {
    const { ctx } = this;
    for (const r of this.fx.rings) {
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = r.life / r.max;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  _particles() {
    const { ctx } = this;
    for (const p of this.fx.particles) {
      ctx.globalAlpha = p.life / p.max;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  _texts() {
    const { ctx } = this;
    ctx.textAlign = 'center';
    for (const t of this.fx.texts) {
      ctx.globalAlpha = Math.min(1, (t.life / t.max) * 2);
      ctx.font = `700 ${t.size}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText(t.text, t.x + 1, t.y + 1);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  /** Flèche au bord de l'écran vers un boss hors champ. */
  _bossIndicators(world, camX, camY) {
    const { ctx, width: w, height: h } = this;
    for (const e of world.enemies) {
      if (!e.boss) continue;
      const sx = e.x - camX;
      const sy = e.y - camY;
      if (sx > 0 && sx < w && sy > 0 && sy < h) continue;
      const a = Math.atan2(sy - h / 2, sx - w / 2);
      const m = 34;
      const x = Math.min(w - m, Math.max(m, w / 2 + Math.cos(a) * w));
      const y = Math.min(h - m, Math.max(m, h / 2 + Math.sin(a) * h));
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillStyle = '#f15bb5';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-8, -10);
      ctx.lineTo(-8, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  _overlays() {
    const { ctx, width: w, height: h, fx } = this;
    // vignette
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, fx.damageFlash > 0 ? `rgba(239, 71, 111, ${0.2 + fx.damageFlash * 1.6})` : 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const b = fx.banner;
    if (b) {
      const t = b.max - b.life;
      const alpha = Math.min(1, t * 3, b.life * 2);
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.fillStyle = b.color;
      ctx.font = '800 38px system-ui, sans-serif';
      ctx.fillText(b.title, w / 2, h * 0.28);
      ctx.fillStyle = '#e8ecf5';
      ctx.font = '500 20px system-ui, sans-serif';
      ctx.fillText(b.subtitle, w / 2, h * 0.28 + 32);
      ctx.globalAlpha = 1;
    }
  }

  dispose() {
    window.removeEventListener('resize', this._resize);
  }
}
