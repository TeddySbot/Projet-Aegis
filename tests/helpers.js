import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContentRepository } from '../server/content/ContentRepository.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let cached = null;
/** Charge (une fois) le vrai contenu de data/. Renvoie une copie modifiable. */
export async function loadContent() {
  cached ??= await new ContentRepository({ dataDir: path.join(ROOT, 'data') }).load();
  return structuredClone(cached);
}

/** Source d'entrée immobile. */
export const idleInput = { getMoveVector: () => ({ x: 0, y: 0 }) };

/** Enregistre tous les événements émis sur un bus. */
export function recordEvents(bus) {
  const log = [];
  const emit = bus.emit.bind(bus);
  bus.emit = (event, payload) => {
    log.push({ event, payload });
    emit(event, payload);
  };
  log.names = () => log.map((e) => e.event);
  log.of = (name) => log.filter((e) => e.event === name).map((e) => e.payload);
  return log;
}
