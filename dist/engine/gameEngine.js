import { ACTION_DELTAS } from './constants.js';
export function posEquals(a, b) {
    if (!a || !b)
        return false;
    return a.x === b.x && a.y === b.y;
}
export function isHazardActive(hazard, turn) {
    if (hazard.cycleInterval && hazard.activePhase !== undefined) {
        return (turn % hazard.cycleInterval) === hazard.activePhase;
    }
    return true; // Constant hazard
}
export class GameEngine {
    /**
     * Initializes a new GameState from a LevelDef
     */
    static createInitialState(level) {
        const totalShards = level.shards ? level.shards.length : 0;
        const switches = (level.switches || []).map((s) => ({
            ...s,
            active: false,
        }));
        const doors = (level.doors || []).map((d) => ({
            ...d,
            open: !!d.startsOpen,
        }));
        const blocks = (level.blocks || []).map((b, i) => ({
            id: `block_${i}`,
            pos: { ...b },
        }));
        const shards = (level.shards || []).map((s, i) => ({
            id: `shard_${i}`,
            pos: { ...s },
            collected: false,
        }));
        const hazards = (level.hazards || []).map((h) => ({ ...h }));
        const state = {
            width: level.width,
            height: level.height,
            playerPos: { ...level.playerStart },
            turn: 0,
            history: [{ ...level.playerStart }],
            actionHistory: [],
            echoDelay: Math.max(1, level.echoDelay),
            maxEchoes: level.maxEchoes || 1,
            echoes: [],
            switches,
            doors,
            blocks,
            shards,
            shardsCollected: 0,
            totalShards,
            hazards,
            status: 'playing',
            moveCount: 0,
        };
        // Evaluate switches for starting positions (e.g. block or player on switch)
        GameEngine.updateSwitchesAndDoors(state, level, []);
        return state;
    }
    /**
     * Clones a GameState deeply
     */
    static cloneState(state) {
        return {
            width: state.width,
            height: state.height,
            playerPos: { ...state.playerPos },
            turn: state.turn,
            history: state.history.map((p) => ({ ...p })),
            actionHistory: [...state.actionHistory],
            echoDelay: state.echoDelay,
            maxEchoes: state.maxEchoes,
            echoes: state.echoes.map((e) => ({ ...e, pos: { ...e.pos } })),
            switches: state.switches.map((s) => ({ ...s, pos: { ...s.pos } })),
            doors: state.doors.map((d) => ({ ...d, pos: { ...d.pos } })),
            blocks: state.blocks.map((b) => ({ ...b, pos: { ...b.pos } })),
            shards: state.shards.map((s) => ({ ...s, pos: { ...s.pos } })),
            shardsCollected: state.shardsCollected,
            totalShards: state.totalShards,
            hazards: state.hazards.map((h) => ({ ...h, pos: { ...h.pos } })),
            status: state.status,
            failReason: state.failReason,
            moveCount: state.moveCount,
        };
    }
    /**
     * Checks if an action is valid from the current state
     */
    static isValidAction(state, action, level) {
        if (state.status !== 'playing') {
            return { valid: false, reason: 'Game is not in playing state' };
        }
        if (action === 'WAIT') {
            return { valid: true };
        }
        const delta = ACTION_DELTAS[action];
        const targetX = state.playerPos.x + delta.x;
        const targetY = state.playerPos.y + delta.y;
        // Bounds check
        if (targetX < 0 || targetX >= state.width || targetY < 0 || targetY >= state.height) {
            return { valid: false, reason: 'Grid boundary' };
        }
        const targetPos = { x: targetX, y: targetY };
        // Wall check
        if (level.walls.some((w) => posEquals(w, targetPos))) {
            return { valid: false, reason: 'Wall obstacle' };
        }
        // Closed Door check
        const door = state.doors.find((d) => posEquals(d.pos, targetPos));
        if (door && !door.open) {
            return { valid: false, reason: 'Door is locked' };
        }
        // Pushable Block check
        const block = state.blocks.find((b) => posEquals(b.pos, targetPos));
        if (block) {
            const blockTargetX = block.pos.x + delta.x;
            const blockTargetY = block.pos.y + delta.y;
            const blockTargetPos = { x: blockTargetX, y: blockTargetY };
            // Block bounds check
            if (blockTargetX < 0 ||
                blockTargetX >= state.width ||
                blockTargetY < 0 ||
                blockTargetY >= state.height) {
                return { valid: false, reason: 'Cannot push block off grid' };
            }
            // Block wall check
            if (level.walls.some((w) => posEquals(w, blockTargetPos))) {
                return { valid: false, reason: 'Block blocked by wall' };
            }
            // Block door check
            const blockDoor = state.doors.find((d) => posEquals(d.pos, blockTargetPos));
            if (blockDoor && !blockDoor.open) {
                return { valid: false, reason: 'Block blocked by closed door' };
            }
            // Block another block check
            if (state.blocks.some((b) => b.id !== block.id && posEquals(b.pos, blockTargetPos))) {
                return { valid: false, reason: 'Cannot push into another block' };
            }
            // Block echo check (cannot push block directly onto an active echo)
            if (state.echoes.some((e) => e.active && posEquals(e.pos, blockTargetPos))) {
                return { valid: false, reason: 'Block blocked by temporal echo' };
            }
        }
        return { valid: true };
    }
    /**
     * Applies an action to advance simulation by one turn
     */
    static applyAction(currentState, action, level) {
        const check = GameEngine.isValidAction(currentState, action, level);
        if (!check.valid) {
            return { nextState: currentState, events: [] };
        }
        const state = GameEngine.cloneState(currentState);
        const events = [];
        const prevPlayerPos = { ...state.playerPos };
        const nextTurn = state.turn + 1;
        const delta = ACTION_DELTAS[action];
        let nextPlayerPos = {
            x: prevPlayerPos.x + delta.x,
            y: prevPlayerPos.y + delta.y,
        };
        // If pushing a block
        if (action !== 'WAIT') {
            const blockIndex = state.blocks.findIndex((b) => posEquals(b.pos, nextPlayerPos));
            if (blockIndex !== -1) {
                state.blocks[blockIndex].pos = {
                    x: state.blocks[blockIndex].pos.x + delta.x,
                    y: state.blocks[blockIndex].pos.y + delta.y,
                };
                events.push({
                    type: 'block_push',
                    pos: { ...state.blocks[blockIndex].pos },
                    detail: 'Block pushed',
                });
            }
        }
        if (action === 'WAIT') {
            events.push({ type: 'wait', pos: nextPlayerPos, detail: 'Turn waited' });
        }
        else {
            events.push({ type: 'move', pos: nextPlayerPos });
        }
        // Save previous echo positions before updating
        const prevEchoPositions = new Map();
        state.echoes.forEach((e) => {
            if (e.active) {
                prevEchoPositions.set(e.id, { ...e.pos });
            }
        });
        // Update player position and histories
        state.playerPos = nextPlayerPos;
        state.turn = nextTurn;
        state.moveCount += 1;
        state.history.push({ ...nextPlayerPos });
        state.actionHistory.push(action);
        // Calculate new echo entities
        const newEchoes = [];
        for (let i = 1; i <= state.maxEchoes; i++) {
            const echoDelay = i * state.echoDelay;
            if (nextTurn >= echoDelay) {
                const histIndex = nextTurn - echoDelay;
                const echoPos = { ...state.history[histIndex] };
                const isSpawning = nextTurn === echoDelay;
                newEchoes.push({
                    id: i,
                    pos: echoPos,
                    active: true,
                    spawnTurn: echoDelay,
                    color: i === 1 ? '#b55fe6' : '#d885ff',
                });
                if (isSpawning) {
                    events.push({
                        type: 'echo_spawn',
                        pos: echoPos,
                        detail: `Echo #${i} materialized`,
                    });
                }
                else {
                    events.push({
                        type: 'echo_move',
                        pos: echoPos,
                        detail: `Echo #${i} stepped`,
                    });
                }
            }
        }
        state.echoes = newEchoes;
        // Check Shards collection
        state.shards.forEach((shard) => {
            if (!shard.collected && posEquals(shard.pos, state.playerPos)) {
                shard.collected = true;
                state.shardsCollected += 1;
                events.push({
                    type: 'shard_collect',
                    pos: { ...shard.pos },
                    detail: `Collected shard ${state.shardsCollected}/${state.totalShards}`,
                });
            }
        });
        // Update switches and doors
        GameEngine.updateSwitchesAndDoors(state, level, events);
        // Collision and Temporal Paradox Checks:
        // 1. Direct collision: Player occupies same tile as any active Echo
        for (const echo of state.echoes) {
            if (echo.active && posEquals(echo.pos, state.playerPos)) {
                state.status = 'paradox';
                state.failReason = `Temporal Paradox: You collided with Echo #${echo.id}!`;
                events.push({
                    type: 'paradox',
                    pos: { ...state.playerPos },
                    detail: state.failReason,
                });
                return { nextState: state, events };
            }
        }
        // 2. Swap collision: Player and Echo crossed paths in opposite directions
        for (const echo of state.echoes) {
            if (echo.active) {
                const prevEchoPos = prevEchoPositions.get(echo.id);
                if (prevEchoPos &&
                    posEquals(prevPlayerPos, echo.pos) &&
                    posEquals(nextPlayerPos, prevEchoPos)) {
                    state.status = 'paradox';
                    state.failReason = `Temporal Paradox: Crossed paths directly with Echo #${echo.id}!`;
                    events.push({
                        type: 'paradox',
                        pos: { ...state.playerPos },
                        detail: state.failReason,
                    });
                    return { nextState: state, events };
                }
            }
        }
        // 3. Multi-Echo collisions: Echoes colliding with each other
        if (state.echoes.length > 1) {
            for (let a = 0; a < state.echoes.length; a++) {
                for (let b = a + 1; b < state.echoes.length; b++) {
                    if (posEquals(state.echoes[a].pos, state.echoes[b].pos)) {
                        state.status = 'paradox';
                        state.failReason = `Temporal Paradox: Echo #${state.echoes[a].id} collided with Echo #${state.echoes[b].id}!`;
                        events.push({
                            type: 'paradox',
                            pos: { ...state.echoes[a].pos },
                            detail: state.failReason,
                        });
                        return { nextState: state, events };
                    }
                }
            }
        }
        // 4. Echo obstructed by closed door or pushable block:
        // If the echo is currently standing on a closed door or block that wasn't moved
        for (const echo of state.echoes) {
            const closedDoor = state.doors.find((d) => !d.open && posEquals(d.pos, echo.pos));
            if (closedDoor) {
                state.status = 'paradox';
                state.failReason = `Temporal Paradox: Echo #${echo.id} blocked by a closed door!`;
                events.push({
                    type: 'paradox',
                    pos: { ...echo.pos },
                    detail: state.failReason,
                });
                return { nextState: state, events };
            }
            const blockOnEcho = state.blocks.find((b) => posEquals(b.pos, echo.pos));
            if (blockOnEcho) {
                state.status = 'paradox';
                state.failReason = `Temporal Paradox: Echo #${echo.id} crushed into a block!`;
                events.push({
                    type: 'paradox',
                    pos: { ...echo.pos },
                    detail: state.failReason,
                });
                return { nextState: state, events };
            }
        }
        // 5. Hazard collision: Active hazards damaging Player or Echoes
        for (const hazard of state.hazards) {
            if (isHazardActive(hazard, state.turn)) {
                if (posEquals(hazard.pos, state.playerPos)) {
                    state.status = 'paradox';
                    state.failReason = 'Disintegrated by an active hazard!';
                    events.push({
                        type: 'hazard_death',
                        pos: { ...hazard.pos },
                        detail: state.failReason,
                    });
                    return { nextState: state, events };
                }
                for (const echo of state.echoes) {
                    if (echo.active && posEquals(hazard.pos, echo.pos)) {
                        state.status = 'paradox';
                        state.failReason = `Temporal Paradox: Echo #${echo.id} walked into an active hazard!`;
                        events.push({
                            type: 'hazard_death',
                            pos: { ...hazard.pos },
                            detail: state.failReason,
                        });
                        return { nextState: state, events };
                    }
                }
            }
        }
        // 6. Win check: Player reaches exit with all shards
        if (posEquals(state.playerPos, level.exitPos)) {
            if (state.shardsCollected >= state.totalShards) {
                state.status = 'won';
                events.push({
                    type: 'win',
                    pos: { ...state.playerPos },
                    detail: `Level cleared in ${state.moveCount} moves!`,
                });
                return { nextState: state, events };
            }
        }
        return { nextState: state, events };
    }
    /**
     * Evaluates and updates states of switches and doors
     */
    static updateSwitchesAndDoors(state, level, events) {
        const occupiedPositions = [
            state.playerPos,
            ...state.echoes.filter((e) => e.active).map((e) => e.pos),
            ...state.blocks.map((b) => b.pos),
        ];
        for (const sw of state.switches) {
            const isOccupied = occupiedPositions.some((pos) => posEquals(pos, sw.pos));
            if (sw.type === 'pressure') {
                const wasActive = sw.active;
                sw.active = isOccupied;
                if (!wasActive && sw.active) {
                    events.push({
                        type: 'pressure_down',
                        pos: { ...sw.pos },
                        detail: `${sw.channel} pressure plate engaged`,
                    });
                }
                else if (wasActive && !sw.active) {
                    events.push({
                        type: 'pressure_up',
                        pos: { ...sw.pos },
                        detail: `${sw.channel} pressure plate released`,
                    });
                }
            }
            else if (sw.type === 'toggle') {
                // Toggle switches trigger when an entity enters them this turn
                const playerSteppedOn = posEquals(state.playerPos, sw.pos) &&
                    (state.history.length < 2 ||
                        !posEquals(state.history[state.history.length - 2], sw.pos));
                const echoSteppedOn = state.echoes.some((echo) => {
                    if (!echo.active)
                        return false;
                    const prevHistIdx = state.turn - 1 - echo.id * state.echoDelay;
                    const prevPos = prevHistIdx >= 0 ? state.history[prevHistIdx] : null;
                    return posEquals(echo.pos, sw.pos) && (!prevPos || !posEquals(prevPos, sw.pos));
                });
                if (playerSteppedOn || echoSteppedOn) {
                    sw.active = !sw.active;
                    events.push({
                        type: 'switch_toggle',
                        pos: { ...sw.pos },
                        detail: `${sw.channel} toggle switch flipped to ${sw.active ? 'ON' : 'OFF'}`,
                    });
                }
            }
        }
        // Now update doors based on switch states
        for (const door of state.doors) {
            const linkedSwitches = state.switches.filter((s) => s.channel === door.channel);
            const isChannelActive = linkedSwitches.some((s) => s.active);
            // If door starts open, active switch closes it; otherwise active switch opens it
            const shouldBeOpen = door.startsOpen ? !isChannelActive : isChannelActive;
            if (door.open !== shouldBeOpen) {
                door.open = shouldBeOpen;
                events.push({
                    type: shouldBeOpen ? 'door_open' : 'door_close',
                    pos: { ...door.pos },
                    detail: `${door.channel} door ${shouldBeOpen ? 'opened' : 'closed'}`,
                });
            }
        }
    }
    /**
     * Returns star rating for moves achieved vs par
     */
    static calculateStars(moves, parMoves) {
        if (moves <= parMoves)
            return 3;
        if (moves <= parMoves + 4)
            return 2;
        return 1;
    }
}
