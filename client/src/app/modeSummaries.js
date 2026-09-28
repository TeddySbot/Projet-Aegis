/**
 * Résumés des modes de jeu pour l'écran titre, calculés à partir du contenu (aucune
 * valeur en dur : changer `waves.json` ou `endless.json` met le menu à jour).
 * Fonction pure, sans DOM : testable dans Node.
 *
 * @returns {{ story: { waves: number, bossName: string|null, minutes: number },
 *   endless: { name: string, description: string, waveDuration: number, bossEvery: number, bossTimeLimit: number, uncapped: boolean } }}
 */
export function describeModes(content) {
  const waves = content.waves.waves;
  const bosses = new Map(content.enemies.filter((e) => e.boss).map((e) => [e.id, e.name]));
  const bossRule = waves.flatMap((w) => w.spawns).find((s) => bosses.has(s.enemy));
  const seconds = waves.reduce((sum, w) => sum + w.duration, 0);
  const e = content.endless;
  return {
    story: { waves: waves.length, bossName: bossRule ? bosses.get(bossRule.enemy) : null, minutes: Math.max(1, Math.ceil(seconds / 60)) },
    endless: {
      name: e.name ?? 'Mode infini',
      description: e.description ?? '',
      waveDuration: e.waveDuration,
      bossEvery: e.bossEvery,
      bossTimeLimit: e.bossTimeLimit,
      uncapped: Boolean(e.upgrades?.uncapped),
    },
  };
}
