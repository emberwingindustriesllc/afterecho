import {
  Action,
  CampaignProgress,
  GameState,
  LevelDef,
  Position,
  Settings,
  UserStats,
} from '../engine/types.js';
import { GameEngine, GameEvent } from '../engine/gameEngine.js';
import { CAMPAIGN_LEVELS } from '../engine/levels.js';
import { DailyEchoManager } from '../engine/daily.js';
import { LevelGenerator } from '../engine/generator.js';
import { StorageManager } from '../engine/storage.js';
import { SoundSystem } from '../engine/audio.js';
import { GameRenderer } from './renderer.js';
import { InputManager } from './input.js';

export type GameMode = 'campaign' | 'daily' | 'endless' | 'timetrial';

export class AfterechoApp {
  // Game simulation
  private currentMode: GameMode = 'campaign';
  private currentLevelIndex: number = 0;
  private currentLevel!: LevelDef;
  private state!: GameState;
  private undoStack: GameState[] = [];

  // Endless & Time Trial
  private endlessFloor: number = 1;
  private timeTrialStartTime: number = 0;
  private timeTrialElapsedMs: number = 0;
  private timeTrialTimerId: number | null = null;

  // Components
  private renderer!: GameRenderer;
  private inputManager!: InputManager;

  // Persisted state
  private campaignProgress!: CampaignProgress;
  private userStats!: UserStats;
  private settings!: Settings;

  // DOM Elements
  private canvas!: HTMLCanvasElement;
  private levelTitleEl!: HTMLElement;
  private chapterTitleEl!: HTMLElement;
  private movesEl!: HTMLElement;
  private parEl!: HTMLElement;
  private echoStatusEl!: HTMLElement;
  private timelineEl!: HTMLElement;
  private hintTextEl!: HTMLElement;

  constructor() {
    this.initStorageAndAudio();
    this.bindDomElements();
    this.setupRendererAndInput();
    this.setupModalEvents();
    this.loadCampaignLevel(0);
  }

  private initStorageAndAudio(): void {
    this.campaignProgress = StorageManager.getCampaignProgress();
    this.userStats = StorageManager.getUserStats();
    this.settings = StorageManager.getSettings();
    SoundSystem.init();
  }

  private bindDomElements(): void {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.levelTitleEl = document.getElementById('level-title')!;
    this.chapterTitleEl = document.getElementById('chapter-title')!;
    this.movesEl = document.getElementById('move-counter')!;
    this.parEl = document.getElementById('par-counter')!;
    this.echoStatusEl = document.getElementById('echo-status')!;
    this.timelineEl = document.getElementById('timeline-bar')!;
    this.hintTextEl = document.getElementById('hint-text')!;

    // Top Bar Buttons
    document.getElementById('btn-levels')?.addEventListener('click', () => this.openLevelSelectModal());
    document.getElementById('btn-help')?.addEventListener('click', () => this.openHelpModal());
    document.getElementById('btn-stats')?.addEventListener('click', () => this.openStatsModal());
    document.getElementById('btn-settings')?.addEventListener('click', () => this.openSettingsModal());
    document.getElementById('btn-sound-toggle')?.addEventListener('click', () => this.toggleSound());

    // In-game Action Buttons
    document.getElementById('btn-undo')?.addEventListener('click', () => this.handleUndo());
    document.getElementById('btn-restart')?.addEventListener('click', () => this.handleRestart());
    document.getElementById('btn-wait')?.addEventListener('click', () => this.handleAction('WAIT'));

    // Mobile D-Pad Buttons
    document.getElementById('dpad-up')?.addEventListener('click', () => this.handleAction('UP'));
    document.getElementById('dpad-down')?.addEventListener('click', () => this.handleAction('DOWN'));
    document.getElementById('dpad-left')?.addEventListener('click', () => this.handleAction('LEFT'));
    document.getElementById('dpad-right')?.addEventListener('click', () => this.handleAction('RIGHT'));
    document.getElementById('dpad-wait')?.addEventListener('click', () => this.handleAction('WAIT'));

    // Game Mode Tabs
    document.querySelectorAll('.mode-tab').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const mode = target.dataset.mode as GameMode;
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

  private setupRendererAndInput(): void {
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
      onMuteToggle: () => this.toggleSound(),
    });

