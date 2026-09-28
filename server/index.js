/**
 * Point d'entrée serveur — composition root.
 * Construit les dépendances concrètes, valide le contenu, démarre HTTP.
 *
 * Variables d'environnement : PORT (3000), HOST (127.0.0.1), AEGIS_DATA_DIR, AEGIS_SAVE_DIR.
 * Option `--open` : ouvre le navigateur par défaut (utilisé par l'exécutable Windows).
 */
import { spawn } from 'node:child_process';
import { createApp } from './app.js';
import { ContentRepository, ContentValidationError } from './content/ContentRepository.js';
import { FileProfileStore } from './persistence/FileProfileStore.js';
import { DATA_DIR, IS_PACKAGED, PUBLIC_DIRS, SAVE_DIR } from './paths.js';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '127.0.0.1';
const shouldOpen = process.argv.includes('--open') || IS_PACKAGED;

async function main() {
  const content = new ContentRepository({ dataDir: DATA_DIR });
  try {
    await content.load();
  } catch (err) {
    if (err instanceof ContentValidationError) {
      console.error(err.message);
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  const profiles = new FileProfileStore({ dir: SAVE_DIR });
  const { server } = createApp({ content, profiles, publicDirs: PUBLIC_DIRS });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') console.error(`Le port ${PORT} est déjà utilisé. Lancez avec PORT=xxxx.`);
    else console.error(err);
    process.exit(1);
  });

  server.listen(PORT, HOST, () => {
    const url = `http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`;
    console.log(`\n  ⛨  Aegis est prêt : ${url}`);
    console.log(`     Données : ${DATA_DIR}`);
    console.log(`     Sauvegardes : ${SAVE_DIR}`);
    console.log('     Ctrl+C pour quitter.\n');
    if (shouldOpen) openBrowser(url);
  });

  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try {
    spawn(cmd[0], cmd[1], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
  } catch {
    /* pas de navigateur : l'URL est affichée dans la console */
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
