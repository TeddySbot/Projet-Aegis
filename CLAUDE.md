# CLAUDE.md — Guide du dépôt pour assistants IA

> À lire en premier. **À tenir à jour** à chaque changement d'architecture, de commande ou de convention.
> Dernière mise à jour : 2026-09-28.

## Le projet en bref

**Aegis** — prototype de rogue-lite à vagues (survivors-like) pour le Workshop B3 « Projet Aegis »
(La Horde). Le sujet (`B3_Workshop_1_Sujet_1.pdf`) demande une **architecture modulaire et découplée** ;
le contenu du jeu n'est qu'un prétexte. Particularité choisie : **site web en Node.js** au lieu d'un moteur
(Unity/Godot). Barème : architecture 50 · build fonctionnelle 20 · document 20 · code/Git 10.

Exigences du sujet → où elles sont satisfaites :

| Exigence | Implémentation |
|---|---|
| Machine à états (Menu, En jeu, Pause, Game Over) | `client/src/core/StateMachine.js` (pile) + `client/src/states/` + `states/transitions.js` (+ état `LevelUp`) |
| Event Bus / Observer | `client/src/core/EventBus.js`, catalogue `client/src/core/events.js` |
| Managers/services sans singleton | DI par constructeur ; `ServiceContainer` uniquement dans `client/src/main.js` ; `gameplay/Run.js` ; `server/index.js` |
| Conception orientée données | `data/*.json` validés par `shared/content/validateContent.js` ; registres de stratégies |
| Méta-progression persistante | `shared/meta/metaRules.js`, `client/src/meta/`, `server/persistence/FileProfileStore.js` |
| Run minimale 2-3 min | 3 vagues + boss (`data/waves.json`), ≈ 2 min 30 |
| Build Windows | `npm run build:win` → `dist/Aegis-win/Aegis.exe` (esbuild + @yao-pkg/pkg) |
| Document | `docs/ARCHITECTURE.md` (schémas Mermaid) |

## Commandes

```bash
npm start                  # serveur sur http://127.0.0.1:3000 (0 dépendance d'exécution)
npm test                   # node --test "tests/**/*.test.js" — doit rester vert (57 tests)
npm run simulate -- --runs=5 --verbose   # runs complètes headless via AutopilotInput
npm run validate-data      # valide data/
npm run build:win          # exe Windows (devDependencies : esbuild, @yao-pkg/pkg ; télécharge un binaire Node)
```

Démo navigateur : `/?autopilot=1&autostart=1&debug=1&speed=3`, désactivation : `?disable=score,xp,sfx,fx`.

## Carte de l'architecture

```text
client/src/core/          moteur générique, ne dépend de RIEN
client/src/gameplay/      logique pure : dépend UNIQUEMENT de core/ (jamais DOM, fetch, window, meta/)
  Run.js                  composition root d'une run ; SYSTEM_DEFINITIONS = ordre de mise à jour
  systems/                GameSystem (base) + 9 systèmes ; required : player, combat, director
  behaviors/ weapons/ upgrades/   registres de stratégies indexés par les noms utilisés dans data/
client/src/app/RunSession.js      crée/détruit la Run, injecte les modificateurs méta
client/src/meta/          MetaProgressionService (écoute RUN_ENDED, fournit getRunModifiers) + dépôts HTTP/local
client/src/states/        états globaux ; transitions déclarées dans transitions.js
client/src/presentation/  rendu Canvas, HUD, FX, sons, écrans DOM — lecture seule sur le monde
client/src/platform/      adaptateurs navigateur (clavier, ApiClient)
client/src/debug/         AutopilotInput, AutoChooser (IA de démo/test)
client/src/main.js        composition root du client (seul endroit avec ServiceContainer)
shared/                   isomorphe serveur+client : validation des données, règles méta pures
server/                   http natif : app.js (injectable), routes/, http/ (router, statique), content/, persistence/
data/                     contenu JSON (config, player, enemies, weapons, waves, upgrades, meta-upgrades)
tests/                    node:test ; helpers.js (loadContent, recordEvents, idleInput)
tools/                    simulate-run.js (exporte simulateRun), validate-data.js, build-win.js
```

