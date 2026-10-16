import { ACTION_DELTAS, COLOR_PALETTE } from '../engine/constants.js';
import { GameEngine, isHazardActive, posEquals } from '../engine/gameEngine.js';
export class GameRenderer {
    canvas;
    ctx;
    animFrameId = null;
    // Layout metrics
    tileSize = 64;
    offsetX = 0;
    offsetY = 0;
    dpr = 1;
    lastGridWidth = 7;
    lastGridHeight = 6;
    // Animation & Interpolation
    prevPlayerPos = null;
    targetPlayerPos = { x: 0, y: 0 };
    prevEchoPositions = new Map();
    interpProgress = 1.0;
    particles = [];
    timeSeconds = 0;
    // Interactive overlays
    hoveredTile = null;
    hintAction = null;
    // Options
    reducedMotion = false;
    showTrail = true;
    highContrast = false;
    constructor(canvas) {
        this.canvas = canvas;
        const context = canvas.getContext('2d');
        if (!context)
            throw new Error('Failed to get 2D canvas context');
        this.ctx = context;
        this.updateDpi();
    }
    updateDpi() {
        this.dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
        const rect = this.canvas.getBoundingClientRect();
        const width = Math.max(280, Math.floor(rect.width));
        const height = Math.max(280, Math.floor(rect.height));
        this.canvas.width = Math.floor(width * this.dpr);
        this.canvas.height = Math.floor(height * this.dpr);
    }
    screenToTile(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const localX = clientX - rect.left;
        const localY = clientY - rect.top;
        const tx = Math.floor((localX - this.offsetX) / this.tileSize);
        const ty = Math.floor((localY - this.offsetY) / this.tileSize);
        if (tx < 0 || tx >= this.lastGridWidth || ty < 0 || ty >= this.lastGridHeight) {
            return null;
        }
        return { x: tx, y: ty };
    }
    startAnimationLoop(getState) {
        let lastTime = performance.now();
        const loop = (now) => {
            const dt = Math.min((now - lastTime) / 1000, 0.1);
            lastTime = now;
            this.timeSeconds += dt;
            if (!this.reducedMotion && this.interpProgress < 1.0) {
                this.interpProgress = Math.min(1.0, this.interpProgress + dt * 11);
            }
            else {
                this.interpProgress = 1.0;
            }
            this.updateParticles(dt);
            const data = getState();
            if (data && data.state && data.level) {
                this.render(data.state, data.level);
            }
            this.animFrameId = requestAnimationFrame(loop);
        };
        if (this.animFrameId)
            cancelAnimationFrame(this.animFrameId);
        this.animFrameId = requestAnimationFrame(loop);
    }
    stopAnimationLoop() {
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
    }
    triggerMoveTransition(from, to, prevEchoes) {
        this.hintAction = null;
        if (this.reducedMotion) {
            this.interpProgress = 1.0;
            this.prevPlayerPos = null;
            this.prevEchoPositions.clear();
            this.targetPlayerPos = { ...to };
            return;
        }
        this.prevPlayerPos = { ...from };
        this.targetPlayerPos = { ...to };
        this.prevEchoPositions = prevEchoes ? new Map(prevEchoes) : new Map();
        this.interpProgress = 0.0;
    }
    spawnParticlesAt(pos, color, count = 12) {
        if (this.reducedMotion)
            return;
        const center = this.tileToScreen(pos);
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5);
            const speed = 40 + Math.random() * 80;
            this.particles.push({
                x: center.x,
                y: center.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 3 + Math.random() * 3,
                color,
                alpha: 1.0,
                life: 0,
                maxLife: 0.4 + Math.random() * 0.3,
            });
        }
    }
    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life += dt;
            if (p.life >= p.maxLife) {
                this.particles.splice(i, 1);
                continue;
            }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.alpha = Math.max(0, 1 - p.life / p.maxLife);
        }
    }
    calculateLayout(state) {
        this.lastGridWidth = state.width;
        this.lastGridHeight = state.height;
        const w = this.canvas.width / this.dpr;
        const h = this.canvas.height / this.dpr;
        const padding = 18;
        const availW = w - padding * 2;
        const availH = h - padding * 2;
        const tileW = Math.floor(availW / state.width);
        const tileH = Math.floor(availH / state.height);
        this.tileSize = Math.min(tileW, tileH, 80);
        const boardW = this.tileSize * state.width;
        const boardH = this.tileSize * state.height;
        this.offsetX = Math.floor((w - boardW) / 2);
        this.offsetY = Math.floor((h - boardH) / 2);
    }
    tileToScreen(pos) {
        return {
            x: this.offsetX + (pos.x + 0.5) * this.tileSize,
            y: this.offsetY + (pos.y + 0.5) * this.tileSize,
        };
    }
    render(state, level) {
        this.calculateLayout(state);
        const ctx = this.ctx;
        ctx.save();
        ctx.scale(this.dpr, this.dpr);
        const canvasW = this.canvas.width / this.dpr;
        const canvasH = this.canvas.height / this.dpr;
        // Background
        ctx.fillStyle = this.highContrast ? '#05070b' : COLOR_PALETTE.bg;
        ctx.fillRect(0, 0, canvasW, canvasH);
        // Board Frame Glow
        const boardW = state.width * this.tileSize;
        const boardH = state.height * this.tileSize;
        ctx.save();
        ctx.strokeStyle = this.highContrast ? '#475569' : COLOR_PALETTE.gridBorder;
        ctx.lineWidth = 2;
        ctx.strokeRect(this.offsetX - 2, this.offsetY - 2, boardW + 4, boardH + 4);
        ctx.restore();
        // 1. Render Tiles (Empty & Walls)
        for (let y = 0; y < state.height; y++) {
            for (let x = 0; x < state.width; x++) {
                const px = this.offsetX + x * this.tileSize;
                const py = this.offsetY + y * this.tileSize;
                const isWall = level.walls.some((w) => w.x === x && w.y === y);
                if (isWall) {
                    this.renderWallTile(ctx, px, py, this.tileSize);
                }
                else {
                    this.renderFloorTile(ctx, px, py, this.tileSize, (x + y) % 2 === 0);
                }
            }
        }
        // 2. Render Subtle Switch-to-Door Circuit Lines
        this.renderCircuitLinks(ctx, state);
        // 3. Render Hazards (Lasers / Spikes)
        state.hazards.forEach((hazard) => {
            const active = isHazardActive(hazard, state.turn);
            this.renderHazard(ctx, hazard.pos, active);
        });
        // 4. Render Switches & Pressure Plates
        state.switches.forEach((sw) => {
            this.renderSwitch(ctx, sw);
        });
        // 5. Render Doors
        state.doors.forEach((door) => {
            this.renderDoor(ctx, door);
        });
        // 6. Render Exit
        this.renderExit(ctx, level.exitPos, state.shardsCollected >= state.totalShards);
        // 7. Render Shards
        state.shards.forEach((shard) => {
            if (!shard.collected) {
                this.renderShard(ctx, shard.pos);
            }
        });
        // 8. Render Movement History Trails
        if (this.showTrail) {
            this.renderTrails(ctx, state);
        }
        // 9. Render Upcoming Echo Spawn Indicator & Next-Step Previews
        this.renderEchoPreviews(ctx, state, level);
        // 10. Render Interactive Valid Move Dots & Hover / Hint Overlays
        if (state.status === 'playing') {
            this.renderMoveIndicatorsAndHint(ctx, state, level);
        }
        // 11. Render Pushable Blocks
        state.blocks.forEach((block) => {
            this.renderBlock(ctx, block.pos);
        });
        // 12. Render Echoes
        state.echoes.forEach((echo) => {
            if (echo.active) {
                this.renderEcho(ctx, echo);
            }
        });
        // 13. Render Player
        this.renderPlayer(ctx, state);
        // 14. Render Floating Particles
        this.renderParticles(ctx);
        // 15. State Alerts (Paradox)
        if (state.status === 'paradox') {
            this.renderParadoxGlitch(ctx, boardW, boardH);
        }
        ctx.restore();
    }
    renderFloorTile(ctx, x, y, size, alt) {
        ctx.fillStyle = alt ? COLOR_PALETTE.tileEmpty : COLOR_PALETTE.tileEmptyAlt;
        ctx.fillRect(x, y, size, size);
        ctx.strokeStyle = this.highContrast ? 'rgba(255, 255, 255, 0.09)' : 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
    }
    renderWallTile(ctx, x, y, size) {
        ctx.fillStyle = this.highContrast ? '#334155' : COLOR_PALETTE.wall;
        ctx.fillRect(x, y, size, size);
        ctx.fillStyle = this.highContrast ? '#475569' : COLOR_PALETTE.wallTop;
        ctx.fillRect(x + 3, y + 3, size - 6, size - 6);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, size, size);
    }
    renderCircuitLinks(ctx, state) {
        if (state.switches.length === 0 || state.doors.length === 0)
            return;
        ctx.save();
        for (const sw of state.switches) {
            const channelConfig = COLOR_PALETTE.channels[sw.channel] ||
                COLOR_PALETTE.channels.amber;
            const matchingDoors = state.doors.filter((d) => d.channel === sw.channel);
            const from = this.tileToScreen(sw.pos);
            for (const door of matchingDoors) {
                const to = this.tileToScreen(door.pos);
                ctx.strokeStyle = sw.active ? channelConfig.active : channelConfig.inactive;
                ctx.globalAlpha = sw.active ? 0.38 : 0.18;
                ctx.lineWidth = sw.active ? 2 : 1.5;
                ctx.setLineDash([4, 6]);
                ctx.beginPath();
                ctx.moveTo(from.x, from.y);
                ctx.lineTo(to.x, from.y);
                ctx.lineTo(to.x, to.y);
                ctx.stroke();
            }
        }
        ctx.restore();
    }
    renderEchoPreviews(ctx, state, level) {
        ctx.save();
        // 1. Show spawn countdown ghost ring on playerStart before next Echo spawns
        for (let i = 1; i <= state.maxEchoes; i++) {
            const spawnTurn = i * state.echoDelay;
            const remaining = spawnTurn - state.turn;
            if (remaining > 0 && remaining <= state.echoDelay) {
                const spawnScreen = this.tileToScreen(level.playerStart);
                const r = this.tileSize * 0.36;
                const pulse = Math.sin(this.timeSeconds * 5) * 0.08 + 0.92;
                ctx.strokeStyle = remaining === 1 ? '#d885ff' : 'rgba(181, 95, 230, 0.55)';
                ctx.lineWidth = remaining === 1 ? 2.2 : 1.5;
                ctx.setLineDash([3, 4]);
                ctx.beginPath();
                ctx.arc(spawnScreen.x, spawnScreen.y, r * pulse, 0, Math.PI * 2);
                ctx.stroke();
                if (!posEquals(state.playerPos, level.playerStart)) {
                    ctx.fillStyle = 'rgba(216, 133, 255, 0.85)';
                    ctx.font = `bold ${Math.max(9, Math.floor(this.tileSize * 0.18))}px monospace`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(`E${i}:${remaining}`, spawnScreen.x, spawnScreen.y);
                }
                break;
            }
        }
        // 2. Show where each active Echo will step on the next turn
        for (const echo of state.echoes) {
            if (!echo.active)
                continue;
            const nextHistIndex = state.turn + 1 - echo.id * state.echoDelay;
            if (nextHistIndex >= 0 && nextHistIndex < state.history.length) {
                const nextPos = state.history[nextHistIndex];
                if (!posEquals(nextPos, echo.pos)) {
                    const from = this.tileToScreen(echo.pos);
                    const to = this.tileToScreen(nextPos);
                    ctx.strokeStyle = 'rgba(216, 133, 255, 0.55)';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([3, 3]);
                    ctx.beginPath();
                    ctx.moveTo(from.x, from.y);
                    ctx.lineTo(to.x, to.y);
                    ctx.stroke();
                    ctx.fillStyle = 'rgba(181, 95, 230, 0.35)';
                    ctx.beginPath();
                    ctx.arc(to.x, to.y, this.tileSize * 0.12, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
        ctx.restore();
    }
    renderMoveIndicatorsAndHint(ctx, state, level) {
        ctx.save();
        const directions = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
        for (const dir of directions) {
            const check = GameEngine.isValidAction(state, dir, level);
            if (!check.valid)
                continue;
            const delta = ACTION_DELTAS[dir];
            const targetTile = {
                x: state.playerPos.x + delta.x,
                y: state.playerPos.y + delta.y,
            };
            const center = this.tileToScreen(targetTile);
            const isHovered = this.hoveredTile && posEquals(this.hoveredTile, targetTile);
            if (isHovered) {
                const pad = this.tileSize * 0.42;
                ctx.fillStyle = 'rgba(0, 240, 255, 0.14)';
                ctx.strokeStyle = 'rgba(0, 240, 255, 0.65)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.roundRect(center.x - pad, center.y - pad, pad * 2, pad * 2, 8);
                ctx.fill();
                ctx.stroke();
            }
            else {
                // Subtle valid-step dot
                ctx.fillStyle = 'rgba(0, 240, 255, 0.28)';
                ctx.beginPath();
                ctx.arc(center.x, center.y, Math.max(3, this.tileSize * 0.06), 0, Math.PI * 2);
                ctx.fill();
            }
        }
        // Hover on player's own tile (WAIT)
        if (this.hoveredTile && posEquals(this.hoveredTile, state.playerPos)) {
            const center = this.tileToScreen(state.playerPos);
            ctx.strokeStyle = 'rgba(181, 95, 230, 0.75)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(center.x, center.y, this.tileSize * 0.42, 0, Math.PI * 2);
            ctx.stroke();
        }
        // Render Active Hint Highlight if requested
        if (this.hintAction) {
            const delta = ACTION_DELTAS[this.hintAction];
            const hintTile = {
                x: state.playerPos.x + delta.x,
                y: state.playerPos.y + delta.y,
            };
            const center = this.tileToScreen(hintTile);
            const pulse = Math.sin(this.timeSeconds * 6) * 0.1 + 0.9;
            const r = this.tileSize * 0.38 * pulse;
            ctx.strokeStyle = '#ffd000';
            ctx.lineWidth = 3;
            ctx.fillStyle = 'rgba(255, 208, 0, 0.22)';
            ctx.beginPath();
            ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#ffd000';
            ctx.font = `bold ${Math.max(10, Math.floor(this.tileSize * 0.22))}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const label = this.hintAction === 'WAIT' ? 'WAIT' : '★';
            ctx.fillText(label, center.x, center.y);
        }
        ctx.restore();
    }
    renderExit(ctx, pos, unlocked) {
        const center = this.tileToScreen(pos);
        const radius = this.tileSize * 0.38;
        ctx.save();
        const pulse = Math.sin(this.timeSeconds * 3) * 0.15 + 0.85;
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius * pulse, 0, Math.PI * 2);
        ctx.fillStyle = unlocked ? COLOR_PALETTE.exitGlow : 'rgba(100, 100, 100, 0.2)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = unlocked ? COLOR_PALETTE.exit : '#556677';
        ctx.fill();
        ctx.strokeStyle = '#051810';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius * 0.35, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
    renderHazard(ctx, pos, active) {
        const center = this.tileToScreen(pos);
        const size = this.tileSize * 0.7;
        ctx.save();
        if (active) {
            ctx.fillStyle = COLOR_PALETTE.hazardGlow;
            ctx.fillRect(center.x - size / 2, center.y - size / 2, size, size);
            ctx.strokeStyle = COLOR_PALETTE.hazard;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(center.x - size / 2, center.y);
            ctx.lineTo(center.x + size / 2, center.y);
            ctx.moveTo(center.x, center.y - size / 2);
            ctx.lineTo(center.x, center.y + size / 2);
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(center.x, center.y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        else {
            ctx.strokeStyle = 'rgba(255, 51, 102, 0.35)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);
            ctx.strokeRect(center.x - size / 2, center.y - size / 2, size, size);
        }
        ctx.restore();
    }
    renderSwitch(ctx, sw) {
        const center = this.tileToScreen(sw.pos);
        const channelConfig = COLOR_PALETTE.channels[sw.channel] || COLOR_PALETTE.channels.amber;
        ctx.save();
        if (sw.type === 'pressure') {
            const padSize = this.tileSize * 0.65;
            ctx.strokeStyle = sw.active ? channelConfig.active : channelConfig.inactive;
            ctx.lineWidth = sw.active ? 3 : 2;
            ctx.fillStyle = sw.active ? channelConfig.glow : 'rgba(0, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.roundRect(center.x - padSize / 2, center.y - padSize / 2, padSize, padSize, 6);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = sw.active ? channelConfig.active : channelConfig.inactive;
            ctx.beginPath();
            ctx.arc(center.x, center.y, padSize * 0.2, 0, Math.PI * 2);
            ctx.fill();
        }
        else {
            const radius = this.tileSize * 0.28;
            ctx.fillStyle = sw.active ? channelConfig.active : channelConfig.inactive;
            ctx.beginPath();
            ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        if (this.highContrast) {
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${Math.max(9, Math.floor(this.tileSize * 0.18))}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(sw.channel[0].toUpperCase(), center.x, center.y);
        }
        ctx.restore();
    }
    renderDoor(ctx, door) {
        const center = this.tileToScreen(door.pos);
        const size = this.tileSize * 0.85;
        const channelConfig = COLOR_PALETTE.channels[door.channel] || COLOR_PALETTE.channels.amber;
        ctx.save();
        if (door.open) {
            ctx.fillStyle = channelConfig.doorOpen;
            ctx.fillRect(center.x - size / 2, center.y - size / 2, size, size);
            ctx.strokeStyle = channelConfig.active;
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1.5;
            ctx.strokeRect(center.x - size / 2, center.y - size / 2, size, size);
        }
        else {
            ctx.fillStyle = channelConfig.doorClosed;
            ctx.fillRect(center.x - size / 2, center.y - size / 2, size, size);
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(center.x - size * 0.25, center.y);
            ctx.lineTo(center.x + size * 0.25, center.y);
            ctx.stroke();
        }
        if (this.highContrast && !door.open) {
            ctx.fillStyle = '#000000';
            ctx.font = `bold ${Math.max(10, Math.floor(this.tileSize * 0.22))}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(door.channel[0].toUpperCase(), center.x, center.y - size * 0.22);
        }
        ctx.restore();
    }
    renderShard(ctx, pos) {
        const center = this.tileToScreen(pos);
        const pulse = Math.sin(this.timeSeconds * 4) * 2;
        const r = this.tileSize * 0.22;
        ctx.save();
        ctx.fillStyle = COLOR_PALETTE.shardGlow;
        ctx.beginPath();
        ctx.arc(center.x, center.y, r * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COLOR_PALETTE.shard;
        ctx.beginPath();
        ctx.moveTo(center.x, center.y - r - pulse);
        ctx.lineTo(center.x + r, center.y);
        ctx.lineTo(center.x, center.y + r + pulse);
        ctx.lineTo(center.x - r, center.y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
    }
    renderBlock(ctx, pos) {
        const center = this.tileToScreen(pos);
        const size = this.tileSize * 0.72;
        ctx.save();
        ctx.fillStyle = COLOR_PALETTE.block;
        ctx.beginPath();
        ctx.roundRect(center.x - size / 2, center.y - size / 2, size, size, 8);
        ctx.fill();
        ctx.strokeStyle = COLOR_PALETTE.blockBorder;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(center.x - size * 0.25, center.y);
        ctx.lineTo(center.x + size * 0.25, center.y);
        ctx.moveTo(center.x, center.y - size * 0.25);
        ctx.lineTo(center.x, center.y + size * 0.25);
        ctx.stroke();
        ctx.restore();
    }
    renderTrails(ctx, state) {
        if (state.history.length <= 1)
            return;
        ctx.save();
        const maxTrailPoints = Math.min(state.history.length, 12);
        const startIdx = Math.max(0, state.history.length - maxTrailPoints);
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let i = startIdx; i < state.history.length - 1; i++) {
            const from = this.tileToScreen(state.history[i]);
            const to = this.tileToScreen(state.history[i + 1]);
            const alpha = (i - startIdx + 1) / maxTrailPoints;
            ctx.strokeStyle = `rgba(0, 240, 255, ${alpha * 0.35})`;
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
        }
        ctx.restore();
    }
    renderEcho(ctx, echo) {
        let cx;
        let cy;
        const prevPos = this.prevEchoPositions.get(echo.id);
        if (!this.reducedMotion && prevPos && this.interpProgress < 1.0) {
            const from = this.tileToScreen(prevPos);
            const to = this.tileToScreen(echo.pos);
            cx = from.x + (to.x - from.x) * this.interpProgress;
            cy = from.y + (to.y - from.y) * this.interpProgress;
        }
        else {
            const center = this.tileToScreen(echo.pos);
            cx = center.x;
            cy = center.y;
        }
        const radius = this.tileSize * 0.32;
        ctx.save();
        ctx.fillStyle = COLOR_PALETTE.echoGlow;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = echo.color;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 1.25, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.floor(this.tileSize * 0.25)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`E${echo.id}`, cx, cy);
        ctx.restore();
    }
    renderPlayer(ctx, state) {
        let px;
        let py;
        if (!this.reducedMotion && this.prevPlayerPos && this.interpProgress < 1.0) {
            const from = this.tileToScreen(this.prevPlayerPos);
            const to = this.tileToScreen(this.targetPlayerPos);
            px = from.x + (to.x - from.x) * this.interpProgress;
            py = from.y + (to.y - from.y) * this.interpProgress;
        }
        else {
            const center = this.tileToScreen(state.playerPos);
            px = center.x;
            py = center.y;
        }
        const radius = this.tileSize * 0.33;
        ctx.save();
        ctx.fillStyle = COLOR_PALETTE.playerGlow;
        ctx.beginPath();
        ctx.arc(px, py, radius * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COLOR_PALETTE.player;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px, py, radius * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    renderParticles(ctx) {
        for (const p of this.particles) {
            ctx.save();
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
    renderParadoxGlitch(ctx, width, height) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 30, 80, 0.15)';
        ctx.fillRect(this.offsetX, this.offsetY, width, height);
        ctx.strokeStyle = 'rgba(255, 30, 80, 0.4)';
        ctx.lineWidth = 1;
        for (let y = this.offsetY; y < this.offsetY + height; y += 8) {
            ctx.beginPath();
            ctx.moveTo(this.offsetX, y);
            ctx.lineTo(this.offsetX + width, y);
            ctx.stroke();
        }
        ctx.restore();
    }
}
