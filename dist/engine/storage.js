import { DEFAULT_SETTINGS } from './constants.js';
const STORAGE_KEYS = {
    CAMPAIGN: 'afterecho_campaign_v1',
    STATS: 'afterecho_stats_v1',
    SETTINGS: 'afterecho_settings_v1',
};
export class StorageManager {
    static memoryStore = new Map();
    static isLocalStorageAvailable() {
        try {
            if (typeof window === 'undefined' || !window.localStorage) {
                return false;
            }
            const testKey = '__ae_test__';
            window.localStorage.setItem(testKey, '1');
            window.localStorage.removeItem(testKey);
            return true;
        }
        catch {
            return false;
        }
    }
    static getItem(key) {
        if (StorageManager.isLocalStorageAvailable()) {
            return window.localStorage.getItem(key);
        }
        return StorageManager.memoryStore.get(key) ?? null;
    }
    static setItem(key, value) {
        if (StorageManager.isLocalStorageAvailable()) {
            try {
                window.localStorage.setItem(key, value);
                return;
            }
            catch (err) {
                console.warn('LocalStorage write failed, falling back to memory', err);
            }
        }
        StorageManager.memoryStore.set(key, value);
    }
    // --- Campaign Progress ---
    static getCampaignProgress() {
        try {
            const data = StorageManager.getItem(STORAGE_KEYS.CAMPAIGN);
            if (data) {
                return JSON.parse(data);
            }
        }
        catch (e) {
            console.warn('Failed to parse campaign progress', e);
        }
        return {
            unlockedLevel: 1,
            levelScores: {},
        };
    }
    static saveLevelCompletion(levelIndex, levelId, moves, stars) {
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
    static getUserStats() {
        try {
            const data = StorageManager.getItem(STORAGE_KEYS.STATS);
            if (data) {
                return JSON.parse(data);
            }
        }
        catch (e) {
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
    static saveUserStats(stats) {
        StorageManager.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
    }
    static recordDailyCompletion(dateStr, moves, stars) {
        const stats = StorageManager.getUserStats();
        // Check streak
        const prevDate = stats.dailyLastPlayed;
        const today = new Date(dateStr);
        let newStreak = stats.dailyStreak;
        if (!prevDate) {
            newStreak = 1;
        }
        else {
            const last = new Date(prevDate);
            const diffDays = Math.round((today.getTime() - last.getTime()) / (1000 * 3600 * 24));
            if (diffDays === 1) {
                newStreak += 1;
            }
            else if (diffDays === 0) {
                // Same day, preserve streak
            }
            else {
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
    static recordTimeTrialBest(levelId, timeMs, moves) {
        const stats = StorageManager.getUserStats();
        const current = stats.timeTrialBests[levelId];
        if (!current || timeMs < current.timeMs) {
            stats.timeTrialBests[levelId] = { timeMs, moves };
            StorageManager.saveUserStats(stats);
        }
    }
    static recordEndlessScore(floor) {
        const stats = StorageManager.getUserStats();
        if (floor > stats.endlessHighScore) {
            stats.endlessHighScore = floor;
            StorageManager.saveUserStats(stats);
        }
    }
    // --- Settings ---
    static getSettings() {
        try {
            const data = StorageManager.getItem(STORAGE_KEYS.SETTINGS);
            if (data) {
                return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
            }
        }
        catch (e) {
            console.warn('Failed to parse settings', e);
        }
        return { ...DEFAULT_SETTINGS };
    }
    static saveSettings(settings) {
        StorageManager.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    }
}
