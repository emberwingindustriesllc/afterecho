import test from 'node:test';
import assert from 'node:assert';
import { DailyEchoManager } from '../dist/engine/daily.js';
import { PuzzleSolver } from '../dist/engine/solver.js';

test('DailyEchoManager produces deterministic levels for the same date', () => {
  const d1 = DailyEchoManager.generateDailyLevel('2026-10-12');
  const d2 = DailyEchoManager.generateDailyLevel('2026-10-12');

  assert.strictEqual(d1.puzzleNumber, d2.puzzleNumber);
  assert.strictEqual(d1.level.playerStart.x, d2.level.playerStart.x);
  assert.strictEqual(d1.level.playerStart.y, d2.level.playerStart.y);
  assert.strictEqual(d1.level.exitPos.x, d2.level.exitPos.x);
  assert.strictEqual(d1.level.exitPos.y, d2.level.exitPos.y);
  assert.strictEqual(d1.level.echoDelay, d2.level.echoDelay);
});

test('DailyEchoManager produces different levels for different dates', () => {
  const d1 = DailyEchoManager.generateDailyLevel('2026-10-12');
  const d2 = DailyEchoManager.generateDailyLevel('2026-10-13');

  assert.notStrictEqual(d1.puzzleNumber, d2.puzzleNumber);
});

test('Daily Echo puzzle is verified solvable', () => {
  const { level } = DailyEchoManager.generateDailyLevel('2026-10-12');
  const solution = PuzzleSolver.solve(level, 20);
  assert.strictEqual(solution.solved, true);
  assert.ok(solution.minMoves > 0);
});

test('Daily share snippet matches required format', () => {
  const snippet = DailyEchoManager.formatShareSnippet(42, 18, 18, 3);
  assert.match(snippet, /AFTERECHO Daily #42/);
  assert.match(snippet, /Solved in 18 moves/);
  assert.match(snippet, /★★★/);
});
