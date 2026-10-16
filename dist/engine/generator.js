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
        const walls = [];
        for (let x = 0; x < width; x++) {
            walls.push({ x, y: 0 });
            walls.push({ x, y: height - 1 });
        }
        for (let y = 1; y < height - 1; y++) {
            walls.push({ x: 0, y });
            walls.push({ x: width - 1, y });
        }
        const playerStart = { x: 1, y: rng.range(1, height - 2) };
        const exitPos = { x: width - 2, y: rng.range(1, height - 2) };
        const occupied = new Set();
        walls.forEach((w) => occupied.add(`${w.x},${w.y}`));
        occupied.add(`${playerStart.x},${playerStart.y}`);
        occupied.add(`${exitPos.x},${exitPos.y}`);
        const switches = [];
        const doors = [];
        const blocks = [];
        const shards = [];
        // Include a sealed barrier wall with a door starting at floor 2
        const gateX = Math.max(3, width - 3);
        if (floor >= 2) {
            const doorY = rng.range(1, height - 2);
            for (let y = 1; y < height - 1; y++) {
                if (y !== doorY) {
                    walls.push({ x: gateX, y });
                    occupied.add(`${gateX},${y}`);
                }
            }
            occupied.add(`${gateX},${doorY}`);
            const swX = rng.range(1, gateX - 1);
            const swY = rng.range(1, height - 2);
            const swKey = `${swX},${swY}`;
            if (!occupied.has(swKey)) {
                occupied.add(swKey);
                const swType = floor >= 4 && rng.next() < 0.35 ? 'toggle' : 'pressure';
                switches.push({
                    id: `sw_end_${floor}`,
                    pos: { x: swX, y: swY },
                    type: swType,
                    channel: 'amber',
                });
                doors.push({
                    id: `dr_end_${floor}`,
                    pos: { x: gateX, y: doorY },
                    channel: 'amber',
                });
            }
        }
        // Interior obstacle pillars in the main chamber
        const numObstacles = rng.range(1, Math.min(3, 1 + Math.floor(floor / 4)));
        for (let i = 0; i < numObstacles; i++) {
            const ox = rng.range(2, Math.max(2, gateX - 1));
            const oy = rng.range(1, height - 2);
            const key = `${ox},${oy}`;
            if (!occupied.has(key)) {
                occupied.add(key);
                walls.push({ x: ox, y: oy });
            }
        }
        // Blocks starting at floor 5
        if (floor >= 5 && switches.length > 0 && switches[0].type === 'pressure' && rng.next() < 0.45) {
            const bx = rng.range(2, Math.max(2, gateX - 1));
            const by = rng.range(2, height - 3);
            const bKey = `${bx},${by}`;
            if (!occupied.has(bKey)) {
                occupied.add(bKey);
                blocks.push({ x: bx, y: by });
            }
        }
        // Shards starting at floor 1 (or additional shards on higher floors)
        const shardCount = floor === 1 ? 1 : floor >= 6 ? rng.range(1, 2) : rng.range(0, 1);
        for (let s = 0; s < shardCount; s++) {
            const sx = rng.range(1, Math.max(2, gateX - 1));
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
        walls.push({ x: 2, y: 2 });
        const level = {
            id: `endless_fallback_${floor}`,
            name: `Lab Sector ${floor}`,
            chapterTitle: 'Endless Lab',
            width,
            height,
            playerStart: { x: 1, y: 2 },
            exitPos: { x: width - 2, y: height - 2 },
            echoDelay,
            walls,
            shards: [{ x: 1, y: 1 }],
            parMoves: width + height - 2,
        };
        const solved = PuzzleSolver.solve(level, 20);
        const par = solved.solved ? solved.minMoves : width + height - 2;
        level.parMoves = par;
        return { level, optimalMoves: par };
    }
}
