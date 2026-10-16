import test from 'node:test';
import assert from 'node:assert';
import { PuzzleSolver } from '../engine/solver.js';
import { CAMPAIGN_LEVELS } from '../engine/levels.js';
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
    assert.ok(result.minMoves <= 10);
});
