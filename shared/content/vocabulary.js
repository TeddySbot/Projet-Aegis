/**
 * Vocabulaire reconnu par le moteur dans les fichiers de données.
 *
 * Partagé entre le serveur (validation au démarrage) et le client (registres de
 * stratégies). Un test (tests/registries.test.js) garantit que chaque entrée a
 * bien une implémentation côté client : ajouter un comportement = l'implémenter
 * puis l'ajouter ici.
 */
export const ENEMY_BEHAVIORS = Object.freeze(['chase', 'zigzag', 'charge']);
export const WEAPON_KINDS = Object.freeze(['projectile', 'orbit', 'pulse']);
export const UPGRADE_EFFECT_TYPES = Object.freeze(['stat', 'heal', 'grantWeapon', 'weaponStat']);
export const META_EFFECT_TYPES = Object.freeze(['stat', 'startingWeapon']);
export const MODIFIER_OPS = Object.freeze(['add', 'mul']);
