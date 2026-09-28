/**
 * `npm run build:win` — produit un exécutable Windows autonome (Node embarqué).
 *
 *  1. esbuild regroupe le serveur (modules ES) en un seul fichier CommonJS ;
 *  2. @yao-pkg/pkg l'embarque avec un runtime Node 22 et les assets (client/, shared/, data/) ;
 *  3. le dossier dist/Aegis-win/ contient Aegis.exe, une copie éditable de data/ et un LISEZMOI.
 *
 * Au lancement, Aegis.exe démarre le serveur local et ouvre le navigateur par défaut.
 * Fonctionne depuis Windows, macOS ou Linux (compilation croisée).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(DIST, 'Aegis-win');
const pkgJson = JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf8'));

await fs.rm(DIST, { recursive: true, force: true });
await fs.mkdir(OUT, { recursive: true });

console.log('1/3 Bundle du serveur (esbuild)…');
await build({
  entryPoints: [path.join(ROOT, 'server/index.js')],
  outfile: path.join(DIST, 'aegis.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  // dist/aegis.cjs → racine du projet (dans le snapshot pkg, les assets gardent leurs chemins)
  banner: { js: "var __AEGIS_ROOT__ = require('path').join(__dirname, '..');" },
  logLevel: 'warning',
  logOverride: { 'empty-import-meta': 'silent' }, // import.meta n'est utilisé qu'hors bundle (voir server/paths.js)
});

console.log('2/3 Création de l\'exécutable (pkg, node22-win-x64)…');
const pkgConfig = path.join(DIST, 'pkg.config.json');
await fs.writeFile(
  pkgConfig,
  JSON.stringify({ name: 'aegis', pkg: { assets: ['../client/**/*', '../shared/**/*', '../data/**/*'] } }, null, 2),
);
const pkgBin = path.join(ROOT, 'node_modules', '@yao-pkg', 'pkg', 'lib-es5', 'bin.js');
execFileSync(
  process.execPath,
  [pkgBin, path.join(DIST, 'aegis.cjs'), '--config', pkgConfig, '--targets', 'node22-win-x64', '--output', path.join(OUT, 'Aegis.exe'), '--compress', 'GZip'],
  { stdio: 'inherit' },
);

console.log('3/3 Données éditables et notice…');
await fs.cp(path.join(ROOT, 'data'), path.join(OUT, 'data'), { recursive: true });
await fs.writeFile(
  path.join(OUT, 'LISEZMOI.txt'),
  [
    `Aegis ${pkgJson.version} — prototype rogue-lite (Node.js + Canvas)`,
    '',
    '1. Double-cliquez sur Aegis.exe : le serveur local démarre et le jeu s\'ouvre dans votre navigateur',
    '   (http://127.0.0.1:3000). Gardez la fenêtre console ouverte pendant la partie ; fermez-la pour quitter.',
    '2. Contrôles : ZQSD / WASD / flèches pour se déplacer, Échap pour la pause, 1-3 pour choisir une amélioration.',
    '3. La progression méta est sauvegardée dans le dossier "saves" à côté de l\'exécutable.',
    '4. Le dossier "data" contient tout le contenu du jeu (ennemis, vagues, améliorations…) :',
    '   modifiez-le puis relancez Aegis.exe. En cas d\'erreur, la console indique le fichier et le champ fautifs.',
    '',
    'Port déjà utilisé ? Lancez depuis une console :  set PORT=3001 && Aegis.exe',
    '',
  ].join('\r\n'),
);
await fs.rm(pkgConfig);
const { size } = await fs.stat(path.join(OUT, 'Aegis.exe'));
console.log(`\n✔ ${path.relative(ROOT, OUT)}${path.sep}Aegis.exe (${(size / 1e6).toFixed(1)} Mo)`);
