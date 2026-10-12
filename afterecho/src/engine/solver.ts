import { Action, LevelDef, GameState } from './types.js';
import { GameEngine } from './gameEngine.js';

export interface SolverResult {
  solved: boolean;
  minMoves: number;
  solutionPath: Action[];
  visitedCount: number;
}

const ACTIONS: Action[] = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'WAIT'];

export class PuzzleSolver {
  /**
   * Generates a unique state key for deduplication during BFS
   */
  private static getStateKey(state: GameState): string {
    // Only the last (echoDelay * maxEchoes) positions of history matter for future echoes
    const neededHistoryLen = state.echoDelay * state.maxEchoes;
    const historySlice = state.history.slice(Math.max(0, state.history.length - neededHistoryLen));
    const histStr = historySlice.map((p) => `${p.x},${p.y}`).join(';');

    const blocksStr = state.blocks
      .map((b) => `${b.pos.x},${b.pos.y}`)
      .sort()
      .join('|');

    const switchesStr = state.switches.map((s) => (s.active ? '1' : '0')).join('');
    const shardsStr = state.shards.map((s) => (s.collected ? '1' : '0')).join('');

    return `${state.playerPos.x},${state.playerPos.y}_${blocksStr}_${switchesStr}_${shardsStr}_${histStr}`;
  }

  /**
   * Solves a puzzle level using BFS to find the optimal (shortest) solution
   * @param level Level definition
   * @param maxDepth Maximum search depth (default 32)
   * @param maxVisited Maximum states to visit before aborting (default 25000)
   */
  public static solve(
    level: LevelDef,
    maxDepth: number = 32,
    maxVisited: number = 60000
  ): SolverResult {
    const initialState = GameEngine.createInitialState(level);

    if (initialState.status === 'won') {
      return { solved: true, minMoves: 0, solutionPath: [], visitedCount: 1 };
    }

    interface QueueNode {
      state: GameState;
      path: Action[];
    }

    const queue: QueueNode[] = [{ state: initialState, path: [] }];
    const visited = new Set<string>();
    visited.add(PuzzleSolver.getStateKey(initialState));

    let visitedCount = 0;

    while (queue.length > 0) {
      const current = queue.shift()!;
      visitedCount++;

      if (current.path.length >= maxDepth) {
        continue;
      }
      if (visitedCount >= maxVisited) {
        break;
      }

      for (const action of ACTIONS) {
        // Pruning: Avoid consecutive WAITs if they don't change anything
        if (
          action === 'WAIT' &&
          current.path.length > 0 &&
          current.path[current.path.length - 1] === 'WAIT' &&
          current.state.echoes.length === 0
        ) {
          continue; // Waiting with no echoes or active elements does nothing
        }

        const validCheck = GameEngine.isValidAction(current.state, action, level);
        if (!validCheck.valid) continue;

        const { nextState } = GameEngine.applyAction(current.state, action, level);

        if (nextState.status === 'won') {
          return {
            solved: true,
            minMoves: current.path.length + 1,
            solutionPath: [...current.path, action],
            visitedCount,
          };
        }

        if (nextState.status === 'playing') {
          const key = PuzzleSolver.getStateKey(nextState);
          if (!visited.has(key)) {
            visited.add(key);
            queue.push({
              state: nextState,
              path: [...current.path, action],
            });
          }
        }
      }
    }

    return {
      solved: false,
      minMoves: -1,
      solutionPath: [],
      visitedCount,
    };
  }
}