    this.inputManager.attach(this.canvas);
  }

  // --- Mode Switching ---

  public switchMode(mode: GameMode): void {
    this.currentMode = mode;

    document.querySelectorAll('.mode-tab').forEach((tab) => {
      const t = tab as HTMLElement;
      t.classList.toggle('active', t.dataset.mode === mode);
    });

    this.stopTimeTrialTimer();

    if (mode === 'campaign') {
      const unlocked = Math.min(this.campaignProgress.unlockedLevel - 1, CAMPAIGN_LEVELS.length - 1);
      this.loadCampaignLevel(Math.max(0, unlocked));
    } else if (mode === 'daily') {
      this.loadDailyEcho();
    } else if (mode === 'endless') {
      this.endlessFloor = 1;
      this.loadEndlessFloor(1);
    } else if (mode === 'timetrial') {
      this.loadTimeTrialLevel(3); // Benchmark level 4: Pressure Point
    }
  }

  // --- Level Loading ---

  public loadCampaignLevel(index: number): void {
    this.currentLevelIndex = index;
    const level = CAMPAIGN_LEVELS[index];
    this.startLevel(level);
  }

  public loadDailyEcho(): void {
    const today = DailyEchoManager.getTodayDateString();
    const { level } = DailyEchoManager.generateDailyLevel(today);
    this.startLevel(level);
  }

  public loadEndlessFloor(floor: number): void {
    this.endlessFloor = floor;
    const { level } = LevelGenerator.generateEndlessLevel(floor);
    this.startLevel(level);
  }

  public loadTimeTrialLevel(campaignIndex: number): void {
    this.currentLevelIndex = campaignIndex;
    const base = CAMPAIGN_LEVELS[campaignIndex];
    const level: LevelDef = {
      ...base,
      name: `Time Trial: ${base.name}`,
      chapterTitle: 'Speedrun Benchmark',
    };
    this.startLevel(level);
    this.startTimeTrialTimer();
  }

  private startLevel(level: LevelDef): void {
    this.currentLevel = level;
    this.state = GameEngine.createInitialState(level);
    this.undoStack = [];

    // Increment games played
    this.userStats.gamesPlayed += 1;
    StorageManager.saveUserStats(this.userStats);

    this.updateUI();
  }

  // --- Time Trial Timer ---

  private startTimeTrialTimer(): void {
    this.stopTimeTrialTimer();
    this.timeTrialStartTime = performance.now();
    this.timeTrialElapsedMs = 0;
    this.timeTrialTimerId = window.setInterval(() => {
      this.timeTrialElapsedMs = performance.now() - this.timeTrialStartTime;
      const timerEl = document.getElementById('timetrial-clock');
      if (timerEl) {
        timerEl.textContent = (this.timeTrialElapsedMs / 1000).toFixed(2) + 's';
      }
    }, 50);
  }

  private stopTimeTrialTimer(): void {
    if (this.timeTrialTimerId !== null) {
      clearInterval(this.timeTrialTimerId);
      this.timeTrialTimerId = null;
    }
    const timerEl = document.getElementById('timetrial-clock');
    if (timerEl) timerEl.textContent = '';
  }

  // --- Gameplay Actions ---

  public handleAction(action: Action): void {
    if (this.state.status !== 'playing') {
      return;
    }

    const check = GameEngine.isValidAction(this.state, action, this.currentLevel);
    if (!check.valid) {
      // Invalid move (bump wall or closed door)
      SoundSystem.playWait();
      return;
    }

    // Push previous state to undo stack
    this.undoStack.push(GameEngine.cloneState(this.state));

    const prevPos = { ...this.state.playerPos };
    const { nextState, events } = GameEngine.applyAction(this.state, action, this.currentLevel);
    this.state = nextState;

    // Trigger visual transition
    this.renderer.triggerMoveTransition(prevPos, this.state.playerPos);

    // Audio and particle effects for events
    this.processGameEvents(events);

    // Update UI
    this.updateUI();

    // Check game outcome
    if (this.state.status === 'won') {
      this.handleWin();
    } else if (this.state.status === 'paradox') {
      this.handleParadox();
    }
  }

  public handleUndo(): void {
    if (this.undoStack.length === 0) return;

    const previousState = this.undoStack.pop()!;
    this.state = previousState;

    SoundSystem.playUndo();
    this.renderer.triggerMoveTransition(this.state.playerPos, this.state.playerPos);
    this.updateUI();

    // Hide any paradox modal if showing
    this.hideParadoxOverlay();
  }

  public handleRestart(): void {
    this.startLevel(this.currentLevel);
    SoundSystem.playUndo();
    this.hideParadoxOverlay();
  }

  private processGameEvents(events: GameEvent[]): void {
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
          if (evt.pos) this.renderer.spawnParticlesAt(evt.pos, '#b55fe6', 16);
          break;
        case 'switch_toggle':
          SoundSystem.playSwitch();
          if (evt.pos) this.renderer.spawnParticlesAt(evt.pos, '#ffaa00', 10);
          break;
        case 'pressure_down':
          SoundSystem.playPressureDown();
          if (evt.pos) this.renderer.spawnParticlesAt(evt.pos, '#ffaa00', 8);
          break;
        case 'door_open':
          SoundSystem.playDoorToggle(true);
          if (evt.pos) this.renderer.spawnParticlesAt(evt.pos, '#00d0ff', 12);
          break;
        case 'door_close':
          SoundSystem.playDoorToggle(false);
          break;
        case 'shard_collect':
          SoundSystem.playShardCollect();
          if (evt.pos) this.renderer.spawnParticlesAt(evt.pos, '#ffd000', 14);
          break;
        case 'block_push':
          SoundSystem.playBlockPush();
          break;
        case 'hazard_death':
        case 'paradox':
          SoundSystem.playParadox();
          if (evt.pos) this.renderer.spawnParticlesAt(evt.pos, '#ff3366', 20);
          break;
        case 'win':
          SoundSystem.playWin();
          if (evt.pos) this.renderer.spawnParticlesAt(evt.pos, '#00e599', 24);
          break;
      }
    }
  }

  // --- Win & Paradox Handlers ---

  private handleWin(): void {
    const moves = this.state.moveCount;
    const par = this.currentLevel.parMoves;
    const stars = GameEngine.calculateStars(moves, par);

    if (this.currentMode === 'campaign') {
      this.campaignProgress = StorageManager.saveLevelCompletion(
        this.currentLevelIndex + 1,
        this.currentLevel.id,
        moves,
        stars
      );
    } else if (this.currentMode === 'daily') {
      const today = DailyEchoManager.getTodayDateString();
      StorageManager.recordDailyCompletion(today, moves, stars);
    } else if (this.currentMode === 'endless') {
      StorageManager.recordEndlessScore(this.endlessFloor);
    } else if (this.currentMode === 'timetrial') {
      this.stopTimeTrialTimer();
      StorageManager.recordTimeTrialBest(this.currentLevel.id, this.timeTrialElapsedMs, moves);
    }

    this.showWinModal(moves, par, stars);
  }

  private handleParadox(): void {
    const reason = this.state.failReason || 'A temporal paradox was triggered.';
    this.showParadoxOverlay(reason);
  }

  // --- UI Update ---

  private updateUI(): void {
    this.levelTitleEl.textContent = this.currentLevel.name;
    this.chapterTitleEl.textContent =
      this.currentLevel.chapterTitle ||
      (this.currentLevel.chapter ? `Chapter ${this.currentLevel.chapter}` : '');
    this.movesEl.textContent = String(this.state.moveCount);
    this.parEl.textContent = String(this.currentLevel.parMoves);
    this.hintTextEl.textContent = this.currentLevel.hint || '';

    // Echo Status Text
    const turnsUntilEcho = this.state.echoDelay - (this.state.turn % this.state.echoDelay);
    const hasEcho = this.state.echoes.some((e) => e.active);

    if (hasEcho) {
      this.echoStatusEl.innerHTML = `<span class="echo-active">✦ ${this.state.echoes.length} Echo active</span>`;
    } else {
      this.echoStatusEl.innerHTML = `<span class="echo-countdown">Echo in ${turnsUntilEcho} moves</span>`;
    }

    // Render Timeline Bar
    this.renderTimeline();
  }

  private renderTimeline(): void {
    this.timelineEl.innerHTML = '';
    const totalSlots = Math.max(8, this.state.turn + 4);

    for (let t = 0; t <= totalSlots; t++) {
      const slot = document.createElement('div');
      slot.className = 'timeline-slot';

      if (t === this.state.turn) {
        slot.classList.add('current');
        slot.title = `Turn ${t} (Present)`;
      } else if (t < this.state.turn) {
        slot.classList.add('past');
      } else {
        slot.classList.add('future');
      }

      // Mark echo spawn points
      if (t > 0 && t % this.state.echoDelay === 0) {
        slot.classList.add('echo-marker');
      }

      this.timelineEl.appendChild(slot);
    }
  }

  // --- Modals & Overlays ---

  private setupModalEvents(): void {
    // Close modal buttons
    document.querySelectorAll('.modal-close').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const modal = (e.currentTarget as HTMLElement).closest('.modal');
        if (modal) modal.classList.remove('active');
      });
    });

    // Win Modal Actions
    document.getElementById('btn-next-level')?.addEventListener('click', () => {
      document.getElementById('win-modal')?.classList.remove('active');
      if (this.currentMode === 'campaign') {
        if (this.currentLevelIndex + 1 < CAMPAIGN_LEVELS.length) {
          this.loadCampaignLevel(this.currentLevelIndex + 1);
        } else {
          this.openLevelSelectModal();
        }
      } else if (this.currentMode === 'endless') {
        this.loadEndlessFloor(this.endlessFloor + 1);
      } else {
        this.handleRestart();
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

  private showWinModal(moves: number, par: number, stars: number): void {
    const modal = document.getElementById('win-modal')!;
    const starsEl = document.getElementById('win-stars')!;
    const movesEl = document.getElementById('win-moves')!;
    const parEl = document.getElementById('win-par')!;
    const nextBtn = document.getElementById('btn-next-level')!;

    starsEl.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    movesEl.textContent = String(moves);
    parEl.textContent = String(par);

    if (this.currentMode === 'campaign' && this.currentLevelIndex + 1 >= CAMPAIGN_LEVELS.length) {
      nextBtn.textContent = 'Campaign Complete!';
    } else if (this.currentMode === 'endless') {
      nextBtn.textContent = `Next Floor (${this.endlessFloor + 1}) →`;
    } else {
      nextBtn.textContent = 'Next Level →';
    }

    modal.classList.add('active');
  }

  private showParadoxOverlay(reason: string): void {
    const overlay = document.getElementById('paradox-overlay')!;
    const textEl = document.getElementById('paradox-reason')!;
    textEl.textContent = reason;
    overlay.classList.add('active');
  }

  private hideParadoxOverlay(): void {
    const overlay = document.getElementById('paradox-overlay');
    if (overlay) overlay.classList.remove('active');
  }

  public openLevelSelectModal(): void {
    const modal = document.getElementById('levels-modal')!;
    const grid = document.getElementById('levels-grid')!;
    grid.innerHTML = '';

    const unlocked = this.campaignProgress.unlockedLevel;

    CAMPAIGN_LEVELS.forEach((level, idx) => {
      const card = document.createElement('button');
      const isUnlocked = idx + 1 <= unlocked;
      card.className = `level-card ${isUnlocked ? 'unlocked' : 'locked'} ${
        idx === this.currentLevelIndex && this.currentMode === 'campaign' ? 'active' : ''
      }`;
      card.disabled = !isUnlocked;

      const score = this.campaignProgress.levelScores[level.id];
      const starText = score ? '★'.repeat(score.stars) : '☆☆☆';

      card.innerHTML = `
        <div class="level-num">${idx + 1}</div>
        <div class="level-card-name">${level.name}</div>
        <div class="level-card-stars">${isUnlocked ? starText : '🔒'}</div>
      `;

      if (isUnlocked) {
        card.addEventListener('click', () => {
          modal.classList.remove('active');
          this.switchMode('campaign');
          this.loadCampaignLevel(idx);
        });
      }

      grid.appendChild(card);
    });

    modal.classList.add('active');
  }

  public openHelpModal(): void {
    document.getElementById('help-modal')?.classList.add('active');
  }

  public openStatsModal(): void {
    const modal = document.getElementById('stats-modal')!;
    const stats = StorageManager.getUserStats();

    document.getElementById('stat-played')!.textContent = String(stats.gamesPlayed);
    document.getElementById('stat-completed')!.textContent = String(stats.levelsCompleted);
    document.getElementById('stat-stars')!.textContent = String(stats.totalStars);
    document.getElementById('stat-streak')!.textContent = `${stats.dailyStreak} days`;
    document.getElementById('stat-endless')!.textContent = `Sector ${stats.endlessHighScore}`;

    modal.classList.add('active');
  }

  public openSettingsModal(): void {
    const modal = document.getElementById('settings-modal')!;
    const sfxCheckbox = document.getElementById('setting-sfx') as HTMLInputElement;
    const motionCheckbox = document.getElementById('setting-motion') as HTMLInputElement;
    const contrastCheckbox = document.getElementById('setting-contrast') as HTMLInputElement;
    const trailCheckbox = document.getElementById('setting-trail') as HTMLInputElement;

    if (sfxCheckbox) sfxCheckbox.checked = this.settings.soundEnabled;
    if (motionCheckbox) motionCheckbox.checked = this.settings.reducedMotion;
    if (contrastCheckbox) contrastCheckbox.checked = this.settings.highContrast;
    if (trailCheckbox) trailCheckbox.checked = this.settings.showTrail;

    sfxCheckbox?.addEventListener('change', () => {
      this.settings.soundEnabled = sfxCheckbox.checked;
      SoundSystem.setEnabled(sfxCheckbox.checked);
      StorageManager.saveSettings(this.settings);
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

    modal.classList.add('active');
  }

  public toggleSound(): void {
    this.settings.soundEnabled = !this.settings.soundEnabled;
    SoundSystem.setEnabled(this.settings.soundEnabled);
    StorageManager.saveSettings(this.settings);

    const soundBtn = document.getElementById('btn-sound-toggle');
    if (soundBtn) {
      soundBtn.textContent = this.settings.soundEnabled ? '🔊' : '🔇';
    }
  }

  private shareCurrentResult(): void {
    const stars = GameEngine.calculateStars(this.state.moveCount, this.currentLevel.parMoves);
    let text = '';

    if (this.currentMode === 'daily') {
      const today = DailyEchoManager.getTodayDateString();
      const num = DailyEchoManager.getDailyIndex(today);
      text = DailyEchoManager.formatShareSnippet(num, this.state.moveCount, this.currentLevel.parMoves, stars);
    } else {
      text = `AFTERECHO — ${this.currentLevel.name}\nSolved in ${this.state.moveCount} moves (Par: ${this.currentLevel.parMoves}) ${'★'.repeat(stars)}\nPlay: https://afterecho.vercel.app`;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        const shareBtn = document.getElementById('btn-share-result');
        if (shareBtn) {
          const orig = shareBtn.textContent;
          shareBtn.textContent = 'Copied to clipboard!';
          setTimeout(() => {
            if (shareBtn) shareBtn.textContent = orig;
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
