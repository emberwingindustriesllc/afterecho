import { CampaignProgress, Settings, UserStats } from './types.js';
import { DEFAULT_SETTINGS } from './constants.js';

const STORAGE_KEYS = {
  CAMPAIGN: 'afterecho_campaign_v1',
  STATS: 'afterecho_stats_v1',
  SETTINGS: 'afterecho_settings_v1',
};

export class StorageManager {
  private static memoryStore = new Map<string, string>();
  private static isLocalStorageAvailable(): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }
      const testKey = '__ae_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  private static getItem(key: string): string | null {
    if (StorageManager.isLocalStorageAvailable()) {
      return window.localStorage.getItem(key);
    }
    return StorageManager.memoryStore.get(key) ?? null;
  }

  private static setItem(key: string, value: string): void {
    if (StorageManager.isLocalStorageAvailable()) {
      try {
        window.localStorage.setItem(key, value);
        return;
      } catch (err) {
        console.warn('LocalStorage write failed, falling back to memory', err);
      }
    }
    StorageManager.memoryStore.set(key, value);
  }

  // --- Campaign Progress ---

  public static getCampaignProgress(): CampaignProgress {
    try {
      const data = StorageManager.getItem(STORAGE_KEYS.CAMPAIGN);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to parse campaign progress', e);
    }
    return {
      unlockedLevel: 1,
      levelScores: {},
    };
  }

  public static saveLevelCompletion(
    levelIndex: number,
    levelId: string,
    moves: number,
    stars: number
  ): CampaignProgress {
    const progress = StorageManager.getCampaignProgress();
    const existing = progress.levelScores[levelId];

    if (!existing || stars > existing.stars || (stars === existing.stars && moves < existing.bestMoves)) {
      progress.levelScores[levelId] = {
        stars,
        bestMoves: existing ? Math.min(existing.bestMoves, moves) : moves,
        completedAt: new Date().toISOString(),
      };
    }

    // Unlock next level
    if (levelIndex + 1 > progress.unlockedLevel) {
      progress.unlockedLevel = levelIndex + 1;
    }

    StorageManager.setItem(STORAGE_KEYS.CAMPAIGN, JSON.stringify(progress));

    // Also update global stats
    const stats = StorageManager.getUserStats();
    stats.levelsCompleted = Object.keys(progress.levelScores).length;
    stats.totalStars = Object.values(progress.levelScores).reduce((acc, curr) => acc + curr.stars, 0);
    StorageManager.saveUserStats(stats);

    return progress;
  }

  // --- User Stats & Streaks ---

  public static getUserStats(): UserStats {
    try {
      const data = StorageManager.getItem(STORAGE_KEYS.STATS);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to parse stats', e);
    }
    return {
      gamesPlayed: 0,
      levelsCompleted: 0,
      totalStars: 0,
      dailyStreak: 0,
      dailyHistory: {},
      timeTrialBests: {},
      endlessHighScore: 0,
    };
  }

  public static saveUserStats(stats: UserStats): void {
    StorageManager.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
  }

  public static recordDailyCompletion(dateStr: string, moves: number, stars: number): UserStats {
    const stats = StorageManager.getUserStats();

    // Check streak
    const prevDate = stats.dailyLastPlayed;
    const today = new Date(dateStr);
    let newStreak = stats.dailyStreak;

    if (!prevDate) {
      newStreak = 1;
    } else {
      const last = new Date(prevDate);
      const diffDays = Math.round((today.getTime() - last.getTime()) / (1000 * 3600 * 24));
      if (diffDays === 1) {
        newStreak += 1;
      } else if (diffDays === 0) {
        // Same day, preserve streak
      } else {
        newStreak = 1;
      }
    }

    stats.dailyStreak = newStreak;
    stats.dailyLastPlayed = dateStr;
    stats.dailyHistory[dateStr] = {
      date: dateStr,
      completed: true,
      moves,
      stars,
      completedAt: new Date().toISOString(),
    };

    StorageManager.saveUserStats(stats);
    return stats;
  }

  public static recordTimeTrialBest(levelId: string, timeMs: number, moves: number): void {
    const stats = StorageManager.getUserStats();
    const current = stats.timeTrialBests[levelId];
    if (!current || timeMs < current.timeMs) {
      stats.timeTrialBests[levelId] = { timeMs, moves };
      StorageManager.saveUserStats(stats);
    }
  }

  public static recordEndlessScore(floor: number): void {
    const stats = StorageManager.getUserStats();
    if (floor > stats.endlessHighScore) {
      stats.endlessHighScore = floor;
      StorageManager.saveUserStats(stats);
    }
  }

  // --- Settings ---

  public static getSettings(): Settings {
    try {
      const data = StorageManager.getItem(STORAGE_KEYS.SETTINGS);
      if (data) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
      }
    } catch (e) {
      console.warn('Failed to parse settings', e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  public static saveSettings(settings: Settings): void {
    StorageManager.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }
}
