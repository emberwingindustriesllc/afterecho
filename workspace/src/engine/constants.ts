import { Action, Position } from './types.js';

export const ACTION_DELTAS: Record<Action, Position> = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
  WAIT: { x: 0, y: 0 },
};

export const COLOR_PALETTE = {
  bg: '#0a0d14',
  gridBase: '#121824',
  gridBorder: '#1c2638',
  tileEmpty: '#141c2b',
  tileEmptyAlt: '#161f30',
  wall: '#26344d',
  wallTop: '#374b6f',
  player: '#00f0ff',        // Luminous Cyan
  playerGlow: 'rgba(0, 240, 255, 0.4)',
  playerTrail: 'rgba(0, 240, 255, 0.25)',
  echo: '#b55fe6',          // Violet Echo
  echoGlow: 'rgba(181, 95, 230, 0.45)',
  echoTrail: 'rgba(181, 95, 230, 0.25)',
  exit: '#00e599',          // Radiant Emerald
  exitGlow: 'rgba(0, 229, 153, 0.4)',
  hazard: '#ff3366',        // Crimson Hazard
  hazardGlow: 'rgba(255, 51, 102, 0.4)',
  shard: '#ffd000',         // Bright Gold Shard
  shardGlow: 'rgba(255, 208, 0, 0.45)',
  block: '#8b9bb4',
  blockBorder: '#5b6b84',
  channels: {
    amber: {
      active: '#ffaa00',
      inactive: '#775200',
      doorOpen: 'rgba(255, 170, 0, 0.15)',
      doorClosed: '#ffaa00',
      glow: 'rgba(255, 170, 0, 0.4)',
    },
    cyan: {
      active: '#00d0ff',
      inactive: '#005870',
      doorOpen: 'rgba(0, 208, 255, 0.15)',
      doorClosed: '#00d0ff',
      glow: 'rgba(0, 208, 255, 0.4)',
    },
    magenta: {
      active: '#ff00bb',
      inactive: '#700052',
      doorOpen: 'rgba(255, 0, 187, 0.15)',
      doorClosed: '#ff00bb',
      glow: 'rgba(255, 0, 187, 0.4)',
    },
    emerald: {
      active: '#10f090',
      inactive: '#056038',
      doorOpen: 'rgba(16, 240, 144, 0.15)',
      doorClosed: '#10f090',
      glow: 'rgba(16, 240, 144, 0.4)',
    },
  },
};

export const DEFAULT_SETTINGS = {
  soundEnabled: true,
  volume: 0.7,
  reducedMotion: false,
  highContrast: false,
  showTrail: true,
  controlType: 'both' as const,
};
