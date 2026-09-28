/**
 * StateMachine — machine à états à pile (pushdown automaton) pour les états globaux du jeu.
 *
 *  - `change(name)` remplace l'état courant (Menu → En jeu, Game Over → Menu…)
 *  - `push(name)` empile un état « overlay » sans quitter l'état sous-jacent
 *    (En jeu → Pause : la run n'est ni détruite ni réinitialisée)
 *  - `pop()` revient à l'état précédent (Pause → En jeu)
 *
 * Les transitions autorisées sont DÉCLARÉES dans une table unique : aucune
 * logique de transition n'est dupliquée dans les états, et une transition
 * illégale lève une erreur explicite au lieu de produire un état incohérent.
 */
export class GameState {
  /** @param {string} name */
  constructor(name) {
    this.name = name;
    /** @type {StateMachine|null} */
    this.machine = null;
  }
  /** Appelé à l'entrée dans l'état. `params` provient de change()/push(). */
  enter(_params) {}
  /** Appelé à la sortie définitive de l'état (change ou pop de cet état). */
  exit() {}
  /** Appelé quand un état est empilé par-dessus (ex : pause). */
  pause() {}
  /** Appelé quand l'état redevient le sommet de la pile. */
  resume(_params) {}
  /** Mise à jour logique à pas fixe — seul l'état au sommet est mis à jour. */
  update(_dt) {}
  /** Rendu — tous les états de la pile sont rendus du bas vers le haut. */
  render(_alpha) {}
}

export class StateMachine {
  /**
   * @param {{ transitions: Record<string, string[]>, onChange?: (info: {from: string|null, to: string, kind: string}) => void }} config
   */
  constructor({ transitions, onChange }) {
    /** @type {Map<string, GameState>} */
    this._states = new Map();
    /** @type {GameState[]} */
    this._stack = [];
    this._transitions = transitions;
    this._onChange = onChange ?? (() => {});
    this._busy = false;
  }

  /** @param {GameState} state */
  register(state) {
    if (this._states.has(state.name)) throw new Error(`État déjà enregistré : ${state.name}`);
    state.machine = this;
    this._states.set(state.name, state);
    return this;
  }

  get current() {
    return this._stack[this._stack.length - 1] ?? null;
  }

  get currentName() {
    return this.current?.name ?? null;
  }

  /** Noms des états empilés, du bas vers le haut. */
  get stackNames() {
    return this._stack.map((s) => s.name);
  }

  canTransition(to) {
    const from = this.currentName;
    if (from === null) return true; // état initial
    return (this._transitions[from] ?? []).includes(to);
  }

  /** Démarre la machine (aucune validation de transition). */
  start(name, params) {
    if (this._stack.length) throw new Error('StateMachine déjà démarrée');
    const state = this._get(name);
    this._stack.push(state);
    state.enter(params);
    this._onChange({ from: null, to: name, kind: 'start' });
  }

  /** Remplace toute la pile par l'état `name`. */
  change(name, params) {
    this._guard(name);
    const from = this.currentName;
    this._busy = true;
    try {
      while (this._stack.length) this._stack.pop().exit();
      const state = this._get(name);
      this._stack.push(state);
      state.enter(params);
    } finally {
      this._busy = false;
    }
    this._onChange({ from, to: name, kind: 'change' });
  }

  /** Empile un état overlay par-dessus l'état courant. */
  push(name, params) {
    this._guard(name);
    const from = this.currentName;
    this.current?.pause();
    const state = this._get(name);
    this._stack.push(state);
    state.enter(params);
    this._onChange({ from, to: name, kind: 'push' });
  }

  /** Dépile l'état courant et reprend celui du dessous. */
  pop(params) {
    if (this._stack.length < 2) throw new Error('pop() impossible : aucun état sous-jacent');
    const top = this._stack[this._stack.length - 1];
    const below = this._stack[this._stack.length - 2];
    if (!(this._transitions[top.name] ?? []).includes(below.name)) {
      throw new Error(`Transition interdite : ${top.name} → ${below.name}`);
    }
    this._stack.pop().exit();
    below.resume(params);
    this._onChange({ from: top.name, to: below.name, kind: 'pop' });
  }

  update(dt) {
    this.current?.update(dt);
  }

  render(alpha) {
    for (const state of this._stack) state.render(alpha);
  }

  _guard(to) {
    if (this._busy) throw new Error('Transition ré-entrante pendant un changement d\'état');
    if (!this.canTransition(to)) throw new Error(`Transition interdite : ${this.currentName} → ${to}`);
  }

  _get(name) {
    const state = this._states.get(name);
    if (!state) throw new Error(`État inconnu : ${name}`);
    return state;
  }
}
