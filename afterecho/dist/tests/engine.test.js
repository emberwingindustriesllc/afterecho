import test from 'node:test';
import assert from 'node:assert';
import { GameEngine } from '../engine/gameEngine.js';
const testLevel = {
    id: 'test_1',
    name: 'Test Room',
    width: 5,
    height: 5,
    playerStart: { x: 1, y: 1 },
    exitPos: { x: 3, y: 1 },
    echoDelay: 2,
    walls: [
        { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 },
        { x: 0, y: 1 }, { x: 4, y: 1 },
        { x: 0, y: 2 }, { x: 4, y: 2 },
        { x: 0, y: 3 }, { x: 4, y: 3 },
        { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 },
    ],
    parMoves: 2,
};
test('GameEngine initializes correctly', () => {
    const state = GameEngine.createInitialState(testLevel);
    assert.strictEqual(state.turn, 0);
    assert.strictEqual(state.playerPos.x, 1);
    assert.strictEqual(state.playerPos.y, 1);
    assert.strictEqual(state.status, 'playing');
    assert.strictEqual(state.history.length, 1);
});
test('GameEngine handles player movement and wall collisions', () => {
    const state = GameEngine.createInitialState(testLevel);
    // Moving into wall (LEFT from 1,1 hits 0,1)
    const leftCheck = GameEngine.isValidAction(state, 'LEFT', testLevel);
    assert.strictEqual(leftCheck.valid, false);
    // Moving into open space (RIGHT from 1,1 goes to 2,1)
    const rightCheck = GameEngine.isValidAction(state, 'RIGHT', testLevel);
    assert.strictEqual(rightCheck.valid, true);
    const { nextState } = GameEngine.applyAction(state, 'RIGHT', testLevel);
    assert.strictEqual(nextState.playerPos.x, 2);
    assert.strictEqual(nextState.playerPos.y, 1);
    assert.strictEqual(nextState.turn, 1);
});
test('Echo spawns after echoDelay turns and follows history', () => {
    let state = GameEngine.createInitialState(testLevel); // echoDelay is 2
    // Turn 1: Move DOWN to (1, 2)
    state = GameEngine.applyAction(state, 'DOWN', testLevel).nextState;
    assert.strictEqual(state.turn, 1);
    assert.strictEqual(state.echoes.length, 0);
    // Turn 2: Move RIGHT to (2, 2). Echo should spawn at Turn 2 - 2 = Turn 0 pos (1, 1)!
    state = GameEngine.applyAction(state, 'RIGHT', testLevel).nextState;
    assert.strictEqual(state.turn, 2);
    assert.strictEqual(state.echoes.length, 1);
    assert.strictEqual(state.echoes[0].pos.x, 1);
    assert.strictEqual(state.echoes[0].pos.y, 1);
    // Turn 3: Move UP to (2, 1). Echo should follow to Turn 1 pos (1, 2)!
    state = GameEngine.applyAction(state, 'UP', testLevel).nextState;
    assert.strictEqual(state.turn, 3);
    assert.strictEqual(state.echoes[0].pos.x, 1);
    assert.strictEqual(state.echoes[0].pos.y, 2);
});
test('Detects Temporal Paradox on direct collision', () => {
    let state = GameEngine.createInitialState(testLevel); // echoDelay 2, start at (1,1)
    // Turn 1: Move DOWN to (1,2)
    state = GameEngine.applyAction(state, 'DOWN', testLevel).nextState;
    // Turn 2: Move UP back to (1,1). Echo spawns at (1,1)!
    state = GameEngine.applyAction(state, 'UP', testLevel).nextState;
    assert.strictEqual(state.status, 'paradox');
    assert.match(state.failReason || '', /collided/i);
});
test('Switches and doors operate with player and echo pressure', () => {
    const switchLevel = {
        id: 'switch_test',
        name: 'Switch Test',
        width: 6,
        height: 5,
        playerStart: { x: 1, y: 1 },
        exitPos: { x: 4, y: 1 },
        echoDelay: 2,
        walls: [],
        switches: [{ id: 'sw1', pos: { x: 1, y: 2 }, type: 'pressure', channel: 'amber' }],
        doors: [{ id: 'dr1', pos: { x: 3, y: 1 }, channel: 'amber' }],
        parMoves: 4,
    };
    let state = GameEngine.createInitialState(switchLevel);
    assert.strictEqual(state.doors[0].open, false);
    // Move DOWN onto pressure plate at (1,2)
    state = GameEngine.applyAction(state, 'DOWN', switchLevel).nextState;
    assert.strictEqual(state.switches[0].active, true);
    assert.strictEqual(state.doors[0].open, true);
    // Move RIGHT off pressure plate to (2,2)
    state = GameEngine.applyAction(state, 'RIGHT', switchLevel).nextState;
    // Plate is released by player, but echo spawns at (1,1)
    assert.strictEqual(state.switches[0].active, false);
    assert.strictEqual(state.doors[0].open, false);
    // Turn 3: Player moves to (3,2). Echo moves onto plate at (1,2)!
    state = GameEngine.applyAction(state, 'RIGHT', switchLevel).nextState;
    assert.strictEqual(state.switches[0].active, true, 'Echo holds down the plate');
    assert.strictEqual(state.doors[0].open, true, 'Door opens while echo is on plate');
});
test('Pushable blocks move and block path if obstructed', () => {
    const blockLevel = {
        id: 'block_test',
        name: 'Block Test',
        width: 5,
        height: 5,
        playerStart: { x: 1, y: 1 },
        exitPos: { x: 4, y: 4 },
        echoDelay: 4,
        walls: [{ x: 3, y: 1 }], // Wall at (3,1)
        blocks: [{ x: 2, y: 1 }], // Block at (2,1)
        parMoves: 5,
    };
    const state = GameEngine.createInitialState(blockLevel);
    // Moving RIGHT pushes block into (3,1) which has a wall: should be invalid!
    const pushCheck = GameEngine.isValidAction(state, 'RIGHT', blockLevel);
    assert.strictEqual(pushCheck.valid, false);
    // Moving DOWN is free
    const downCheck = GameEngine.isValidAction(state, 'DOWN', blockLevel);
    assert.strictEqual(downCheck.valid, true);
});
test('Undo and clone maintain state integrity', () => {
    let state = GameEngine.createInitialState(testLevel);
    const initialCopy = GameEngine.cloneState(state);
    const { nextState } = GameEngine.applyAction(state, 'DOWN', testLevel);
    assert.strictEqual(nextState.turn, 1);
    assert.strictEqual(nextState.playerPos.y, 2);
    // Verify initialCopy was not mutated
    assert.strictEqual(initialCopy.turn, 0);
    assert.strictEqual(initialCopy.playerPos.y, 1);
});
