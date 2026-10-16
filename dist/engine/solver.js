import { GameEngine } from './gameEngine.js';
const ACTIONS = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'WAIT'];
export class PuzzleSolver {
    /**
     * Generates a unique state key for deduplication during BFS
     */
    static getStateKey(state) {
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
        const hazardPhase = state.hazards.length > 0 ? String(state.turn % 12) : '';
        return `${state.playerPos.x},${state.playerPos.y}_${blocksStr}_${switchesStr}_${shardsStr}_${hazardPhase}_${histStr}`;
    }
    /**
     * Solves a puzzle level using BFS to find the optimal (shortest) solution from the start
     */
    static solve(level, maxDepth = 32, maxVisited = 60000) {
        const initialState = GameEngine.createInitialState(level);
        return PuzzleSolver.solveFromState(initialState, level, maxDepth, maxVisited);
    }
    /**
     * Solves a puzzle level from any live GameState (used for real-time Hints)
     */
    static solveFromState(startState, level, maxDepth = 28, maxVisited = 45000) {
        const initialState = GameEngine.cloneState(startState);
        if (initialState.status === 'won') {
            return { solved: true, minMoves: 0, solutionPath: [], visitedCount: 1 };
        }
        if (initialState.status !== 'playing') {
            return { solved: false, minMoves: -1, solutionPath: [], visitedCount: 0 };
        }
        const queue = [{ state: initialState, path: [] }];
        const visited = new Set();
        visited.add(PuzzleSolver.getStateKey(initialState));
        let visitedCount = 0;
        while (queue.length > 0) {
            const current = queue.shift();
            visitedCount++;
            if (current.path.length >= maxDepth) {
                continue;
            }
            if (visitedCount >= maxVisited) {
                break;
            }
            for (const action of ACTIONS) {
                if (action === 'WAIT' &&
                    current.path.length > 0 &&
                    current.path[current.path.length - 1] === 'WAIT' &&
                    current.state.echoes.length === 0 &&
                    current.state.hazards.length === 0) {
                    continue;
                }
                const validCheck = GameEngine.isValidAction(current.state, action, level);
                if (!validCheck.valid)
                    continue;
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
