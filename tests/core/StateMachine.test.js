import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameState, StateMachine } from '../../client/src/core/StateMachine.js';
import { STATE_TRANSITIONS } from '../../client/src/states/transitions.js';

class SpyState extends GameState {
  constructor(name, log) {
    super(name);
    this.log = log;
  }
  enter(p) { this.log.push(`${this.name}.enter${p ? `(${p})` : ''}`); }
  exit() { this.log.push(`${this.name}.exit`); }
  pause() { this.log.push(`${this.name}.pause`); }
  resume() { this.log.push(`${this.name}.resume`); }
  update() { this.log.push(`${this.name}.update`); }
  render() { this.log.push(`${this.name}.render`); }
}

function makeMachine() {
  const log = [];
  const m = new StateMachine({ transitions: STATE_TRANSITIONS });
  for (const name of Object.keys(STATE_TRANSITIONS)) m.register(new SpyState(name, log));
  return { m, log };
}

test('cycle complet Menu → Playing → Paused → Playing → GameOver → Menu', () => {
  const { m, log } = makeMachine();
  m.start('Menu');
  m.change('Playing');
  m.push('Paused');
  assert.deepEqual(m.stackNames, ['Playing', 'Paused']);
  m.pop();
  m.change('GameOver', 'victory');
  m.change('Menu');
  assert.deepEqual(log, [
    'Menu.enter', 'Menu.exit', 'Playing.enter', 'Playing.pause', 'Paused.enter',
    'Paused.exit', 'Playing.resume', 'Playing.exit', 'GameOver.enter(victory)', 'GameOver.exit', 'Menu.enter',
  ]);
});

test('une pause ne quitte pas l\'état En jeu (la run n\'est pas détruite)', () => {
  const { m, log } = makeMachine();
  m.start('Menu');
  m.change('Playing');
  log.length = 0;
  m.push('Paused');
  m.pop();
  assert.ok(!log.includes('Playing.exit'));
  assert.ok(!log.includes('Playing.enter'));
});

test('seul le sommet est mis à jour, toute la pile est rendue', () => {
  const { m, log } = makeMachine();
  m.start('Menu');
  m.change('Playing');
  m.push('LevelUp');
  log.length = 0;
  m.update(1 / 60);
  m.render(0);
  assert.deepEqual(log, ['LevelUp.update', 'Playing.render', 'LevelUp.render']);
});

test('les transitions non déclarées sont refusées', () => {
  const { m } = makeMachine();
  m.start('Menu');
  assert.throws(() => m.change('GameOver'), /Transition interdite : Menu → GameOver/);
  assert.throws(() => m.push('Paused'), /Transition interdite/);
  m.change('Playing');
  m.push('Paused');
  assert.throws(() => m.push('LevelUp'), /Transition interdite : Paused → LevelUp/);
});

test('pop() sans état sous-jacent est une erreur', () => {
  const { m } = makeMachine();
  m.start('Menu');
  assert.throws(() => m.pop(), /aucun état sous-jacent/);
});
