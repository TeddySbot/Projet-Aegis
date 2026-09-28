/** Petits utilitaires vectoriels 2D (objets {x, y} mutables, sans allocation superflue). */

export const vec = (x = 0, y = 0) => ({ x, y });

export const length = (x, y) => Math.hypot(x, y);

export const distSq = (a, b) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

/** Normalise (x, y) ; renvoie {x:0,y:0} pour un vecteur nul. */
export const normalize = (x, y) => {
  const len = Math.hypot(x, y);
  return len > 1e-9 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
};

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

export const circlesOverlap = (a, ar, b, br) => distSq(a, b) <= (ar + br) * (ar + br);
