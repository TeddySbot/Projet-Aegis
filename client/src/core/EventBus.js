/**
 * EventBus — canal de communication découplé entre systèmes (pattern Observer / Pub-Sub).
 *
 * Aucun système ne référence directement un autre : un émetteur publie un événement
 * nommé (voir `events.js`) et n'importe quel nombre d'abonnés y réagit.
 *
 * Choix assumés :
 *  - Dispatch SYNCHRONE : l'ordre des effets est déterministe et facile à déboguer.
 *    Limite : un handler lent bloque l'émetteur ; une cascade d'événements est
 *    exécutée en profondeur (depth-first).
 *  - Isolation des erreurs : une exception dans un handler est capturée et remontée
 *    via `onError`, les autres abonnés sont quand même notifiés. Un système défaillant
 *    ne casse donc pas les autres.
 *  - Copie de la liste des handlers avant dispatch : on peut se (dés)abonner pendant
 *    un dispatch sans effet de bord.
 */
export class EventBus {
  /** @param {{ onError?: (err: unknown, event: string) => void, debug?: boolean }} [options] */
  constructor(options = {}) {
    /** @type {Map<string, Set<Function>>} */
    this._handlers = new Map();
    this._onError = options.onError ?? ((err, event) => console.error(`[EventBus] handler de "${event}" en erreur`, err));
    this._debug = options.debug ?? false;
  }

  /**
   * S'abonne à un événement.
   * @param {string} event
   * @param {(payload: any) => void} handler
   * @returns {() => void} fonction de désabonnement
   */
  on(event, handler) {
    if (typeof event !== 'string' || !event) throw new TypeError('EventBus.on : nom d\'événement invalide');
    if (typeof handler !== 'function') throw new TypeError('EventBus.on : handler doit être une fonction');
    let set = this._handlers.get(event);
    if (!set) {
      set = new Set();
      this._handlers.set(event, set);
    }
    set.add(handler);
    return () => this.off(event, handler);
  }

  /** S'abonne pour une seule notification. */
  once(event, handler) {
    const off = this.on(event, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off(event, handler) {
    const set = this._handlers.get(event);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) this._handlers.delete(event);
  }

  /**
   * Publie un événement à tous les abonnés.
   * @param {string} event
   * @param {any} [payload]
   */
  emit(event, payload) {
    if (this._debug) console.debug(`[EventBus] ${event}`, payload);
    const set = this._handlers.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch (err) {
        this._onError(err, event);
      }
    }
  }

  /** Nombre d'abonnés (utile pour les tests et le débogage des fuites). */
  listenerCount(event) {
    return this._handlers.get(event)?.size ?? 0;
  }

  clear() {
    this._handlers.clear();
  }
}

/**
 * Regroupe plusieurs abonnements pour les libérer d'un coup (fin de run, sortie d'état…).
 * Évite les fuites d'abonnés entre deux runs.
 */
export class SubscriptionGroup {
  constructor(bus) {
    this._bus = bus;
    this._offs = [];
  }

  on(event, handler) {
    this._offs.push(this._bus.on(event, handler));
    return this;
  }

  dispose() {
    for (const off of this._offs.splice(0)) off();
  }
}
