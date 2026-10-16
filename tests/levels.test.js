import test from 'node:test';
import assert from 'node:assert';
import { CAMPAIGN_LEVELS } from '../dist/engine/levels.js';
import { PuzzleSolver } from '../dist/engine/solver.js';

test('All 15 campaign levels are solvable and par moves are verified', () => {
  assert.strictEqual(CAMPAIGN_LEVELS.length, 15, 'Campaign should have exactly 15 handcrafted levels');

  for (let i = 0; i < CAMPAIGN_LEVELS.length; i++) {
    const lvl = CAMPAIGN_LEVELS[i];

    assert.ok(lvl.width >= 5, `Level ${lvl.id} width must be >= 5`);
    assert.ok(lvl.height >= 5, `Level ${lvl.id} height must be >= 5`);
    assert.ok(lvl.echoDelay >= 2, `Level ${lvl.id} echoDelay must be >= 2`);

    const result = PuzzleSolver.solve(lvl, 32, 60000);
    assert.strictEqual(
      result.solved,
      true,
      `Level ${lvl.id} (${lvl.name}) must be solvable! Result: ${JSON.stringify(result)}`
    );
    assert.strictEqual(
      result.minMoves,
      lvl.parMoves,
      `Level ${lvl.id} (${lvl.name}) parMoves (${lvl.parMoves}) must match exact optimal minMoves (${result.minMoves})`
    );
  }
});

