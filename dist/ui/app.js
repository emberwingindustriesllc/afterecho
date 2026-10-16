import { GameEngine } from '../engine/gameEngine.js';
import { CAMPAIGN_LEVELS } from '../engine/levels.js';
import { DailyEchoManager } from '../engine/daily.js';
import { LevelGenerator } from '../engine/generator.js';
import { PuzzleSolver } from '../engine/solver.js';
import { StorageManager } from '../engine/storage.js';
import { SoundSystem } from '../engine/audio.js';
import { GameRenderer } from './renderer.js';
import { InputManager } from './input.js';
export class AfterechoApp {
    // Game simulation
    currentMode = 'campaign';
    currentLevelIndex = 0;
    currentLevel;
    state;
    undoStack = [];
    // Endless & Timing
    endlessFloor = 1;
    levelStartTime = 0;
    lastSolveElapsedMs = 0;
    timeTrialElapsedMs = 0;
    timeTrialTimerId = null;
    // Components
    renderer;
    inputManager;
    // Persisted state
    campaignProgress;
    userStats;
    settings;
    // DOM Elements
    canvas;
    levelTitleEl;
    chapterTitleEl;
    movesEl;
    parEl;
    echoStatusEl;
    timelineEl;
    hintBarEl;
    hintTextEl;
    constructor() {
        this.initStorageAndAudio();
        this.bindDomElements();
        this.setupRendererAndInput();
        this.setupModalEvents();
        this.loadCampaignLevel(0);
    }
    initStorageAndAudio() {
        this.campaignProgress = StorageManager.getCampaignProgress();
        this.userStats = StorageManager.getUserStats();
        this.settings = StorageManager.getSettings();
        SoundSystem.init();
    }
    bindDomElements() {
        this.canvas = document.getElementById('game-canvas');
        this.levelTitleEl = document.getElementById('level-title');
        this.chapterTitleEl = document.getElementById('chapter-title');
        this.movesEl = document.getElementById('move-counter');
        this.parEl = document.getElementById('par-counter');
        this.echoStatusEl = document.getElementById('echo-status');
        this.timelineEl = document.getElementById('timeline-bar');
        this.hintBarEl = document.getElementById('hint-bar');
        this.hintTextEl = document.getElementById('hint-text');
        // Sync initial sound button icon
        const soundBtn = document.getElementById('btn-sound-toggle');
        if (soundBtn) {
            soundBtn.textContent = this.settings.soundEnabled ? '🔊' : '🔇';
        }
        // Top Bar Buttons
        document.getElementById('btn-streak')?.addEventListener('click', () => this.openStatsModal());
        document.getElementById('btn-levels')?.addEventListener('click', () => this.openLevelSelectModal());
        document.getElementById('btn-help')?.addEventListener('click', () => this.openHelpModal());
        document.getElementById('btn-stats')?.addEventListener('click', () => this.openStatsModal());
        document.getElementById('btn-settings')?.addEventListener('click', () => this.openSettingsModal());
        document.getElementById('btn-sound-toggle')?.addEventListener('click', () => this.toggleSound());
        // In-game Action Buttons
        document.getElementById('btn-undo')?.addEventListener('click', () => this.handleUndo());
        document.getElementById('btn-restart')?.addEventListener('click', () => this.handleRestart());
        document.getElementById('btn-wait')?.addEventListener('click', () => this.handleAction('WAIT'));
        document.getElementById('btn-hint')?.addEventListener('click', () => this.handleHint());
        // Mobile D-Pad Buttons
        document.getElementById('dpad-up')?.addEventListener('click', () => this.handleAction('UP'));
        document.getElementById('dpad-down')?.addEventListener('click', () => this.handleAction('DOWN'));
        document.getElementById('dpad-left')?.addEventListener('click', () => this.handleAction('LEFT'));
        document.getElementById('dpad-right')?.addEventListener('click', () => this.handleAction('RIGHT'));
        document.getElementById('dpad-wait')?.addEventListener('click', () => this.handleAction('WAIT'));
        // Settings Checkboxes (bound once)
        const sfxCheckbox = document.getElementById('setting-sfx');
        const motionCheckbox = document.getElementById('setting-motion');
        const contrastCheckbox = document.getElementById('setting-contrast');
        const trailCheckbox = document.getElementById('setting-trail');
        sfxCheckbox?.addEventListener('change', () => {
            this.settings.soundEnabled = sfxCheckbox.checked;
            SoundSystem.setEnabled(sfxCheckbox.checked);
            StorageManager.saveSettings(this.settings);
            if (soundBtn)
                soundBtn.textContent = sfxCheckbox.checked ? '🔊' : '🔇';
        });
        motionCheckbox?.addEventListener('change', () => {
            this.settings.reducedMotion = motionCheckbox.checked;
            this.renderer.reducedMotion = motionCheckbox.checked;
            StorageManager.saveSettings(this.settings);
        });
        contrastCheckbox?.addEventListener('change', () => {
            this.settings.highContrast = contrastCheckbox.checked;
            this.renderer.highContrast = contrastCheckbox.checked;
            StorageManager.saveSettings(this.settings);
        });
        trailCheckbox?.addEventListener('change', () => {
            this.settings.showTrail = trailCheckbox.checked;
            this.renderer.showTrail = trailCheckbox.checked;
            StorageManager.saveSettings(this.settings);
        });
        // Game Mode Tabs
        document.querySelectorAll('.mode-tab').forEach((tab) => {
            tab.addEventListener('click', (e) => {
                const target = e.currentTarget;
                const mode = target.dataset.mode;
                if (mode && mode !== this.currentMode) {
                    this.switchMode(mode);
                }
            });
        });
        // Resize listener
        window.addEventListener('resize', () => {
            this.renderer.updateDpi();
        });
    }
    setupRendererAndInput() {
        this.renderer = new GameRenderer(this.canvas);
        this.renderer.reducedMotion = this.settings.reducedMotion;
        this.renderer.showTrail = this.settings.showTrail;
        this.renderer.highContrast = this.settings.highContrast;
        this.renderer.startAnimationLoop(() => ({
            state: this.state,
            level: this.currentLevel,
        }));
        this.inputManager = new InputManager({
            onAction: (act) => this.handleAction(act),
            onUndo: () => this.handleUndo(),
            onRestart: () => this.handleRestart(),
            onWait: () => this.handleAction('WAIT'),
            onHint: () => this.handleHint(),
            onMuteToggle: () => this.toggleSound(),
            onCanvasClick: (cx, cy) => this.handleCanvasClick(cx, cy),
            onCanvasHover: (cx, cy) => this.handleCanvasHover(cx, cy),
        });
        this.inputManager.attach(this.canvas);
    }
    handleCanvasClick(clientX, clientY) {
        if (this.state.status !== 'playing')
            return;
        const tile = this.renderer.screenToTile(clientX, clientY);
        if (!tile)
            return;
        const dx = tile.x - this.state.playerPos.x;
        const dy = tile.y - this.state.playerPos.y;
        // Clicking own tile -> WAIT
        if (dx === 0 && dy === 0) {
            this.handleAction('WAIT');
            return;
        }
        // Clicking adjacent tile or along the same row/col -> step 1 tile in that direction
        if (Math.abs(dx) + Math.abs(dy) === 1 || dx === 0 || dy === 0) {
            if (Math.abs(dx) > Math.abs(dy)) {
                this.handleAction(dx > 0 ? 'RIGHT' : 'LEFT');
            }
            else {
                this.handleAction(dy > 0 ? 'DOWN' : 'UP');
            }
        }
    }
    handleCanvasHover(clientX, clientY) {
        if (clientX === null || clientY === null) {
            this.renderer.hoveredTile = null;
            return;
        }
        this.renderer.hoveredTile = this.renderer.screenToTile(clientX, clientY);
    }
    // --- Mode Switching ---
    switchMode(mode) {
        this.currentMode = mode;
        document.querySelectorAll('.mode-tab').forEach((tab) => {
            const t = tab;
            t.classList.toggle('active', t.dataset.mode === mode);
        });
        this.stopTimeTrialTimer();
        if (mode === 'campaign') {
            const unlocked = Math.min(this.campaignProgress.unlockedLevel - 1, CAMPAIGN_LEVELS.length - 1);
            this.loadCampaignLevel(Math.max(0, unlocked));
        }
        else if (mode === 'daily') {
            this.loadDailyEcho();
        }
        else if (mode === 'endless') {
            this.endlessFloor = 1;
            this.loadEndlessFloor(1);
        }
        else if (mode === 'timetrial') {
            this.loadTimeTrialLevel(3); // Start at Sector 4: Pressure Point
        }
    }
    // --- Level Loading ---
    loadCampaignLevel(index) {
        this.currentLevelIndex = index;
        const level = CAMPAIGN_LEVELS[index];
        this.startLevel(level);
    }
    loadDailyEcho() {
        const today = DailyEchoManager.getTodayDateString();
        const { level } = DailyEchoManager.generateDailyLevel(today);
        this.startLevel(level);
    }
    loadEndlessFloor(floor) {
        this.endlessFloor = floor;
        const { level } = LevelGenerator.generateEndlessLevel(floor);
        this.startLevel(level);
    }
    loadTimeTrialLevel(campaignIndex) {
        this.currentLevelIndex = campaignIndex % CAMPAIGN_LEVELS.length;
        const base = CAMPAIGN_LEVELS[this.currentLevelIndex];
        const best = this.userStats.timeTrialBests[base.id];
        const bestLabel = best ? ` • Best: ${(best.timeMs / 1000).toFixed(2)}s` : '';
        const level = {
            ...base,
            name: `Speedrun: ${base.name}`,
            chapterTitle: `Time Trial #${this.currentLevelIndex + 1}${bestLabel}`,
        };
        this.startLevel(level);
        this.startTimeTrialTimer();
    }
    startLevel(level) {
        this.currentLevel = level;
        this.state = GameEngine.createInitialState(level);
        this.undoStack = [];
        this.levelStartTime = performance.now();
        this.renderer.hintAction = null;
        this.resetHintBarStyle();
        // Increment games played
        this.userStats.gamesPlayed += 1;
        StorageManager.saveUserStats(this.userStats);
        this.updateUI();
    }
    // --- Time Trial Timer ---
    startTimeTrialTimer() {
        this.stopTimeTrialTimer();
        this.levelStartTime = performance.now();
        this.timeTrialElapsedMs = 0;
        this.timeTrialTimerId = window.setInterval(() => {
            this.timeTrialElapsedMs = performance.now() - this.levelStartTime;
            const timerEl = document.getElementById('timetrial-clock');
            if (timerEl) {
                timerEl.textContent = (this.timeTrialElapsedMs / 1000).toFixed(2) + 's';
            }
        }, 50);
    }
    stopTimeTrialTimer() {
        if (this.timeTrialTimerId !== null) {
            clearInterval(this.timeTrialTimerId);
            this.timeTrialTimerId = null;
        }
        const timerEl = document.getElementById('timetrial-clock');
        if (timerEl)
            timerEl.textContent = '';
    }
    // --- Gameplay Actions ---
    handleAction(action) {
        if (this.state.status !== 'playing') {
            return;
        }
        const check = GameEngine.isValidAction(this.state, action, this.currentLevel);
        if (!check.valid) {
            SoundSystem.playWait();
            return;
        }
        // Reset any active hint highlight
        this.resetHintBarStyle();
        // Push previous state to undo stack
        this.undoStack.push(GameEngine.cloneState(this.state));
        const prevPos = { ...this.state.playerPos };
        const prevEchoes = new Map();
        this.state.echoes.forEach((e) => {
            if (e.active)
                prevEchoes.set(e.id, { ...e.pos });
        });
        const { nextState, events } = GameEngine.applyAction(this.state, action, this.currentLevel);
        this.state = nextState;
        // Trigger visual transition for player and active echoes
        this.renderer.triggerMoveTransition(prevPos, this.state.playerPos, prevEchoes);
        // Audio and particle effects for events
        this.processGameEvents(events);
        // Update UI
        this.updateUI();
        // Check game outcome
        if (this.state.status === 'won') {
            this.handleWin();
        }
        else if (this.state.status === 'paradox') {
            this.handleParadox();
        }
    }
    handleUndo() {
        if (this.undoStack.length === 0)
            return;
        const previousState = this.undoStack.pop();
        this.state = previousState;
        SoundSystem.playUndo();
        this.resetHintBarStyle();
        this.renderer.triggerMoveTransition(this.state.playerPos, this.state.playerPos);
        this.updateUI();
        this.hideParadoxOverlay();
    }
    handleRestart() {
        this.startLevel(this.currentLevel);
        if (this.currentMode === 'timetrial') {
            this.startTimeTrialTimer();
        }
        SoundSystem.playUndo();
        this.hideParadoxOverlay();
    }
    handleHint() {
        if (this.state.status !== 'playing')
            return;
        const result = PuzzleSolver.solveFromState(this.state, this.currentLevel, 28, 45000);
        if (result.solved && result.solutionPath.length > 0) {
            const nextAction = result.solutionPath[0];
            this.renderer.hintAction = nextAction;
            SoundSystem.playShardCollect();
            const actionLabels = {
                UP: 'Move UP (▲)',
                DOWN: 'Move DOWN (▼)',
                LEFT: 'Move LEFT (◀)',
                RIGHT: 'Move RIGHT (▶)',
                WAIT: 'WAIT 1 Turn (⏸ / Space)',
            };
            this.hintBarEl.classList.remove('warning');
            this.hintBarEl.classList.add('highlight');
            this.hintTextEl.textContent = `💡 Hint: ${actionLabels[nextAction]} — ${result.minMoves} step${result.minMoves === 1 ? '' : 's'} from resolving timeline.`;
        }
        else {
            this.renderer.hintAction = null;
            SoundSystem.playParadox();
            this.hintBarEl.classList.remove('highlight');
            this.hintBarEl.classList.add('warning');
            this.hintTextEl.textContent =
                '⚠️ Current timeline leads to an unavoidable paradox! Press Undo (↩) or Reset (↻).';
        }
    }
    resetHintBarStyle() {
        if (this.hintBarEl) {
            this.hintBarEl.classList.remove('highlight', 'warning');
        }
    }
    processGameEvents(events) {
        for (const evt of events) {
            switch (evt.type) {
                case 'move':
                    SoundSystem.playMove();
                    break;
                case 'wait':
                    SoundSystem.playWait();
                    break;
                case 'echo_spawn':
                    SoundSystem.playEchoSpawn();
                    if (evt.pos)
                        this.renderer.spawnParticlesAt(evt.pos, '#b55fe6', 16);
                    break;
                case 'switch_toggle':
                    SoundSystem.playSwitch();
                    if (evt.pos)
                        this.renderer.spawnParticlesAt(evt.pos, '#ffaa00', 10);
                    break;
                case 'pressure_down':
                    SoundSystem.playPressureDown();
                    if (evt.pos)
                        this.renderer.spawnParticlesAt(evt.pos, '#ffaa00', 8);
                    break;
                case 'door_open':
                    SoundSystem.playDoorToggle(true);
                    if (evt.pos)
                        this.renderer.spawnParticlesAt(evt.pos, '#00d0ff', 12);
                    break;
                case 'door_close':
                    SoundSystem.playDoorToggle(false);
                    break;
                case 'shard_collect':
                    SoundSystem.playShardCollect();
                    if (evt.pos)
                        this.renderer.spawnParticlesAt(evt.pos, '#ffd000', 14);
                    break;
                case 'block_push':
                    SoundSystem.playBlockPush();
                    break;
                case 'hazard_death':
                case 'paradox':
                    SoundSystem.playParadox();
                    if (evt.pos)
                        this.renderer.spawnParticlesAt(evt.pos, '#ff3366', 20);
                    break;
                case 'win':
                    SoundSystem.playWin();
                    if (evt.pos)
                        this.renderer.spawnParticlesAt(evt.pos, '#00e599', 24);
                    break;
            }
        }
    }
    // --- Win & Paradox Handlers ---
    handleWin() {
        const moves = this.state.moveCount;
        const par = this.currentLevel.parMoves;
        const stars = GameEngine.calculateStars(moves, par);
        this.lastSolveElapsedMs = Math.max(100, performance.now() - this.levelStartTime);
        if (this.currentMode === 'campaign') {
            this.campaignProgress = StorageManager.saveLevelCompletion(this.currentLevelIndex + 1, this.currentLevel.id, moves, stars);
            this.userStats = StorageManager.getUserStats();
        }
        else if (this.currentMode === 'daily') {
            const today = DailyEchoManager.getTodayDateString();
            this.userStats = StorageManager.recordDailyCompletion(today, moves, stars);
        }
        else if (this.currentMode === 'endless') {
            StorageManager.recordEndlessScore(this.endlessFloor);
            this.userStats = StorageManager.getUserStats();
        }
        else if (this.currentMode === 'timetrial') {
            this.stopTimeTrialTimer();
            StorageManager.recordTimeTrialBest(this.currentLevel.id, this.lastSolveElapsedMs, moves);
            this.userStats = StorageManager.getUserStats();
        }
        this.updateUI();
        this.showWinModal(moves, par, stars, this.lastSolveElapsedMs);
    }
    handleParadox() {
        const reason = this.state.failReason || 'A temporal paradox was triggered.';
        this.showParadoxOverlay(reason);
    }
    // --- UI Update ---
    updateUI() {
        this.levelTitleEl.textContent = this.currentLevel.name;
        this.chapterTitleEl.textContent =
            this.currentLevel.chapterTitle ||
                (this.currentLevel.chapter ? `Chapter ${this.currentLevel.chapter}` : '');
        this.movesEl.textContent = String(this.state.moveCount);
        this.parEl.textContent = String(this.currentLevel.parMoves);
        if (!this.hintBarEl.classList.contains('highlight') && !this.hintBarEl.classList.contains('warning')) {
            this.hintTextEl.textContent = this.currentLevel.hint || '';
        }
        // Sync Header Streak & Daily Solved Checkmark
        const streakCountEl = document.getElementById('header-streak-count');
        if (streakCountEl) {
            streakCountEl.textContent = String(this.userStats.dailyStreak || 0);
        }
        const dailyTab = document.getElementById('tab-daily');
        if (dailyTab) {
            const today = DailyEchoManager.getTodayDateString();
            const solvedToday = !!this.userStats.dailyHistory?.[today]?.completed;
            dailyTab.textContent = solvedToday ? 'Daily Echo ✓' : 'Daily Echo';
        }
        // Echo Status Text
        const turnsUntilEcho = this.state.echoDelay - (this.state.turn % this.state.echoDelay);
        const activeEchoCount = this.state.echoes.filter((e) => e.active).length;
        if (activeEchoCount > 0) {
            this.echoStatusEl.innerHTML = `<span class="echo-active">✦ ${activeEchoCount} Echo${activeEchoCount > 1 ? 'es' : ''} active</span>`;
        }
        else {
            this.echoStatusEl.innerHTML = `<span class="echo-countdown">Echo in ${turnsUntilEcho} move${turnsUntilEcho === 1 ? '' : 's'}</span>`;
        }
        // Render Timeline Bar
        this.renderTimeline();
    }
    renderTimeline() {
        this.timelineEl.innerHTML = '';
        const totalSlots = Math.max(8, this.state.turn + 4);
        for (let t = 0; t <= totalSlots; t++) {
            const slot = document.createElement('div');
            slot.className = 'timeline-slot';
            if (t === this.state.turn) {
                slot.classList.add('current');
                slot.title = `Turn ${t} (Present)`;
            }
            else if (t < this.state.turn) {
                slot.classList.add('past');
            }
            else {
                slot.classList.add('future');
            }
            // Mark echo spawn points
            if (t > 0 && t % this.state.echoDelay === 0 && t <= this.state.echoDelay * this.state.maxEchoes) {
                slot.classList.add('echo-marker');
            }
            this.timelineEl.appendChild(slot);
        }
    }
    // --- Modals & Overlays ---
    setupModalEvents() {
        // Close modal buttons & backdrop click
        document.querySelectorAll('.modal-close').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const modal = e.currentTarget.closest('.modal');
                if (modal)
                    modal.classList.remove('active');
            });
        });
        document.querySelectorAll('.modal').forEach((modal) => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
        // Win Modal Actions
        document.getElementById('btn-next-level')?.addEventListener('click', () => {
            document.getElementById('win-modal')?.classList.remove('active');
            if (this.currentMode === 'campaign') {
                if (this.currentLevelIndex + 1 < CAMPAIGN_LEVELS.length) {
                    this.loadCampaignLevel(this.currentLevelIndex + 1);
                }
                else {
                    this.openLevelSelectModal();
                }
            }
            else if (this.currentMode === 'endless') {
                this.loadEndlessFloor(this.endlessFloor + 1);
            }
            else if (this.currentMode === 'timetrial') {
                this.loadTimeTrialLevel(this.currentLevelIndex + 1);
            }
            else {
                this.switchMode('endless');
            }
        });
        document.getElementById('btn-win-replay')?.addEventListener('click', () => {
            document.getElementById('win-modal')?.classList.remove('active');
            this.handleRestart();
        });
        document.getElementById('btn-share-result')?.addEventListener('click', () => {
            this.shareCurrentResult();
        });
        // Paradox Overlay Actions
        document.getElementById('btn-paradox-undo')?.addEventListener('click', () => {
            this.handleUndo();
        });
        document.getElementById('btn-paradox-restart')?.addEventListener('click', () => {
            this.handleRestart();
        });
    }
    buildShareText() {
        const moves = this.state.moveCount;
        const par = this.currentLevel.parMoves;
        const stars = GameEngine.calculateStars(moves, par);
        const elapsedSec = this.lastSolveElapsedMs / 1000;
        if (this.currentMode === 'daily') {
            const today = DailyEchoManager.getTodayDateString();
            const num = DailyEchoManager.getDailyIndex(today);
            return DailyEchoManager.formatShareSnippet(num, moves, par, stars, elapsedSec, this.userStats.dailyStreak);
        }
        const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
        const filled = Math.min(moves, 12);
        const bar = Array.from({ length: filled }, (_, i) => {
            if (i === filled - 1)
                return '🟩';
            if ((i + 1) % this.state.echoDelay === 0)
                return '🟪';
            return '🟦';
        }).join('');
        return `AFTERECHO — ${this.currentLevel.name}\nSolved in ${moves} moves (Par: ${par}) ⏱ ${elapsedSec.toFixed(1)}s\nRating: ${starStr}\n${bar}\nPlay: https://afterecho.vercel.app`;
    }
    showWinModal(moves, par, stars, elapsedMs) {
        const modal = document.getElementById('win-modal');
        const bannerEl = document.getElementById('win-banner-text');
        const starsEl = document.getElementById('win-stars');
        const movesEl = document.getElementById('win-moves');
        const parEl = document.getElementById('win-par');
        const timeEl = document.getElementById('win-time');
        const previewEl = document.getElementById('win-share-preview');
        const nextBtn = document.getElementById('btn-next-level');
        if (bannerEl) {
            bannerEl.textContent =
                moves <= par ? 'PERFECT TIMELINE RESOLVED' : 'TIMELINE RESOLVED';
        }
        starsEl.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
        movesEl.textContent = String(moves);
        parEl.textContent = String(par);
        if (timeEl) {
            timeEl.textContent = `${(elapsedMs / 1000).toFixed(1)}s`;
        }
        if (previewEl) {
            previewEl.textContent = this.buildShareText();
        }
        if (this.currentMode === 'campaign' && this.currentLevelIndex + 1 >= CAMPAIGN_LEVELS.length) {
            nextBtn.textContent = 'Campaign Complete! ✦';
        }
        else if (this.currentMode === 'endless') {
            nextBtn.textContent = `Next Sector (${this.endlessFloor + 1}) →`;
        }
        else if (this.currentMode === 'timetrial') {
            nextBtn.textContent = 'Next Benchmark →';
        }
        else if (this.currentMode === 'daily') {
            nextBtn.textContent = 'Play Endless Lab →';
        }
        else {
            nextBtn.textContent = 'Next Level →';
        }
        modal.classList.add('active');
    }
    showParadoxOverlay(reason) {
        const overlay = document.getElementById('paradox-overlay');
        const textEl = document.getElementById('paradox-reason');
        textEl.textContent = reason;
        overlay.classList.add('active');
    }
    hideParadoxOverlay() {
        const overlay = document.getElementById('paradox-overlay');
        if (overlay)
            overlay.classList.remove('active');
    }
    openLevelSelectModal() {
        const modal = document.getElementById('levels-modal');
        const grid = document.getElementById('levels-grid');
        grid.innerHTML = '';
        const unlocked = this.campaignProgress.unlockedLevel;
        CAMPAIGN_LEVELS.forEach((level, idx) => {
            const card = document.createElement('button');
            const isUnlocked = idx + 1 <= unlocked;
            card.className = `level-card ${isUnlocked ? 'unlocked' : 'locked'} ${idx === this.currentLevelIndex && this.currentMode === 'campaign' ? 'active' : ''}`;
            card.disabled = !isUnlocked;
            const score = this.campaignProgress.levelScores[level.id];
            const starText = score ? '★'.repeat(score.stars) + '☆'.repeat(3 - score.stars) : '☆☆☆';
            card.innerHTML = `
        <div class="level-num">${idx + 1}</div>
        <div class="level-card-name">${level.name}</div>
        <div class="level-card-stars">${isUnlocked ? starText : '🔒'}</div>
      `;
            if (isUnlocked) {
                card.addEventListener('click', () => {
                    modal.classList.remove('active');
                    this.currentMode = 'campaign';
                    document.querySelectorAll('.mode-tab').forEach((tab) => {
                        const t = tab;
                        t.classList.toggle('active', t.dataset.mode === 'campaign');
                    });
                    this.stopTimeTrialTimer();
                    this.loadCampaignLevel(idx);
                });
            }
            grid.appendChild(card);
        });
        modal.classList.add('active');
    }
    openHelpModal() {
        document.getElementById('help-modal')?.classList.add('active');
    }
    openStatsModal() {
        const modal = document.getElementById('stats-modal');
        const stats = StorageManager.getUserStats();
        document.getElementById('stat-played').textContent = String(stats.gamesPlayed);
        document.getElementById('stat-completed').textContent = `${stats.levelsCompleted} / ${CAMPAIGN_LEVELS.length}`;
        document.getElementById('stat-stars').textContent = `${stats.totalStars} / ${CAMPAIGN_LEVELS.length * 3}`;
        document.getElementById('stat-streak').textContent = `${stats.dailyStreak} day${stats.dailyStreak === 1 ? '' : 's'}`;
        document.getElementById('stat-endless').textContent = `Sector ${stats.endlessHighScore}`;
        modal.classList.add('active');
    }
    openSettingsModal() {
        const modal = document.getElementById('settings-modal');
        const sfxCheckbox = document.getElementById('setting-sfx');
        const motionCheckbox = document.getElementById('setting-motion');
        const contrastCheckbox = document.getElementById('setting-contrast');
        const trailCheckbox = document.getElementById('setting-trail');
        if (sfxCheckbox)
            sfxCheckbox.checked = this.settings.soundEnabled;
        if (motionCheckbox)
            motionCheckbox.checked = this.settings.reducedMotion;
        if (contrastCheckbox)
            contrastCheckbox.checked = this.settings.highContrast;
        if (trailCheckbox)
            trailCheckbox.checked = this.settings.showTrail;
        modal.classList.add('active');
    }
    toggleSound() {
        this.settings.soundEnabled = !this.settings.soundEnabled;
        SoundSystem.setEnabled(this.settings.soundEnabled);
        StorageManager.saveSettings(this.settings);
        const soundBtn = document.getElementById('btn-sound-toggle');
        if (soundBtn) {
            soundBtn.textContent = this.settings.soundEnabled ? '🔊' : '🔇';
        }
    }
    shareCurrentResult() {
        const text = this.buildShareText();
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                const shareBtn = document.getElementById('btn-share-result');
                if (shareBtn) {
                    const orig = shareBtn.textContent;
                    shareBtn.textContent = 'Copied to clipboard! ✓';
                    setTimeout(() => {
                        if (shareBtn)
                            shareBtn.textContent = orig;
                    }, 2000);
                }
            });
        }
    }
}
// Start application when DOM is loaded
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        new AfterechoApp();
    });
}
