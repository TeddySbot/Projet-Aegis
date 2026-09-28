import { SubscriptionGroup } from '../../core/EventBus.js';

/**
 * Classe de base des systèmes de gameplay.
 *
 * Un système :
 *  - reçoit TOUTES ses dépendances par constructeur (aucun accès global),
 *  - communique avec les autres uniquement via le bus d'événements,
 *  - libère ses abonnements dans `dispose()` (fin de run).
 * Il peut donc être retiré de la liste des systèmes sans casser les autres.
 */
export class GameSystem {
  /** @param {string} id @param {import('../../core/EventBus.js').EventBus} bus */
  constructor(id, bus) {
    this.id = id;
    this.bus = bus;
    this.subs = new SubscriptionGroup(bus);
  }

  /** Mise à jour à pas fixe. Par défaut : système purement réactif. */
  update(_dt) {}

  dispose() {
    this.subs.dispose();
  }
}
