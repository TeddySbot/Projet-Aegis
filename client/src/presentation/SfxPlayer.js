/**
 * SfxPlayer — sons synthétisés (Web Audio, aucun fichier audio), déclenchés par événements.
 *
 * Exemple type d'un système « branché » sur le bus : le retirer (config
 * `systems.sfx: false` ou `?disable=sfx`) n'a aucun effet sur le reste du jeu.
 */
import { GameEvents } from '../core/events.js';
import { SubscriptionGroup } from '../core/EventBus.js';

export class SfxPlayer {
  /** @param {{ bus: any, volume?: number }} deps */
  constructor({ bus, volume = 0.18 }) {
    this._volume = volume;
    this.muted = false;
    this._ctx = null;
    this._last = new Map();
    this._unlock = () => this._ensureContext();
    window.addEventListener('pointerdown', this._unlock);
    window.addEventListener('keydown', this._unlock);

    this._subs = new SubscriptionGroup(bus)
      .on(GameEvents.WEAPON_FIRED, ({ kind }) =>
        kind === 'pulse' ? this._tone({ freq: 140, to: 60, dur: 0.25, type: 'sine', gain: 0.9 }) : this._tone({ freq: 880, to: 600, dur: 0.05, type: 'triangle', gain: 0.2, throttle: 0.07, key: 'shot' }),
      )
      .on(GameEvents.ENEMY_KILLED, ({ boss }) =>
        boss ? this._chord([130, 196, 262], 0.9, 'sawtooth', 0.5) : this._tone({ freq: 320, to: 120, dur: 0.08, type: 'square', gain: 0.18, throttle: 0.05, key: 'kill' }),
      )
      .on(GameEvents.PLAYER_DAMAGED, () => this._tone({ freq: 160, to: 70, dur: 0.18, type: 'sawtooth', gain: 0.5 }))
      .on(GameEvents.LEVEL_UP, () => this._arpeggio([523, 659, 784, 1047], 0.07))
      .on(GameEvents.UPGRADE_APPLIED, () => this._tone({ freq: 660, to: 990, dur: 0.12, type: 'sine', gain: 0.4 }))
      .on(GameEvents.BOSS_SPAWNED, () => this._tone({ freq: 70, to: 40, dur: 1.2, type: 'sawtooth', gain: 0.6 }))
      .on(GameEvents.RUN_ENDED, ({ outcome }) =>
        outcome === 'victory' ? this._arpeggio([523, 659, 784, 1047, 1319], 0.1) : this._arpeggio([392, 330, 262, 196], 0.14, 'triangle'),
      );
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  _ensureContext() {
    if (!this._ctx) {
      const Ctx = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctx) return null;
      this._ctx = new Ctx();
    }
    if (this._ctx.state === 'suspended') this._ctx.resume();
    return this._ctx;
  }

  _tone({ freq, to = freq, dur, type = 'sine', gain = 0.3, delay = 0, throttle = 0, key }) {
    if (this.muted || !this._ctx || this._ctx.state !== 'running') return;
    const now = this._ctx.currentTime;
    if (throttle && key) {
      if (now - (this._last.get(key) ?? -1) < throttle) return;
      this._last.set(key, now);
    }
    const t0 = now + delay;
    const osc = this._ctx.createOscillator();
    const g = this._ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    g.gain.setValueAtTime(gain * this._volume, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this._ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _arpeggio(freqs, step, type = 'square') {
    freqs.forEach((f, i) => this._tone({ freq: f, dur: step * 1.6, type, gain: 0.35, delay: i * step }));
  }

  _chord(freqs, dur, type, gain) {
    freqs.forEach((f) => this._tone({ freq: f, to: f / 2, dur, type, gain }));
  }

  dispose() {
    this._subs.dispose();
    window.removeEventListener('pointerdown', this._unlock);
    window.removeEventListener('keydown', this._unlock);
  }
}
