/**
 * Table unique des transitions autorisées entre états globaux.
 *   change : Menu → Playing → GameOver → (Menu | Playing)
 *   push/pop : Playing ⇄ Paused, Playing ⇄ LevelUp (overlays empilés)
 */
export const STATE_TRANSITIONS = Object.freeze({
  Menu: ['Playing'],
  Playing: ['Paused', 'LevelUp', 'GameOver'],
  Paused: ['Playing'],
  LevelUp: ['Playing'],
  GameOver: ['Playing', 'Menu'],
});
