/**
 * Routeur HTTP minimaliste (méthode + chemin exact ou paramètres `:id`).
 * Suffisant pour une petite API REST et zéro dépendance externe.
 */
export class Router {
  constructor() {
    /** @type {{method: string, parts: string[], handler: Function}[]} */
    this._routes = [];
  }

  add(method, pattern, handler) {
    this._routes.push({ method, parts: pattern.split('/').filter(Boolean), handler });
    return this;
  }
  get(p, h) { return this.add('GET', p, h); }
  post(p, h) { return this.add('POST', p, h); }
  put(p, h) { return this.add('PUT', p, h); }
  delete(p, h) { return this.add('DELETE', p, h); }

  /**
   * @returns {{ handler: Function, params: Record<string,string> } | { methodNotAllowed: true } | null}
   */
  match(method, pathname) {
    const parts = pathname.split('/').filter(Boolean);
    let pathMatched = false;
    for (const route of this._routes) {
      const params = matchParts(route.parts, parts);
      if (!params) continue;
      pathMatched = true;
      if (route.method === method) return { handler: route.handler, params };
    }
    return pathMatched ? { methodNotAllowed: true } : null;
  }
}

function matchParts(pattern, parts) {
  if (pattern.length !== parts.length) return null;
  const params = {};
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i].startsWith(':')) params[pattern[i].slice(1)] = decodeURIComponent(parts[i]);
    else if (pattern[i] !== parts[i]) return null;
  }
  return params;
}
