# ⛨ Aegis

Prototype de **rogue-lite à vagues d'ennemis** (type *survivors-like*) réalisé en **Node.js** pour le
Workshop B3 « Projet Aegis ». L'accent est mis sur l'architecture : machine à états, Event Bus, injection
de dépendances, contenu piloté par les données et méta-progression persistante découplée du gameplay.

- 📐 **Document d'architecture** : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- 🤖 **Guide pour assistants IA** : [`CLAUDE.md`](CLAUDE.md)

## Lancer le jeu

**Windows, sans rien installer** : `dist/Aegis-win/Aegis.exe` (voir [Build Windows](#build-windows)).
Le serveur local démarre et le jeu s'ouvre dans le navigateur.

**Depuis les sources** (Node.js ≥ 20) :

```bash
npm start            # http://127.0.0.1:3000 (aucune dépendance à installer pour jouer)
```

| Action | Touches |
|---|---|
| Se déplacer | ZQSD / WASD / flèches |
| Pause | Échap ou P |
| Choisir une amélioration | clic ou 1 · 2 · 3 |
| Couper le son | M |
| Écran titre : campagne / mode infini / Sanctuaire | Entrée / I / S |

Une run dure ≈ 2 min 30 : trois vagues, un boss, des montées de niveau avec choix d'améliorations, un score
final converti en **éclats** que l'on dépense entre les runs dans le *Sanctuaire* (améliorations permanentes,
page dédiée accessible depuis l'écran titre).

**∞ Mode infini** (carte de droite sur l'écran titre) : des vagues de 30 s sans fin, de plus en plus denses et
résistantes ; **toutes les 10 vagues, un boss géant** qu'il faut tuer **en moins d'une minute**, sinon la run
s'arrête. Chaque palier de boss est plus gros et plus puissant. Les améliorations n'ont plus de plafond.
Bonus d'éclats par boss vaincu et record de vague affiché au menu.

## Scripts

| Commande | Rôle |
|---|---|
| `npm start` | démarre le serveur (options : `PORT`, `HOST`, `AEGIS_DATA_DIR`, `AEGIS_SAVE_DIR`, `--open`) |
| `npm run dev` | idem avec redémarrage automatique |
| `npm test` | 82 tests `node:test` |
| `npm run simulate -- --runs=10 --verbose` | joue des runs complètes sans navigateur (IA) ; `--mode=endless` pour le mode infini |
| `npm run validate-data` | valide les fichiers de `data/` |
| `npm run build:win` | produit `dist/Aegis-win/Aegis.exe` (nécessite `npm install`) |

## Paramètres d'URL (démonstration de l'architecture)

| Paramètre | Effet |
|---|---|
| `?disable=score,xp,sfx` | désactive des systèmes : le jeu continue de fonctionner |
| `?autopilot=1&autostart=1` | une IA joue à votre place (`&mode=endless` : en mode infini) |
| `?debug=1` | overlay : FPS, pile d'états, systèmes actifs, événements/s |
| `?seed=42` | run reproductible |
| `?speed=3` | accélère la simulation |
| `?storage=local` | sauvegarde dans le navigateur au lieu du serveur |

Exemple : <http://127.0.0.1:3000/?autopilot=1&autostart=1&debug=1&disable=score>

## Build Windows

```bash
npm install
npm run build:win
```

Produit `dist/Aegis-win/` : `Aegis.exe` (Node 22 embarqué), un dossier `data/` modifiable (prioritaire sur
les données embarquées) et `LISEZMOI.txt`. Les sauvegardes sont écrites dans `saves/` à côté de l'exécutable.
La compilation fonctionne aussi depuis macOS/Linux.

## Structure

```text
client/   navigateur : core/ (moteur) · gameplay/ (logique pure) · states/ · presentation/ · meta/
shared/   code isomorphe : validation des données, règles de méta-progression
server/   serveur HTTP Node.js sans dépendance (API + fichiers statiques)
data/     tout le contenu du jeu en JSON
tests/    node:test
tools/    simulation, validation, build Windows
docs/     document d'architecture
```
