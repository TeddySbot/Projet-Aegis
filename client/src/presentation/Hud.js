/**
 * Hud — interface en jeu (PV, XP, niveau, temps, vague, score, éliminations).
 *
 * 100 % événementiel : il ne lit jamais le monde ni les systèmes, il écoute le bus.
 * Si le système de score est désactivé, le compteur reste simplement à « — ».
 */
import { GameEvents } from '../core/events.js';
import { SubscriptionGroup } from '../core/EventBus.js';
import { formatTime, h } from './dom.js';

export class Hud {
  /** @param {{ root: HTMLElement, bus: any }} deps */
  constructor({ root, bus }) {
    this.root = root;
    this._build();
    this._subs = new SubscriptionGroup(bus)
      .on(GameEvents.RUN_STARTED, ({ player, disabled }) => this._reset(player, disabled))
      .on(GameEvents.PLAYER_DAMAGED, ({ hp, maxHp }) => this._setHp(hp, maxHp, true))
      .on(GameEvents.PLAYER_HEALED, ({ hp, maxHp }) => this._setHp(hp, maxHp))
      .on(GameEvents.XP_GAINED, ({ xp, xpToNext, level }) => this._setXp(xp, xpToNext, level))
      .on(GameEvents.SCORE_CHANGED, ({ score }) => (this.el.score.textContent = score.toLocaleString('fr-FR')))
      .on(GameEvents.ENEMY_KILLED, () => (this.el.kills.textContent = String(++this._kills)))
      .on(GameEvents.RUN_TICK, ({ elapsed }) => (this.el.time.textContent = formatTime(elapsed)))
      .on(GameEvents.WAVE_STARTED, ({ index, total, wave }) => {
        this.el.wave.textContent = `Vague ${index + 1}/${total}`;
        this.el.waveName.textContent = wave.name ?? '';
      })
      .on(GameEvents.WEAPON_GRANTED, ({ name }) => this._addWeapon(name));
  }

  _build() {
    const el = (this.el = {});
    el.xpFill = h('div.xp-fill');
    el.level = h('span.hud-level', { text: 'Niv. 1' });
    el.hpFill = h('div.hp-fill');
    el.hpText = h('span.hp-text');
    el.time = h('span.hud-time', { text: '0:00' });
    el.wave = h('span.hud-wave', { text: '' });
    el.waveName = h('span.hud-wave-name', { text: '' });
    el.score = h('strong', { text: '0' });
    el.kills = h('strong', { text: '0' });
    el.weapons = h('div.hud-weapons');
    el.disabled = h('div.hud-disabled');
    this.root.replaceChildren(
      h('div.xp-bar', {}, [el.xpFill, el.level]),
      h('div.hud-top', {}, [
        h('div.hud-left', {}, [h('div.hp-bar', {}, [el.hpFill, el.hpText]), el.weapons]),
        h('div.hud-center', {}, [el.time, h('div', {}, [el.wave, ' · ', el.waveName])]),
        h('div.hud-right', {}, [h('div', {}, ['Score ', el.score]), h('div', {}, ['Éliminations ', el.kills])]),
      ]),
      el.disabled,
      h('div.hud-hint', { text: 'Échap : pause · M : son' }),
    );
  }

  _reset(player, disabled = []) {
    this._kills = 0;
    this.el.kills.textContent = '0';
    this.el.score.textContent = disabled.includes('score') ? '—' : '0';
    this.el.time.textContent = '0:00';
    this.el.weapons.replaceChildren();
    for (const w of player.weapons) this._addWeapon(w.name);
    this._setHp(player.hp, player.maxHp);
    this._setXp(0, 1, 1);
    this.el.disabled.textContent = disabled.length ? `Systèmes désactivés : ${disabled.join(', ')}` : '';
  }

  _addWeapon(name) {
    this.el.weapons.append(h('span.weapon-chip', { text: name }));
  }

  _setHp(hp, maxHp, hit = false) {
    this.el.hpFill.style.width = `${Math.max(0, (hp / maxHp) * 100)}%`;
    this.el.hpText.textContent = `${Math.ceil(hp)} / ${maxHp}`;
    if (hit) {
      this.el.hpFill.parentElement.classList.remove('hit');
      void this.el.hpFill.offsetWidth; // relance l'animation CSS
      this.el.hpFill.parentElement.classList.add('hit');
    }
  }

  _setXp(xp, xpToNext, level) {
    this.el.xpFill.style.width = `${Math.min(100, (xp / xpToNext) * 100)}%`;
    this.el.level.textContent = `Niv. ${level}`;
  }

  show() {
    this.root.hidden = false;
  }

  hide() {
    this.root.hidden = true;
  }

  dispose() {
    this._subs.dispose();
  }
}
