import { GameEvents } from '../../core/events.js';
import { normalize } from '../../core/math.js';
import { GameSystem } from './GameSystem.js';

/** Déplacement du joueur (depuis une source d'entrée abstraite), régénération, invulnérabilité. */
export class PlayerSystem extends GameSystem {
  /**
   * @param {{ bus: any, world: import('../World.js').World, input: { getMoveVector(): {x:number,y:number} } }} deps
   */
  constructor({ bus, world, input }) {
    super('player', bus);
    this._world = world;
    this._input = input;
    this._regenAcc = 0;
  }

  update(dt) {
    const p = this._world.player;
    if (!p.alive) return;
    const raw = this._input.getMoveVector();
    const dir = normalize(raw.x, raw.y);
    const speed = p.stats.get('moveSpeed');
    p.x += dir.x * speed * dt;
    p.y += dir.y * speed * dt;
    p.moving = dir.x !== 0 || dir.y !== 0;
    if (p.moving) p.facing = dir;
    if (p.invulnerable > 0) p.invulnerable -= dt;

    const regen = p.stats.get('regen');
    if (regen > 0 && p.hp < p.maxHp) {
      this._regenAcc += regen * dt;
      if (this._regenAcc >= 1) {
        const amount = Math.min(Math.floor(this._regenAcc), p.maxHp - p.hp);
        this._regenAcc -= Math.floor(this._regenAcc);
        p.hp += amount;
        this.bus.emit(GameEvents.PLAYER_HEALED, { amount, hp: p.hp, maxHp: p.maxHp });
      }
    }
  }
}
