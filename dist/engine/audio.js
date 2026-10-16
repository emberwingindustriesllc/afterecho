import { StorageManager } from './storage.js';
export class SoundSystem {
    static ctx = null;
    static enabled = true;
    static masterVolume = 0.5;
    static init() {
        const settings = StorageManager.getSettings();
        SoundSystem.enabled = settings.soundEnabled;
        SoundSystem.masterVolume = settings.volume;
    }
    static getContext() {
        if (!SoundSystem.enabled)
            return null;
        if (typeof window === 'undefined')
            return null;
        if (!SoundSystem.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                SoundSystem.ctx = new AudioCtx();
            }
        }
        if (SoundSystem.ctx && SoundSystem.ctx.state === 'suspended') {
            SoundSystem.ctx.resume().catch(() => { });
        }
        return SoundSystem.ctx;
    }
    static setEnabled(enabled) {
        SoundSystem.enabled = enabled;
    }
    static setVolume(volume) {
        SoundSystem.masterVolume = Math.max(0, Math.min(1, volume));
    }
    // --- Sound Presets ---
    static playMove() {
        const ctx = SoundSystem.getContext();
        if (!ctx)
            return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const now = ctx.currentTime;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.04); // A4 to D5
        gain.gain.setValueAtTime(0.08 * SoundSystem.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
    }
    static playWait() {
        const ctx = SoundSystem.getContext();
        if (!ctx)
            return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const now = ctx.currentTime;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(330, now);
        osc.frequency.linearRampToValueAtTime(300, now + 0.06);
        gain.gain.setValueAtTime(0.06 * SoundSystem.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.06);
    }
    static playEchoSpawn() {
        const ctx = SoundSystem.getContext();
        if (!ctx)
            return;
        const now = ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const delay = idx * 0.04;
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + delay);
            gain.gain.setValueAtTime(0.09 * SoundSystem.masterVolume, now + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.25);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + delay);
            osc.stop(now + delay + 0.25);
        });
    }
    static playSwitch() {
        const ctx = SoundSystem.getContext();
        if (!ctx)
            return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.03);
        gain.gain.setValueAtTime(0.08 * SoundSystem.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.04);
    }
    static playPressureDown() {
        const ctx = SoundSystem.getContext();
        if (!ctx)
            return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.08);
        gain.gain.setValueAtTime(0.12 * SoundSystem.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
    }
    static playDoorToggle(open) {
        const ctx = SoundSystem.getContext();
        if (!ctx)
            return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        if (open) {
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.12);
        }
        else {
            osc.frequency.setValueAtTime(500, now);
            osc.frequency.exponentialRampToValueAtTime(250, now + 0.12);
        }
        gain.gain.setValueAtTime(0.08 * SoundSystem.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
    }
    static playShardCollect() {
        const ctx = SoundSystem.getContext();
        if (!ctx)
            return;
        const now = ctx.currentTime;
        [659.25, 830.61, 987.77, 1318.51].forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const delay = idx * 0.03;
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + delay);
            gain.gain.setValueAtTime(0.1 * SoundSystem.masterVolume, now + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.15);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + delay);
            osc.stop(now + delay + 0.15);
        });
    }
    static playBlockPush() {
        const ctx = SoundSystem.getContext();
        if (!ctx)
            return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
        gain.gain.setValueAtTime(0.09 * SoundSystem.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
    }
    static playParadox() {
        const ctx = SoundSystem.getContext();
        if (!ctx)
            return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(70, now + 0.3);
        gain.gain.setValueAtTime(0.18 * SoundSystem.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
    }
    static playWin() {
        const ctx = SoundSystem.getContext();
        if (!ctx)
            return;
        const now = ctx.currentTime;
        const chord = [523.25, 659.25, 783.99, 1046.5, 1318.51];
        chord.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const delay = i * 0.06;
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + delay);
            gain.gain.setValueAtTime(0.12 * SoundSystem.masterVolume, now + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.45);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + delay);
            osc.stop(now + delay + 0.45);
        });
    }
    static playUndo() {
        const ctx = SoundSystem.getContext();
        if (!ctx)
            return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(350, now);
        osc.frequency.linearRampToValueAtTime(500, now + 0.05);
        gain.gain.setValueAtTime(0.07 * SoundSystem.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
    }
}
