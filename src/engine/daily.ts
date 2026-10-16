import { LevelDef, Position } from './types.js';
import { PuzzleSolver } from './solver.js';
import { SeededRandom } from './generator.js';

export class DailyEchoManager {
  /**
   * Hashes a date string (e.g. "2026-10-12") into a 32-bit integer seed
   */
  public static hashDate(dateStr: string): number {
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
      hash = (hash << 5) - hash + dateStr.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  /**
   * Returns current local ISO date string (YYYY-MM-DD)
   */
  public static getTodayDateString(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Calculates the daily puzzle index (day count since epoch reference 2026-01-01)
   */
  public static getDailyIndex(dateStr: string): number {
    const epoch = new Date('2026-01-01').getTime();
    const current = new Date(dateStr).getTime();
    const diff = Math.max(1, Math.floor((current - epoch) / (1000 * 60 * 60 * 24)) + 1);
    return diff;
  }

  /**
   * Generates a deterministic daily puzzle verified to be solvable
   */
  public static generateDailyLevel(dateStr?: string): { level: LevelDef; puzzleNumber: number } {
    const targetDate = dateStr || DailyEchoManager.getTodayDateString();
    const puzzleNumber = DailyEchoManager.getDailyIndex(targetDate);
    const seed = DailyEchoManager.hashDate(targetDate);
    const rng = new SeededRandom(seed);

    const width = 7;
    const height = 6;
    const echoDelay = rng.choice([3, 4]);

    // Try multiple deterministic candidate layouts with a sealed gate chokepoint
    // so the player MUST use the switch & Echo to open the door.
    for (let attempt = 0; attempt < 60; attempt++) {
      const candidateRng = new SeededRandom(seed + attempt * 7919);

      const walls: Position[] = [];
      for (let x = 0; x < width; x++) {
        walls.push({ x, y: 0 });
        walls.push({ x, y: height - 1 });
      }
      for (let y = 1; y < height - 1; y++) {
        walls.push({ x: 0, y });
        walls.push({ x: width - 1, y });
      }

      // Dividing barrier wall at x = 4 with a single door opening at doorY
      const doorX = 4;
      const doorY = candidateRng.range(1, height - 2);
      for (let y = 1; y < height - 1; y++) {
        if (y !== doorY) {
          walls.push({ x: doorX, y });
        }
      }

      const playerStart: Position = { x: 1, y: candidateRng.range(1, height - 2) };
      const exitPos: Position = { x: 5, y: candidateRng.range(1, height - 2) };

      const occupied = new Set<string>();
      walls.forEach((w) => occupied.add(`${w.x},${w.y}`));
      occupied.add(`${playerStart.x},${playerStart.y}`);
      occupied.add(`${exitPos.x},${exitPos.y}`);
      occupied.add(`${doorX},${doorY}`);

      // Optional interior pillar in left chamber (x = 2 or 3)
      if (candidateRng.next() < 0.75) {
        const wx = candidateRng.range(2, 3);
        const wy = candidateRng.range(1, height - 2);
        const key = `${wx},${wy}`;
        if (!occupied.has(key)) {
          occupied.add(key);
          walls.push({ x: wx, y: wy });
        }
      }

      // Place pressure or toggle switch in left chamber
      const swX = candidateRng.range(1, 3);
      const swY = candidateRng.range(1, height - 2);
      const swKey = `${swX},${swY}`;
      if (occupied.has(swKey)) continue;
      occupied.add(swKey);

      const swType = candidateRng.choice(['pressure', 'pressure', 'toggle'] as const);
      const switches: LevelDef['switches'] = [
        {
          id: `daily_sw_${puzzleNumber}`,
          pos: { x: swX, y: swY },
          type: swType,
          channel: 'amber',
        },
      ];
      const doors: LevelDef['doors'] = [
        {
          id: `daily_dr_${puzzleNumber}`,
          pos: { x: doorX, y: doorY },
          channel: 'amber',
        },
      ];

      // Optional shard for extra routing depth
      const shards: Position[] = [];
      if (candidateRng.next() < 0.65) {
        const sx = candidateRng.range(1, 3);
        const sy = candidateRng.range(1, height - 2);
        const sKey = `${sx},${sy}`;
        if (!occupied.has(sKey)) {
          occupied.add(sKey);
          shards.push({ x: sx, y: sy });
        }
      }

      const level: LevelDef = {
        id: `daily_${targetDate}`,
        name: `Daily Echo #${puzzleNumber}`,
        chapterTitle: `Daily Puzzle • ${targetDate}`,
        width,
        height,
        playerStart,
        exitPos,
        echoDelay,
        walls,
        switches,
        doors,
        shards: shards.length > 0 ? shards : undefined,
        parMoves: 10,
        hint: `Daily #${puzzleNumber}: Coordinate with your ${echoDelay}-turn Echo to unlock the amber barrier.`,
        lore: 'A universal pulse connects all chrononauts today.',
      };

      const solution = PuzzleSolver.solve(level, 22, 15000);
      if (solution.solved && solution.minMoves >= 6 && solution.minMoves <= 16) {
        level.parMoves = solution.minMoves;
        return { level, puzzleNumber };
      }
    }

    // High quality deterministic fallback with sealed barrier wall at x = 4
    const fallbackLevel: LevelDef = {
      id: `daily_${targetDate}`,
      name: `Daily Echo #${puzzleNumber}`,
      chapterTitle: `Daily Puzzle • ${targetDate}`,
      width: 7,
      height: 6,
      playerStart: { x: 1, y: 3 },
      exitPos: { x: 5, y: 2 },
      echoDelay: 4,
      walls: [
        { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 },
        { x: 0, y: 1 }, { x: 4, y: 1 }, { x: 6, y: 1 },
        { x: 0, y: 2 }, { x: 2, y: 2 }, { x: 6, y: 2 },
        { x: 0, y: 3 }, { x: 4, y: 3 }, { x: 6, y: 3 },
        { x: 0, y: 4 }, { x: 4, y: 4 }, { x: 6, y: 4 },
        { x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 }, { x: 6, y: 5 },
      ],
      switches: [
        { id: `daily_sw_fb_${puzzleNumber}`, pos: { x: 1, y: 1 }, type: 'pressure', channel: 'amber' },
      ],
      doors: [
        { id: `daily_dr_fb_${puzzleNumber}`, pos: { x: 4, y: 2 }, channel: 'amber' },
      ],
      parMoves: 8,
      hint: `Daily #${puzzleNumber}: Step onto the amber plate and guide your Echo to release the door.`,
    };

    const fbSolution = PuzzleSolver.solve(fallbackLevel, 20);
    if (fbSolution.solved) {
      fallbackLevel.parMoves = fbSolution.minMoves;
    }

    return { level: fallbackLevel, puzzleNumber };
  }

  /**
   * Generates a clean shareable text snippet for social sharing (LinkedIn / Wordle style)
   */
  public static formatShareSnippet(
    puzzleNumber: number,
    moves: number,
    parMoves: number,
    stars: number,
    elapsedSec?: number,
    streak?: number
  ): string {
    const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    const timePart = elapsedSec !== undefined && elapsedSec > 0 ? ` ⏱ ${elapsedSec.toFixed(1)}s` : '';
    const streakPart = streak && streak > 1 ? ` • 🔥 ${streak}-day streak` : '';

    // Visual emoji timeline bar showing moves vs par
    const filled = Math.min(moves, 12);
    const bar = Array.from({ length: filled }, (_, i) => {
      if (i === filled - 1) return '🟩';
      if ((i + 1) % 4 === 0) return '🟪';
      return '🟦';
    }).join('');

    return `AFTERECHO Daily #${puzzleNumber}${streakPart}\nSolved in ${moves} moves (Par: ${parMoves})${timePart}\nRating: ${starStr}\n${bar}\nPlay: https://afterecho.vercel.app`;
  }
}

