/**
 * Vocabulaire reconnu par le moteur dans les fichiers de données.
 *
 * Partagé entre le serveur (validation au démarrage) et le client (registres de
 * stratégies). Un test (tests/registries.test.js) garantit que chaque entrée a
 * bien une implémentation côté client : ajouter un comportement = l'implémenter
 * puis l'ajouter ici.
 */
export const ENEMY_BEHAVIORS = Object.freeze(['chase', 'zigzag', 'charge']);
export const WEAPON_TARGETING = Object.freeze(['nearest', 'bossFirst']);
export const WEAPON_KINDS = Object.freeze(['projectile', 'orbit', 'pulse']);
export const UPGRADE_EFFECT_TYPES = Object.freeze(['stat', 'heal', 'grantWeapon', 'weaponStat']);
/** Effets d'amélioration méta : stat du joueur, arme de départ, stat d'une arme (appliquée dès qu'elle est obtenue). */
export const META_EFFECT_TYPES = Object.freeze(['stat', 'startingWeapon', 'weaponStat']);
export const MODIFIER_OPS = Object.freeze(['add', 'mul']);
/** Modes de jeu (registre `gameplay/modes/gameModes.js`) : campagne scénarisée ou infini généré. */
export const GAME_MODES = Object.freeze(['story', 'endless']);
/** Multiplicateurs autorisés dans le champ `scale` d'une règle d'apparition de vague. */
export const ENEMY_SCALE_KEYS = Object.freeze(['hp', 'damage', 'speed', 'radius', 'xp', 'score']);
