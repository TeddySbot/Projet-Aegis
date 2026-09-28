import { GameEvents } from '../core/events.js';
import { SubscriptionGroup } from '../core/EventBus.js';
import { GameState } from '../core/StateMachine.js';

/**
 * État « En jeu » : fait avancer la run, rend le monde.
 *
 * Les transitions déclenchées par des événements de gameplay (fin de run, choix
 * d'amélioration) sont MISES EN ATTENTE puis appliquées après la mise à jour :
 * on ne détruit jamais la run au milieu de son propre `update()`.
 */
export class PlayingState extends GameState {
  /**
   * @param {{ session: import('../app/RunSession.js').RunSession, renderer: any, fx: any, hud: any, input: any, bus: any }} deps
   */
  constructor({ session, renderer, fx, hud, input, bus }) {
    super('Playing');
    this._session = session;
    this._renderer = renderer;
    this._fx = fx;
    this._hud = hud;
    this._input = input;
    this._bus = bus;
    this._pending = null;
  }

  /** @param {{ mode?: string }} [params] mode de jeu choisi au menu (campagne par défaut) */
  enter(params) {
    this._pending = null;
    this._subs = new SubscriptionGroup(this._bus)
      .on(GameEvents.UPGRADE_CHOICES_OFFERED, (offer) => this._queue({ kind: 'push', to: 'LevelUp', params: offer }))
      .on(GameEvents.RUN_ENDED, (summary) => this._queue({ kind: 'change', to: 'GameOver', params: summary, priority: true }));
    this._offKeys = this._input.onKey?.(['Escape', 'KeyP'], () => {
      if (this.machine.current === this) this._queue({ kind: 'push', to: 'Paused' });
    });
    this._hud.show();
    this._session.start(params?.mode ?? 'story');
  }

  exit() {
    this._subs.dispose();
    this._offKeys?.();
    this._session.dispose();
  }

  resume() {
    // Une nouvelle offre a pu être émise pendant l'overlay : elle reste en attente.
    const offer = this._session.run?.pendingOffer;
    if (offer && !this._pending) this._queue({ kind: 'push', to: 'LevelUp', params: offer });
  }

  _queue(transition) {
    if (this._pending?.priority && !transition.priority) return;
    this._pending = transition;
  }

  update(dt) {
    if (!this._pending) {
      this._session.run?.update(dt);
      this._fx.update(dt);
    }
    const t = this._pending;
    if (!t || this.machine.current !== this) return;
    this._pending = null;
    if (t.kind === 'push') this.machine.push(t.to, t.params);
    else this.machine.change(t.to, t.params);
  }

  render() {
    const world = this._session.world;
    if (world) this._renderer.render(world);
  }
}
