/**
 * Point d'entrée navigateur — COMPOSITION ROOT du client.
 *
 * C'est le seul endroit qui connaît les implémentations concrètes et les assemble.
 * Tout le reste reçoit ses dépendances par constructeur : pas de singleton global.
 *
 * Paramètres d'URL (démonstration du découplage / debug) :
 *   ?disable=score,xp,sfx,fx   désactive des systèmes
 *   ?seed=42                   graine fixe (run reproductible)
 *   ?autopilot=1               une IA joue à votre place (et &autostart=1 lance la run)
 *   ?mode=endless              avec autostart : lance directement le mode infini
 *   ?debug=1                   overlay d'information (FPS, pile d'états, systèmes)
 *   ?storage=local             force la sauvegarde locale (sans serveur)
 *   ?speed=4                   accélère la simulation (démo / tests end-to-end)
 */
import { EventBus } from './core/EventBus.js';
import { GameLoop } from './core/GameLoop.js';
import { ServiceContainer } from './core/ServiceContainer.js';
import { StateMachine } from './core/StateMachine.js';
import { ApiClient } from './platform/ApiClient.js';
import { KeyboardInput } from './platform/KeyboardInput.js';
import { HttpProfileRepository } from './meta/HttpProfileRepository.js';
import { LocalProfileRepository, MemoryStorage } from './meta/LocalProfileRepository.js';
import { MetaProgressionService } from './meta/MetaProgressionService.js';
import { RunSession } from './app/RunSession.js';
import { describeModes } from './app/modeSummaries.js';
import { OPTIONAL_SYSTEMS } from './gameplay/Run.js';
import { CanvasRenderer } from './presentation/CanvasRenderer.js';
import { FxLayer } from './presentation/FxLayer.js';
import { Hud } from './presentation/Hud.js';
import { SfxPlayer } from './presentation/SfxPlayer.js';
import { DebugOverlay } from './presentation/DebugOverlay.js';
import { MenuScreen } from './presentation/screens/MenuScreen.js';
import { SanctuaryScreen } from './presentation/screens/SanctuaryScreen.js';
import { PauseScreen } from './presentation/screens/PauseScreen.js';
import { LevelUpScreen } from './presentation/screens/LevelUpScreen.js';
import { GameOverScreen } from './presentation/screens/GameOverScreen.js';
import { MenuState } from './states/MenuState.js';
import { SanctuaryState } from './states/SanctuaryState.js';
import { PlayingState } from './states/PlayingState.js';
import { PausedState } from './states/PausedState.js';
import { LevelUpState } from './states/LevelUpState.js';
import { GameOverState } from './states/GameOverState.js';
import { STATE_TRANSITIONS } from './states/transitions.js';
import { AutopilotInput } from './debug/AutopilotInput.js';
import { AutoChooser } from './debug/AutoChooser.js';

