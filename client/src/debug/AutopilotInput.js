/**
 * AutopilotInput — source d'entrée « IA » qui implémente la même interface que le
 * clavier (`getMoveVector()`). Elle fuit les ennemis proches, orbite autour de la
 * horde et va chercher les orbes d'XP.
 *
 * Sert à la simulation headless (`npm run simulate`, tests) et à la démo navigateur
 * (`?autopilot=1`). Preuve concrète du découplage : le gameplay ne sait pas qui le pilote.
 */
export class AutopilotInput {
  /** @param {{ getWorld: () => import('../gameplay/World.js').World | null }} deps */
  constructor({ getWorld }) {
    this._getWorld = getWorld;
  }

  getMoveVector() {
    const world = this._getWorld();
    if (!world?.player) return { x: 0, y: 0 };
    const p = world.player;
    let fx = 0;
    let fy = 0;
    let threat = 0;

    for (const e of world.enemies) {
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d2 = dx * dx + dy * dy;
      const danger = (e.boss ? 170 : 230) + e.radius;
      if (d2 > danger * danger) continue;
      const d = Math.sqrt(d2) || 1;
      const w = ((danger - d) / danger) ** 2 * (e.boss ? 2 : 1);
      fx += (dx / d) * w;
      fy += (dy / d) * w;
      // composante tangentielle : on tourne autour de la horde au lieu de reculer tout droit
      fx += (-dy / d) * w * 0.6;
      fy += (dx / d) * w * 0.6;
      threat += w;
    }

    // Va chercher l'orbe le plus proche si la pression est faible.
    let best = null;
    let bestD = 360 * 360;
    for (const o of world.orbs) {
      const d2 = (o.x - p.x) ** 2 + (o.y - p.y) ** 2;
      if (d2 < bestD) {
        bestD = d2;
        best = o;
      }
    }
    if (best && threat < 1.2) {
      const d = Math.sqrt(bestD) || 1;
      const w = 0.9 / (1 + threat);
      fx += ((best.x - p.x) / d) * w;
      fy += ((best.y - p.y) / d) * w;
    }

    // Rappel doux vers l'origine pour ne pas dériver indéfiniment.
    const home = Math.hypot(p.x, p.y);
    if (home > 900) {
      fx -= (p.x / home) * 0.3;
      fy -= (p.y / home) * 0.3;
    }
    return { x: fx, y: fy };
  }
}
