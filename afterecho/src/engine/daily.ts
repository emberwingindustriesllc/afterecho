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
    const echoDelay = rng.choice([3, 4, 5]);

    // Try multiple deterministic candidate layouts until a verified solvable one is found
    for (let attempt = 0; attempt < 50; attempt++) {
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

      const playerStart: Position = { x: 1, y: candidateRng.range(1, height - 2) };
      const exitPos: Position = { x: width - 2, y: candidateRng.range(1, height - 2) };

      const occupied = new Set<string>();
      occupied.add(`${playerStart.x},${playerStart.y}`);
      occupied.add(`${exitPos.x},${exitPos.y}`);

      // Add 2 to 4 interior wall pillars
      const numWalls = candidateRng.range(2, 4);
      for (let i = 0; i < numWalls; i++) {
        const wx = candidateRng.range(2, width - 3);
        const wy = candidateRng.range(1, height - 2);
        const key = `${wx},${wy}`;
        if (!occupied.has(key)) {
          occupied.add(key);
          walls.push({ x: wx, y: wy });
        }
      }

      // Add a pressure switch and door
      const swX = candidateRng.range(1, 3);
      const swY = candidateRng.range(1, height - 2);
      const drX = candidateRng.range(4, width - 2);
      const drY = candidateRng.range(1, height - 2);

      const swKey = `${swX},${swY}`;
      const drKey = `${drX},${drY}`;

      let switches: LevelDef['switches'] = undefined;
      let doors: LevelDef['doors'] = undefined;

      if (!occupied.has(swKey) && !occupied.has(drKey)) {
        occupied.add(swKey);
        occupied.add(drKey);
        switches = [
          {
            id: `daily_sw_${puzzleNumber}`,
            pos: { x: swX, y: swY },
            type: 'pressure',
            channel: 'amber',
          },
        ];
        doors = [
          {
            id: `daily_dr_${puzzleNumber}`,
            pos: { x: drX, y: drY },
            channel: 'amber',
          },
        ];
      }

      const level: LevelDef = {
        id: `daily_${targetDate}`,
        name: `Daily Echo #${puzzleNumber}`,
        chapterTitle: `Synchronized Chrono (${targetDate})`,
        width,
        height,
        playerStart,
        exitPos,
        echoDelay,
        walls,
        switches,
        doors,
        parMoves: 10,
        hint: `Daily #${puzzleNumber}: Plan your steps so your past self opens your future path.`,
        lore: 'A universal pulse connects all chrononauts today.',
      };

      const solution = PuzzleSolver.solve(level, 24, 15000);
      if (solution.solved && solution.minMoves >= 6) {
        level.parMoves = solution.minMoves;
        return { level, puzzleNumber };
      }
    }

    // High quality deterministic fallback if no random candidate verified within 50 attempts
    const fallbackLevel: LevelDef = {
      id: `daily_${targetDate}`,
      name: `Daily Echo #${puzzleNumber}`,
      chapterTitle: `Synchronized Chrono (${targetDate})`,
      width: 7,
      height: 6,
      playerStart: { x: 1, y: 3 },
      exitPos: { x: 5, y: 1 },
      echoDelay,
      walls: [
        { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 },
        { x: 0, y: 1 }, { x: 3, y: 1 }, { x: 6, y: 1 },
        { x: 0, y: 2 }, { x: 3, y: 2 }, { x: 6, y: 2 },
        { x: 0, y: 3 }, { x: 6, y: 3 },
        { x: 0, y: 4 }, { x: 3, y: 4 }, { x: 6, y: 4 },
        { x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 }, { x: 6, y: 5 },
      ],
      switches: [
        { id: `daily_sw_fb_${puzzleNumber}`, pos: { x: 1, y: 1 }, type: 'pressure', channel: 'amber' },
      ],
      doors: [
        { id: `daily_dr_fb_${puzzleNumber}`, pos: { x: 4, y: 1 }, channel: 'amber' },
      ],
      parMoves: 9,
      hint: `Daily #${puzzleNumber}: Step onto the amber plate and guide your echo to release the door.`,
    };

    const fbSolution = PuzzleSolver.solve(fallbackLevel, 20);
    if (fbSolution.solved) {
      fallbackLevel.parMoves = fbSolution.minMoves;
    }

    return { level: fallbackLevel, puzzleNumber };
  }

  /**
   * Generates a clean shareable text snippet for social sharing
   */
  public static formatShareSnippet(
    puzzleNumber: number,
    moves: number,
    parMoves: number,
    stars: number
  ): string {
    const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    return `AFTERECHO Daily #${puzzleNumber}\nSolved in ${moves} moves (Par: ${parMoves})\nRating: ${starStr}\nPlay: https://afterecho.vercel.app`;
  }
}
