/**
 * `npm run simulate` — joue des runs complètes SANS navigateur ni serveur.
 *
 * Utilise exactement le code de gameplay du client (modules ES partagés), piloté par
 * l'AutopilotInput et un choix automatique d'améliorations. Vérifie qu'une run va au
 * bout sans exception et affiche un résumé (utile pour équilibrer les données).
 *
 * Options : --runs=N  --seed=S  --disable=score,xp  --verbose
 */
import path from 'node:path';
import { ContentRepository } from '../server/content/ContentRepository.js';
import { DATA_DIR } from '../server/paths.js';
import { EventBus } from '../client/src/core/EventBus.js';
import { GameEvents } from '../client/src/core/events.js';
import { Random } from '../client/src/core/Random.js';
import { Run } from '../client/src/gameplay/Run.js';
import { AutopilotInput } from '../client/src/debug/AutopilotInput.js';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);

/**
 * Simule une run complète et renvoie son résumé.
 * @param {{ content: any, seed: number, disabled?: string[], maxSeconds?: number, verbose?: boolean, modifiers?: any }} options
 */
export function simulateRun({ content, seed, disabled = [], maxSeconds = 600, verbose = false, modifiers }) {
  const errors = [];
  const bus = new EventBus({ onError: (err, event) => errors.push(`${event}: ${err.stack ?? err}`) });
  let run = null;
  const input = new AutopilotInput({ getWorld: () => run?.world ?? null });
  const rng = new Random(seed);
  run = new Run({ content, bus, input, rng, seed, disabled, modifiers });

  const counts = {};
  const count = (e) => bus.on(e, () => (counts[e] = (counts[e] ?? 0) + 1));
  Object.values(GameEvents).forEach(count);

  const picks = [];
  bus.on(GameEvents.UPGRADE_CHOICES_OFFERED, ({ choices }) => {
    // choix simple : privilégie les nouvelles armes, sinon la première proposition
    const pick = choices.find((c) => c.effects.some((fx) => fx.type === 'grantWeapon')) ?? choices[0];
    picks.push(pick.id);
    queueMicrotask(() => bus.emit(GameEvents.UPGRADE_CHOSEN, { upgradeId: pick.id }));
  });
  if (verbose) {
    bus.on(GameEvents.WAVE_STARTED, ({ index, wave }) => console.log(`  [${run.world.time.toFixed(1)}s] vague ${index + 1} : ${wave.name}`));
    bus.on(GameEvents.BOSS_SPAWNED, () => console.log(`  [${run.world.time.toFixed(1)}s] BOSS !`));
  }

  let summary = null;
  bus.on(GameEvents.RUN_ENDED, (s) => (summary = s));
  run.start();

  const dt = 1 / 60;
  let steps = 0;
  const pumpMicrotasks = () => new Promise((r) => setImmediate(r));
  return (async () => {
    while (!run.ended && steps < maxSeconds * 60) {
      run.update(dt);
      steps++;
      if (run.pendingOffer) await pumpMicrotasks();
    }
    if (!run.ended) run.abandon();
    run.dispose();
    return { summary, errors, picks, counts, peakEnemies: counts[GameEvents.ENEMY_SPAWNED] ?? 0 };
  })();
}

const isMain = path.basename(process.argv[1] ?? '') === 'simulate-run.js';
if (isMain) {
  const content = await new ContentRepository({ dataDir: DATA_DIR }).load();
  const runs = Number(args.runs ?? 5);
  const baseSeed = Number(args.seed ?? 1);
  const disabled = typeof args.disable === 'string' ? args.disable.split(',') : [];
  let failures = 0;
  console.log(`Simulation de ${runs} run(s)${disabled.length ? ` — systèmes désactivés : ${disabled.join(', ')}` : ''}\n`);
  for (let i = 0; i < runs; i++) {
    const seed = baseSeed + i;
    const { summary, errors, picks } = await simulateRun({ content, seed, disabled, verbose: Boolean(args.verbose) });
    const s = summary;
    console.log(
      `seed ${String(seed).padEnd(4)} ${s.outcome.padEnd(8)} ${s.duration.toFixed(0).padStart(4)}s  vague ${s.wave}  niv. ${String(s.level).padStart(2)}  ` +
        `kills ${String(s.kills).padStart(4)}  score ${String(s.score).padStart(6)}  améliorations : ${picks.length}`,
    );
    if (errors.length) {
      failures++;
      console.error(errors.join('\n'));
    }
  }
  if (failures) {
    console.error(`\n✘ ${failures} run(s) avec erreurs`);
    process.exitCode = 1;
  } else console.log('\n✔ Aucune erreur pendant les simulations');
}
