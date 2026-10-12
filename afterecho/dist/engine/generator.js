import { PuzzleSolver } from './solver.js';
/**
 * Seeded PRNG (Mulberry32) for deterministic level generation
 */
export class SeededRandom {
    s;
    constructor(seed) {
        this.s = Math.floor(seed) >>> 0;
    }
    next() {
        let t = (this.s += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    range(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }
    choice(arr) {
        return arr[Math.floor(this.next() * arr.length)];
    }
    shuffle(arr) {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(this.next() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }
}
export class LevelGenerator {
    /**
     * Generates a procedural puzzle and verifies it is solvable
     */
    static generateEndlessLevel(floor, seed) {
        const actualSeed = seed ?? Math.floor(Date.now() + floor * 1000);
        const rng = new SeededRandom(actualSeed);
        const width = Math.min(8, 6 + Math.floor(floor / 5));
        const height = Math.min(7, 5 + Math.floor(floor / 6));
        const echoDelay = Math.max(3, 5 - Math.floor(floor / 8));
        const maxEchoes = floor >= 12 ? 2 : 1;
        // Try up to 30 candidates to find a verified solvable puzzle
        for (let attempt = 0; attempt < 30; attempt++) {
            const candidate = LevelGenerator.createCandidateLevel(`endless_${floor}_${attempt}`, `Lab Sector ${floor}`, 'Endless Lab', floor, width, height, echoDelay, maxEchoes, rng);
            const result = PuzzleSolver.solve(candidate, 24, 15000);
            if (result.solved && result.minMoves >= 4) {
                candidate.parMoves = result.minMoves;
                candidate.hint = `Endless Sector ${floor}: Par is ${result.minMoves} moves.`;
                return { level: candidate, optimalMoves: result.minMoves };
            }
        }
        // Safe fallback handcrafted backup for sector
        return LevelGenerator.createFallbackEndless(floor, width, height, echoDelay);
    }
    static createCandidateLevel(id, name, chapterTitle, floor, width, height, echoDelay, maxEchoes, rng) {
        // Generate perimeter walls
        const walls = [];
        for (let x = 0; x < width; x++) {
            walls.push({ x, y: 0 });
            walls.push({ x, y: height - 1 });
        }
        for (let y = 1; y < height - 1; y++) {
            walls.push({ x: 0, y });
            walls.push({ x: width - 1, y });
        }
        // Player and exit placements on opposite sides
        const playerStart = { x: 1, y: rng.range(1, height - 2) };
        const exitPos = { x: width - 2, y: rng.range(1, height - 2) };
        // Interior obstacles
        const numObstacles = rng.range(2, Math.min(6, 2 + Math.floor(floor / 3)));
        const occupied = new Set();
        occupied.add(`${playerStart.x},${playerStart.y}`);
        occupied.add(`${exitPos.x},${exitPos.y}`);
        for (let i = 0; i < numObstacles; i++) {
            const ox = rng.range(2, width - 3);
            const oy = rng.range(1, height - 2);
            const key = `${ox},${oy}`;
            if (!occupied.has(key)) {
                occupied.add(key);
                walls.push({ x: ox, y: oy });
            }
        }
        // Include switches and doors starting at floor 3
        const switches = [];
        const doors = [];
        const blocks = [];
        const shards = [];
        if (floor >= 3) {
            const switchX = rng.range(1, Math.floor(width / 2));
            const switchY = rng.range(1, height - 2);
            const doorX = rng.range(Math.floor(width / 2), width - 2);
            const doorY = exitPos.y;
            const swKey = `${switchX},${switchY}`;
            const drKey = `${doorX},${doorY}`;
            if (!occupied.has(swKey) && !occupied.has(drKey)) {
                occupied.add(swKey);
                occupied.add(drKey);
                switches.push({
                    id: `sw_end_${floor}`,
                    pos: { x: switchX, y: switchY },
                    type: 'pressure',
                    channel: 'amber',
                });
                doors.push({
                    id: `dr_end_${floor}`,
                    pos: { x: doorX, y: doorY },
                    channel: 'amber',
                });
            }
        }
        // Blocks starting at floor 6
        if (floor >= 6 && switches.length > 0) {
            const bx = rng.range(2, width - 3);
            const by = rng.range(1, height - 2);
            const bKey = `${bx},${by}`;
            if (!occupied.has(bKey)) {
                occupied.add(bKey);
                blocks.push({ x: bx, y: by });
            }
        }
        // Shards starting at floor 8
        if (floor >= 8) {
            const sx = rng.range(1, width - 2);
            const sy = rng.range(1, height - 2);
            const sKey = `${sx},${sy}`;
            if (!occupied.has(sKey)) {
                occupied.add(sKey);
                shards.push({ x: sx, y: sy });
            }
        }
        return {
            id,
            name,
            chapterTitle,
            width,
            height,
            playerStart,
            exitPos,
            echoDelay,
            maxEchoes,
            walls,
            switches,
            doors,
            blocks,
            shards,
            parMoves: 10,
        };
    }
    static createFallbackEndless(floor, width, height, echoDelay) {
        const walls = [];
        for (let x = 0; x < width; x++) {
            walls.push({ x, y: 0 });
            walls.push({ x, y: height - 1 });
        }
        for (let y = 1; y < height - 1; y++) {
            walls.push({ x: 0, y });
            walls.push({ x: width - 1, y });
        }
        // Simple pillar in center
        walls.push({ x: Math.floor(width / 2), y: Math.floor(height / 2) });
        const level = {
            id: `endless_fallback_${floor}`,
            name: `Lab Sector ${floor}`,
            chapterTitle: 'Endless Lab',
            width,
            height,
            playerStart: { x: 1, y: 1 },
            exitPos: { x: width - 2, y: height - 2 },
            echoDelay,
            walls,
            parMoves: width + height - 4,
        };
        const solved = PuzzleSolver.solve(level, 20);
        const par = solved.solved ? solved.minMoves : width + height - 4;
        level.parMoves = par;
        return { level, optimalMoves: par };
    }
}
