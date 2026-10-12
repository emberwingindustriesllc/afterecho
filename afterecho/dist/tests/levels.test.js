import test from 'node:test';
import assert from 'node:assert';
import { CAMPAIGN_LEVELS } from '../engine/levels.js';
import { PuzzleSolver } from '../engine/solver.js';
test('All 15 campaign levels are solvable and par moves are verified', (t) => {
    assert.strictEqual(CAMPAIGN_LEVELS.length, 15, 'Campaign should have exactly 15 handcrafted levels');
    for (let i = 0; i < CAMPAIGN_LEVELS.length; i++) {
        const lvl = CAMPAIGN_LEVELS[i];
        // Basic structure validation
        assert.ok(lvl.width >= 5, `Level ${lvl.id} width must be >= 5`);
        assert.ok(lvl.height >= 5, `Level ${lvl.id} height must be >= 5`);
        assert.ok(lvl.echoDelay >= 2, `Level ${lvl.id} echoDelay must be >= 2`);
        // Solvability check using PuzzleSolver
        const result = PuzzleSolver.solve(lvl, 28, 20000);
        assert.strictEqual(result.solved, true, `Level ${lvl.id} (${lvl.name}) must be solvable! Result: ${JSON.stringify(result)}`);
        assert.ok(result.minMoves <= lvl.parMoves + 2, `Level ${lvl.id} minMoves (${result.minMoves}) should be within expected par range (${lvl.parMoves})`);
    }
});
