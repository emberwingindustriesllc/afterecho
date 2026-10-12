export type Action = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'WAIT';

export interface Position {
  x: number;
  y: number;
}

export type SwitchType = 'pressure' | 'toggle';
export type SwitchChannel = 'amber' | 'cyan' | 'magenta' | 'emerald';

export interface SwitchDef {
  id: string;
  pos: Position;
  type: SwitchType;
  channel: SwitchChannel;
}

export interface SwitchState extends SwitchDef {
  active: boolean; // For pressure plate: currently occupied; for toggle: currently ON
}

export interface DoorDef {
  id: string;
  pos: Position;
  channel: SwitchChannel;
  startsOpen?: boolean; // Default false
}

export interface DoorState extends DoorDef {
  open: boolean;
}

export interface BlockDef {
  id: string;
  pos: Position;
}

export interface BlockState extends BlockDef {}

export interface ShardDef {
  id: string;
  pos: Position;
}

export interface ShardState extends ShardDef {
  collected: boolean;
}

export interface HazardDef {
  pos: Position;
  cycleInterval?: number; // e.g., 2 (alternates every turn)
  activePhase?: number;   // e.g. turn % interval === activePhase is dangerous
}

export interface EchoEntity {
  id: number;
  pos: Position;
  active: boolean;
  spawnTurn: number;
  color: string;
}

export type GameStatus = 'playing' | 'won' | 'paradox' | 'trapped';

export interface MoveStepResult {
  valid: boolean;
  status: GameStatus;
  message?: string;
}

export interface GameState {
  width: number;
  height: number;
  playerPos: Position;
  turn: number;
  history: Position[];          // history[turn] = player position at that turn
  actionHistory: Action[];      // actionHistory[t-1] was action taken at turn t
  echoDelay: number;            // Turn delay before echo follows (e.g. 4)
  maxEchoes: number;            // Default 1
  echoes: EchoEntity[];
  switches: SwitchState[];
  doors: DoorState[];
  blocks: BlockState[];
  shards: ShardState[];
  shardsCollected: number;
  totalShards: number;
  hazards: HazardDef[];
  status: GameStatus;
  failReason?: string;
  moveCount: number;
}

export interface LevelDef {
  id: string;
  name: string;
  chapter?: number;
  chapterTitle?: string;
  width: number;
  height: number;
  playerStart: Position;
  exitPos: Position;
  echoDelay: number;
  maxEchoes?: number;
  walls: Position[];
  switches?: SwitchDef[];
  doors?: DoorDef[];
  blocks?: Position[];
  shards?: Position[];
  hazards?: HazardDef[];
  parMoves: number;
  hint?: string;
  lore?: string;
}

export interface CampaignProgress {
  unlockedLevel: number;
  levelScores: Record<string, { stars: number; bestMoves: number; completedAt: string }>;
}

export interface DailyRecord {
  date: string;
  completed: boolean;
  moves: number;
  stars: number;
  completedAt?: string;
}

export interface UserStats {
  gamesPlayed: number;
  levelsCompleted: number;
  totalStars: number;
  dailyStreak: number;
  dailyLastPlayed?: string;
  dailyHistory: Record<string, DailyRecord>;
  timeTrialBests: Record<string, { timeMs: number; moves: number }>;
  endlessHighScore: number;
}

export interface Settings {
  soundEnabled: boolean;
  volume: number;
  reducedMotion: boolean;
  highContrast: boolean;
  showTrail: boolean;
  controlType: 'buttons' | 'gestures' | 'both';
}
