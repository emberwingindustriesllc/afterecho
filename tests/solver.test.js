import test from 'node:test';
import assert from 'node:assert';
import { PuzzleSolver } from '../dist/engine/solver.js';
import { CAMPAIGN_LEVELS } from '../dist/engine/levels.js';

test('PuzzleSolver solves Level 1 optimally', () => {
  const level1 = CAMPAIGN_LEVELS[0];
  const result = PuzzleSolver.solve(level1, 10);
  assert.strictEqual(result.solved, true);
  assert.strictEqual(result.minMoves, 3);
  assert.deepStrictEqual(result.solutionPath, ['RIGHT', 'RIGHT', 'RIGHT']);
});

test('PuzzleSolver solves Level 2 without paradox', () => {
  const level2 = CAMPAIGN_LEVELS[1];
  const result = PuzzleSolver.solve(level2, 12);
  assert.strictEqual(result.solved, true);
  assert.strictEqual(result.minMoves, 6);
});

test('PuzzleSolver solves Level 4 (Pressure Point) with Echo coordination', () => {
  const level4 = CAMPAIGN_LEVELS[3]; // Pressure Point
  const result = PuzzleSolver.solve(level4, 16);
  assert.strictEqual(result.solved, true);
  assert.strictEqual(result.minMoves, 8);
});

test('PuzzleSolver.solveFromState provides accurate live hints mid-level', async () => {
  const { GameEngine } = await import('../dist/engine/gameEngine.js');
  const level4 = CAMPAIGN_LEVELS[3];
  let state = GameEngine.createInitialState(level4);
  state = GameEngine.applyAction(state, 'UP', level4).nextState;
  state = GameEngine.applyAction(state, 'UP', level4).nextState;

  const hintResult = PuzzleSolver.solveFromState(state, level4, 16);
  assert.strictEqual(hintResult.solved, true);
  assert.strictEqual(hintResult.minMoves, 6);
  assert.strictEqual(hintResult.solutionPath[0], 'RIGHT');
});

