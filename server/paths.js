/**
 * Résolution des chemins de l'application.
 *
 * - En développement : racine = dossier parent de `server/`.
 * - En exécutable Windows (bundle esbuild + pkg) : la constante `__AEGIS_ROOT__` est
 *   injectée par le build ; les sauvegardes sont écrites À CÔTÉ de l'exécutable (le
 *   système de fichiers embarqué est en lecture seule).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* global __AEGIS_ROOT__ */
const bundledRoot = typeof __AEGIS_ROOT__ !== 'undefined' ? __AEGIS_ROOT__ : null;

export const ROOT = bundledRoot ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const IS_PACKAGED = Boolean(process.pkg);

const EXE_DIR = IS_PACKAGED ? path.dirname(process.execPath) : null;

/**
 * Données de jeu : en exécutable, un dossier `data/` placé à côté de Aegis.exe est
 * prioritaire sur les données embarquées → on peut modifier le contenu sans recompiler.
 */
export const DATA_DIR =
  process.env.AEGIS_DATA_DIR ??
  (EXE_DIR && fs.existsSync(path.join(EXE_DIR, 'data')) ? path.join(EXE_DIR, 'data') : path.join(ROOT, 'data'));
export const SAVE_DIR =
  process.env.AEGIS_SAVE_DIR ?? (EXE_DIR ? path.join(EXE_DIR, 'saves') : path.join(ROOT, 'saves'));

/** Seuls ces dossiers sont exposés en statique (jamais server/, data/ brut, .git…). */
export const PUBLIC_DIRS = {
  client: path.join(ROOT, 'client'),
  shared: path.join(ROOT, 'shared'),
};
