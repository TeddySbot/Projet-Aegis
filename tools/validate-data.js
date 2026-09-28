/** `npm run validate-data` — valide les fichiers de data/ sans lancer le serveur. */
import { ContentRepository, ContentValidationError } from '../server/content/ContentRepository.js';
import { DATA_DIR } from '../server/paths.js';

try {
  const bundle = await new ContentRepository({ dataDir: DATA_DIR }).load();
  console.log(
    `✔ Données valides : ${bundle.enemies.length} ennemis, ${bundle.waves.waves.length} vagues, ` +
      `${bundle.weapons.length} armes, ${bundle.upgrades.length} améliorations, ${bundle.metaUpgrades.length} améliorations méta.`,
  );
} catch (err) {
  console.error(err instanceof ContentValidationError ? err.message : err);
  process.exitCode = 1;
}
