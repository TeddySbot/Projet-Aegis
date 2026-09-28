/**
 * Types d'armes — pattern Stratégie indexé par `kind` (voir `weapons.json`).
 *
 * Une stratégie reçoit l'instance d'arme et un contexte (monde, joueur, résolveur de
 * dégâts…) et agit chaque pas. Elle ne connaît aucun autre système : les dégâts
 * passent par `ctx.damage` qui émet les événements appropriés.
 *
 * Les stats effectives combinent les stats de l'arme et celles du joueur
 * (puissance, réduction de recharge, zone, projectiles supplémentaires…).
 *
 * @typedef {{
 *   world: import('../World.js').World,
 *   player: import('../entities/Player.js').Player,
 *   damage: import('../DamageResolver.js').DamageResolver,
 *   rng: import('../../core/Random.js').Random,
 *   emit: (event: string, payload: any) => void,
 * }} WeaponContext
 */
import { GameEvents } from '../../core/events.js';
import { circlesOverlap, distSq } from '../../core/math.js';

const MAX_CDR = 0.7;

/** Temps de recharge effectif compte tenu de la réduction du joueur. */
export function effectiveCooldown(weapon, player) {
  const cdr = Math.min(MAX_CDR, player.stats.get('cooldownReduction'));
  return weapon.stats.get('cooldown') * (1 - cdr);
}

function nearestEnemy(world, from, filter = () => true, maxDistSq = Infinity) {
  let best = null;
  let bestD = maxDistSq;
  for (const e of world.enemies) {
    if (e.dead || !filter(e)) continue;
    const d = distSq(from, e);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

const BOSS_PRIORITY_RANGE_SQ = 520 * 520;

/** Stratégies de ciblage (champ `targeting` d'une arme dans `weapons.json`). */
export const targetingStrategies = Object.freeze({
  nearest: (world, from) => nearestEnemy(world, from),
  bossFirst: (world, from) => nearestEnemy(world, from, (e) => e.boss, BOSS_PRIORITY_RANGE_SQ) ?? nearestEnemy(world, from),
});

/** Projectiles tirés vers l'ennemi le plus proche, en éventail. */
const projectile = {
  update(weapon, ctx, dt) {
    weapon.cooldownLeft -= dt;
    if (weapon.cooldownLeft > 0) return;
    const { player, world } = ctx;
    const target = targetingStrategies[weapon.def.targeting ?? 'nearest'](world, player);
    if (!target) return;
    weapon.cooldownLeft = effectiveCooldown(weapon, player);

    const s = weapon.stats;
    const count = Math.round(s.get('count') + player.stats.get('extraProjectiles'));
    const spread = s.get('spread');
    const base = Math.atan2(target.y - player.y, target.x - player.x);
    const speed = s.get('speed') * player.stats.get('projectileSpeed');
    for (let i = 0; i < count; i++) {
      const angle = base + (i - (count - 1) / 2) * spread;
      world.projectiles.push({
        id: world.nextId(),
        weaponId: weapon.id,
        x: player.x,
        y: player.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: s.get('radius') * player.stats.get('area'),
        damage: s.get('damage'),
        pierce: Math.round(s.get('pierce')),
        life: s.get('lifetime'),
        color: weapon.def.color,
        hit: new Set(),
        dead: false,
      });
    }
    ctx.emit(GameEvents.WEAPON_FIRED, { weaponId: weapon.id, kind: 'projectile', x: player.x, y: player.y, color: weapon.def.color });
  },
};

/** Lames tournant autour du joueur ; chaque ennemi n'est touché qu'une fois par `hitCooldown`. */
const orbit = {
  update(weapon, ctx, dt) {
    const { player, world } = ctx;
    const s = weapon.stats;
    const rt = weapon.runtime;
    rt.angle = ((rt.angle ?? 0) + s.get('angularSpeed') * dt) % (Math.PI * 2);
    rt.hitTimers ??= new Map();
    for (const [id, t] of rt.hitTimers) {
      if (t - dt <= 0) rt.hitTimers.delete(id);
      else rt.hitTimers.set(id, t - dt);
    }
    const count = Math.round(s.get('count'));
    const area = player.stats.get('area');
    const orbitRadius = s.get('orbitRadius') * area;
    const radius = s.get('radius') * area;
    rt.blades = [];
    for (let i = 0; i < count; i++) {
      const a = rt.angle + (i / count) * Math.PI * 2;
      rt.blades.push({ x: player.x + Math.cos(a) * orbitRadius, y: player.y + Math.sin(a) * orbitRadius, radius });
    }
    for (const enemy of world.enemies) {
      if (enemy.dead || rt.hitTimers.has(enemy.id)) continue;
      for (const blade of rt.blades) {
        if (circlesOverlap(blade, blade.radius, enemy, enemy.radius)) {
          ctx.damage.damageEnemy(enemy, s.get('damage'), { knockback: 90, from: player });
          rt.hitTimers.set(enemy.id, s.get('hitCooldown'));
          break;
        }
      }
    }
  },
};

/** Onde de choc périodique centrée sur le joueur, avec recul. */
const pulse = {
  update(weapon, ctx, dt) {
    weapon.cooldownLeft -= dt;
    if (weapon.cooldownLeft > 0) return;
    const { player, world } = ctx;
    const s = weapon.stats;
    const radius = s.get('radius') * player.stats.get('area');
    const inRange = world.enemies.filter((e) => !e.dead && circlesOverlap(player, radius, e, e.radius));
    if (inRange.length === 0) {
      weapon.cooldownLeft = 0.25; // réessaie bientôt plutôt que de gaspiller la nova
      return;
    }
    weapon.cooldownLeft = effectiveCooldown(weapon, player);
    for (const enemy of inRange) ctx.damage.damageEnemy(enemy, s.get('damage'), { knockback: s.get('knockback'), from: player });
    ctx.emit(GameEvents.WEAPON_FIRED, { weaponId: weapon.id, kind: 'pulse', x: player.x, y: player.y, radius, color: weapon.def.color });
  },
};

export const weaponKinds = Object.freeze({ projectile, orbit, pulse });

