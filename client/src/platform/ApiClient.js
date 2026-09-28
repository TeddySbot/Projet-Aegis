/**
 * ApiClient — accès HTTP au serveur Node (fetch + délai max + erreurs typées).
 * `fetchImpl` est injecté pour pouvoir être remplacé en test.
 */
export class ApiError extends Error {
  constructor(status, code) {
    super(`API ${status} : ${code}`);
    this.status = status;
    this.code = code;
  }
}

export class ApiClient {
  /** @param {{ baseUrl?: string, fetchImpl?: typeof fetch, timeoutMs?: number }} [options] */
  constructor({ baseUrl = '', fetchImpl = globalThis.fetch.bind(globalThis), timeoutMs = 5000 } = {}) {
    this._base = baseUrl;
    this._fetch = fetchImpl;
    this._timeout = timeoutMs;
  }

  async request(method, path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this._timeout);
    try {
      const res = await this._fetch(this._base + path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError(res.status, data.error ?? 'unknown_error');
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  get(path) { return this.request('GET', path); }
  post(path, body) { return this.request('POST', path, body ?? {}); }
  delete(path) { return this.request('DELETE', path); }
}
