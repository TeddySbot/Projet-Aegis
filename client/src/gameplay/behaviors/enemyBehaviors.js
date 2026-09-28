/**
 * Comportements d'ennemis — pattern Stratégie indexé par nom.
 *
 * Le champ `behavior` d'un ennemi dans `enemies.json` sélectionne l'une de ces
 * fonctions, paramétrée par `behaviorParams`. Chaque stratégie renvoie la vitesse
 * désirée (vx, vy) et peut stocker son état dans `enemy.brain`.
 *
 * Ajouter un comportement : écrire la fonction ici + ajouter son nom dans
 * shared/content/vocabulary.js (un test vérifie la cohérence des deux).
 *
 * @typedef {{ player: {x:number,y:number}, time: number, emit: (event: string, payload: any) => void }} BehaviorContext
 * @typedef {(enemy: any, ctx: BehaviorContext, dt: number) => {vx: number, vy: number}} Behavior
 */
import { GameEvents } from '../../core/events.js';
import { normalize } from '../../core/math.js';

/** @type {Behavior} */
function chase(enemy, { player }) {
  const d = normalize(player.x - enemy.x, player.y - enemy.y);
  return { vx: d.x * enemy.speed, vy: d.y * enemy.speed };
}

/** Avance vers le joueur en ondulant latéralement. @type {Behavior} */
function zigzag(enemy, { player, time }) {
  const { amplitude = 0.8, frequency = 3 } = enemy.def.behaviorParams ?? {};
  const d = normalize(player.x - enemy.x, player.y - enemy.y);
  enemy.brain.phase ??= enemy.id * 1.7;
  const wobble = Math.sin(time * frequency + enemy.brain.phase) * amplitude;
  const dir = normalize(d.x - d.y * wobble, d.y + d.x * wobble);
  return { vx: dir.x * enemy.speed, vy: dir.y * enemy.speed };
}

/**
 * Machine à états locale : approche → préparation (télégraphiée) → charge → récupération.
 * @type {Behavior}
 */
function charge(enemy, ctx, dt) {
  const p = { range: 260, windup: 0.6, chargeSpeed: 340, chargeDuration: 0.6, cooldown: 2, ...(enemy.def.behaviorParams ?? {}) };
  const b = enemy.brain;
  b.mode ??= 'approach';
  b.timer = (b.timer ?? 0) - dt;
  const dx = ctx.player.x - enemy.x;
  const dy = ctx.player.y - enemy.y;

  switch (b.mode) {
    case 'approach': {
      if (b.timer <= 0 && dx * dx + dy * dy < p.range * p.range) {
        b.mode = 'windup';
        b.timer = p.windup;
        b.dir = normalize(dx, dy);
        ctx.emit(GameEvents.ENEMY_TELEGRAPH, { enemy });
        return { vx: 0, vy: 0 };
      }
      return chase(enemy, ctx, dt);
    }
    case 'windup':
      if (b.timer <= 0) {
        b.mode = 'dash';
        b.timer = p.chargeDuration;
      }
      return { vx: 0, vy: 0 };
    case 'dash':
      if (b.timer <= 0) {
        b.mode = 'approach';
        b.timer = p.cooldown;
      }
      return { vx: b.dir.x * p.chargeSpeed, vy: b.dir.y * p.chargeSpeed };
    default:
      b.mode = 'approach';
      return { vx: 0, vy: 0 };
  }
}

/** @type {Record<string, Behavior>} */
export const enemyBehaviors = Object.freeze({ chase, zigzag, charge });
