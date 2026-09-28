/**
 * ServiceContainer — conteneur d'injection de dépendances minimaliste.
 *
 * Il n'est utilisé QUE dans la « composition root » (`main.js` côté client,
 * `server/index.js` côté serveur). Les systèmes et services reçoivent leurs
 * dépendances par constructeur : ils ne connaissent ni le conteneur ni aucun
 * singleton global. C'est ce qui rend chaque classe testable isolément avec des
 * doublures (voir tests/).
 *
 * Choix : on évite volontairement le « Service Locator » (passer le conteneur
 * partout) qui masquerait les dépendances réelles de chaque classe.
 */
export class ServiceContainer {
  constructor() {
    /** @type {Map<string, {factory: (c: ServiceContainer) => any, instance?: any, resolving?: boolean}>} */
    this._entries = new Map();
  }

  /**
   * Enregistre une fabrique paresseuse. L'instance est créée au premier `resolve`
   * puis mise en cache (portée « application »).
   */
  register(key, factory) {
    if (this._entries.has(key)) throw new Error(`Service déjà enregistré : ${key}`);
    this._entries.set(key, { factory });
    return this;
  }

  /** Enregistre une valeur déjà construite. */
  value(key, instance) {
    if (this._entries.has(key)) throw new Error(`Service déjà enregistré : ${key}`);
    this._entries.set(key, { factory: () => instance, instance });
    return this;
  }

  /** Remplace un service (utile pour substituer une implémentation : tests, fallback). */
  override(key, factory) {
    this._entries.set(key, { factory });
    return this;
  }

  has(key) {
    return this._entries.has(key);
  }

  resolve(key) {
    const entry = this._entries.get(key);
    if (!entry) throw new Error(`Service introuvable : ${key}`);
    if (entry.instance !== undefined) return entry.instance;
    if (entry.resolving) throw new Error(`Dépendance circulaire détectée sur : ${key}`);
    entry.resolving = true;
    try {
      entry.instance = entry.factory(this);
    } finally {
      entry.resolving = false;
    }
    return entry.instance;
  }
}