const params = new URLSearchParams(location.search);
const flags = {
  disabled: (params.get('disable') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  seed: params.has('seed') ? Number(params.get('seed')) : null,
  autopilot: params.get('autopilot') === '1',
  autostart: params.get('autostart') === '1',
  mode: params.get('mode') === 'endless' ? 'endless' : 'story',
  debug: params.get('debug') === '1',
  forceLocal: params.get('storage') === 'local',
  speed: Math.min(8, Math.max(1, Number(params.get('speed') ?? 1) || 1)),
};

const bootEl = document.getElementById('boot');

async function boot() {
  const c = new ServiceContainer();
  const api = new ApiClient();

  // --- Données & persistance ------------------------------------------------
  const content = await api.get('/api/content');
  const systemsConfig = content.config.systems ?? {};
  const isOn = (id) => systemsConfig[id] !== false && !flags.disabled.includes(id);

  c.value('content', content);
  c.register('bus', () => new EventBus({ debug: false }));
  c.value('profileRepository', await chooseRepository(api, content, flags.forceLocal));
  c.register('meta', (c) => new MetaProgressionService({ bus: c.resolve('bus'), repository: c.resolve('profileRepository'), catalog: content.metaUpgrades }));

  // --- Entrées --------------------------------------------------------------
  c.register('keyboard', () => new KeyboardInput());
  c.register('gameInput', (c) => (flags.autopilot ? new AutopilotInput({ getWorld: () => c.resolve('session').world }) : c.resolve('keyboard')));

  // --- Gameplay (via la session applicative) -------------------------------
  c.register(
    'session',
    (c) =>
      new RunSession({
        bus: c.resolve('bus'),
        content,
        input: c.resolve('gameInput'),
        getModifiers: () => c.resolve('meta').getRunModifiers(),
        disabledSystems: flags.disabled.filter((id) => OPTIONAL_SYSTEMS.includes(id)),
        seed: flags.seed,
      }),
  );

  // --- Présentation ----------------------------------------------------------
  const screensRoot = document.getElementById('screens');
  c.register('fx', (c) => new FxLayer({ bus: c.resolve('bus'), options: { floatingText: isOn('floatingText') && isOn('fx'), screenShake: isOn('screenShake') && isOn('fx') } }));
  c.register('renderer', (c) => new CanvasRenderer({ canvas: document.getElementById('game'), fx: c.resolve('fx') }));
  c.register('hud', (c) => new Hud({ root: document.getElementById('hud'), bus: c.resolve('bus') }));
  if (isOn('sfx')) c.register('sfx', (c) => new SfxPlayer({ bus: c.resolve('bus') }));

  // --- États -----------------------------------------------------------------
  c.register('machine', (c) => {
    const deps = { bus: c.resolve('bus'), input: c.resolve('keyboard'), session: c.resolve('session') };
    return new StateMachine({ transitions: STATE_TRANSITIONS, onChange: ({ to }) => (document.body.dataset.state = to) })
      .register(
        new MenuState({ ...deps, screen: new MenuScreen({ root: screensRoot }), meta: c.resolve('meta'), hud: c.resolve('hud'), modes: describeModes(content) }),
      )
      .register(new SanctuaryState({ ...deps, screen: new SanctuaryScreen({ root: screensRoot }), meta: c.resolve('meta') }))
      .register(new PlayingState({ ...deps, renderer: c.resolve('renderer'), fx: c.resolve('fx'), hud: c.resolve('hud') }))
      .register(new PausedState({ ...deps, screen: new PauseScreen({ root: screensRoot }) }))
      .register(new LevelUpState({ ...deps, screen: new LevelUpScreen({ root: screensRoot }) }))
      .register(new GameOverState({ ...deps, screen: new GameOverScreen({ root: screensRoot }), meta: c.resolve('meta') }));
  });

  // --- Démarrage ---------------------------------------------------------------
  await c.resolve('meta').load();
  if (c.has('sfx')) {
    const sfx = c.resolve('sfx');
    c.resolve('keyboard').onKey(['KeyM'], () => sfx.toggleMute());
  }
  if (flags.autopilot) new AutoChooser({ bus: c.resolve('bus') });

  const machine = c.resolve('machine');
  const debug = flags.debug ? new DebugOverlay({ root: document.body, bus: c.resolve('bus'), machine, session: c.resolve('session') }) : null;
  let last = performance.now();
  const loop = new GameLoop({
    update: (dt) => {
      for (let i = 0; i < flags.speed; i++) machine.update(dt);
    },
    render: (alpha) => {
      machine.render(alpha);
      const now = performance.now();
      debug?.frame((now - last) / 1000);
      last = now;
    },
  });

  bootEl.remove();
  machine.start('Menu');
  if (flags.autostart) machine.change('Playing', { mode: flags.mode });
  loop.start();

  // Exposé uniquement pour le débogage dans la console / les tests end-to-end.
  window.__aegis = { container: c, machine };
}

/** Dépôt serveur si joignable, sinon sauvegarde locale (le jeu reste jouable sans API de profil). */
async function chooseRepository(api, content, forceLocal) {
  const local = () =>
    new LocalProfileRepository({ storage: safeLocalStorage(), rewards: content.config.rewards, catalog: content.metaUpgrades });
  if (forceLocal) return local();
  const remote = new HttpProfileRepository({ api });
  try {
    await remote.load();
    return remote;
  } catch (err) {
    console.warn('[meta] API de profil indisponible, bascule en sauvegarde locale', err);
    return local();
  }
}

function safeLocalStorage() {
  try {
    localStorage.setItem('aegis.probe', '1');
    localStorage.removeItem('aegis.probe');
    return localStorage;
  } catch {
    return new MemoryStorage();
  }
}

boot().catch((err) => {
  console.error(err);
  bootEl.classList.add('error');
  bootEl.textContent = `Impossible de démarrer Aegis : ${err.message}. Le serveur Node est-il lancé (npm start) ?`;
});