Le serveur n'expose en statique que `client/` et `shared/` (URL `/client/...`, `/shared/...`) : les imports
relatifs `../../../shared/...` fonctionnent ainsi à l'identique dans le navigateur et dans Node.

API : `GET /api/health`, `GET /api/content`, `GET /api/profile`, `POST /api/profile/runs` (le serveur calcule
la récompense), `POST /api/profile/purchases {upgradeId}`, `DELETE /api/profile`.

## Règles à respecter (invariants d'architecture)

1. **Pas de singleton ni d'état global.** Toute dépendance passe par le constructeur. Ne pas passer le
   `ServiceContainer` aux classes (anti-pattern Service Locator).
2. **Les systèmes ne s'importent pas entre eux.** Communication via `bus.emit/on` avec les noms de
   `GameEvents`. Nouvel événement → l'ajouter à `core/events.js` avec la forme du payload en commentaire.
3. **`gameplay/` reste exécutable dans Node** (tests + simulation). Aucun accès DOM/réseau/`Math.random`
   (utiliser le `Random` injecté pour le déterminisme).
4. **Abonnements libérés** : dans un système, utiliser `this.subs.on(...)` (SubscriptionGroup) ; un test
   vérifie qu'aucun abonné ne survit à `run.dispose()`.
5. **Pas de transition d'état pendant `run.update()`** : `PlayingState` met les transitions en attente.
6. **Aucune valeur d'équilibrage en dur** : elle va dans `data/`. Nouveau mot-clé de données (comportement,
   type d'arme, ciblage, effet) → implémentation dans le registre + ajout dans `shared/content/vocabulary.js`
   (test de cohérence `tests/registries.test.js`) + validation si besoin.
7. **La présentation ne modifie pas le monde** ; le HUD n'écoute que des événements.
8. **Méta ↔ gameplay** : seule interface = `RUN_ENDED` (résumé) et `getRunModifiers()` (données).
9. Un système optionnel doit pouvoir être désactivé (`?disable=`) : `tests/gameplay/decoupling.test.js`.

## Recettes

- *Ajouter un ennemi* : entrée dans `data/enemies.json` puis règle d'apparition dans `data/waves.json`.
- *Ajouter une amélioration* : entrée dans `data/upgrades.json` (effets `stat` | `heal` | `grantWeapon` | `weaponStat`).
- *Nouveau comportement d'ennemi* : fonction dans `gameplay/behaviors/enemyBehaviors.js` + `ENEMY_BEHAVIORS`.
- *Nouveau système* : classe héritant de `GameSystem`, entrée dans `SYSTEM_DEFINITIONS` (ordre !), test isolé.
- *Rééquilibrer* : modifier `data/`, puis `npm run simulate -- --runs=10` (objectif : victoire IA en ~150-200 s).

## Conventions

- Code, commentaires, messages d'UI et commits **en français**. JS moderne (ES2022, modules ES), JSDoc pour les types.
- Commits conventionnels : `feat(core|gameplay|server|client|meta)`, `fix`, `balance`, `test`, `build`, `docs`, `chore`.
- Auteur Git du dépôt : `TeddyS <100373745+TeddySbot@users.noreply.github.com>`, remote `TeddySbot/Projet-Aegis`.
- Fins de ligne normalisées LF (`.gitattributes`) ; le dépôt est développé sous Windows.
- `saves/`, `dist/`, `node_modules/` sont ignorés par Git.

## Pièges connus

- `server/paths.js` : dans l'exe, `__AEGIS_ROOT__` est injecté par la bannière esbuild ; `import.meta.url`
  n'est utilisé qu'hors bundle. Un dossier `data/` à côté de l'exe est prioritaire.
- Le build Windows télécharge le binaire Node via `pkg-fetch` (GitHub) : réseau nécessaire la première fois.
- `node --test "tests/**/*.test.js"` : le glob est résolu par Node ≥ 21 (les guillemets sont nécessaires).
- Le résumé de run n'est pas vérifié côté serveur (limite assumée, cf. docs § 8).

## État actuel / pistes

Fonctionnel et testé (57 tests, simulation OK, run jouée dans Chromium). Pistes : TypeScript + événements
typés, grille spatiale/pooling, JSON Schema + éditeur de contenu avec rechargement à chaud (SSE), rejeu
serveur des runs (anti-triche via graine + entrées), Electron/Tauri, manette.
