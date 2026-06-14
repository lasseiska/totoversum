class AudioManager {
    private bgm: HTMLAudioElement | null = null;
    private ctx: AudioContext | null = null;
    private isMuted: boolean = false;
    private initialized: boolean = false;
    private bgmVolume: number = 0.15; // default 15%
    private sfxVolume: number = 0.5;  // default 50%

    constructor() {
        if (typeof window !== 'undefined') {
            // Load settings from localStorage
            const storedMute = localStorage.getItem('totoversum_muted');
            this.isMuted = storedMute === 'true';

            const storedBgm = localStorage.getItem('totoversum_bgm_volume');
            if (storedBgm !== null) {
                this.bgmVolume = parseFloat(storedBgm);
            }

            const storedSfx = localStorage.getItem('totoversum_sfx_volume');
            if (storedSfx !== null) {
                this.sfxVolume = parseFloat(storedSfx);
            }

            // Preload background music
            const BASE_URL = import.meta.env.BASE_URL;
            this.bgm = new Audio(`${BASE_URL}Totoversum backgroundmusic.mp3`);
            this.bgm.loop = true;
            this.bgm.volume = this.bgmVolume;
        }
    }

    public init() {
        if (this.initialized) return;
        this.initialized = true;

        if (typeof window !== 'undefined') {
            if (!this.ctx) {
                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                if (AudioContextClass) {
                    this.ctx = new AudioContextClass();
                }
            }

            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }

            if (!this.isMuted && this.bgm) {
                this.bgm.play().catch((err) => {
                    console.warn("Autoplay blocked or music failed to play:", err);
                    // Reset initialized state so it will try again on next user interaction
                    this.initialized = false;
                });
            }
        }
    }

    public toggleMute(): boolean {
        this.isMuted = !this.isMuted;
        localStorage.setItem('totoversum_muted', String(this.isMuted));

        if (this.bgm) {
            if (this.isMuted) {
                this.bgm.pause();
            } else {
                this.init(); // ensure ctx and playback are initialized
                if (this.initialized) {
                    this.bgm.play().catch((e) => console.warn("Failed to resume BGM:", e));
                }
            }
        }
        return this.isMuted;
    }

    public getMuted(): boolean {
        return this.isMuted;
    }

    public isInitialized(): boolean {
        return this.initialized;
    }

    public getBgmVolume(): number {
        return this.bgmVolume;
    }

    public getSfxVolume(): number {
        return this.sfxVolume;
    }

    public setBgmVolume(volume: number) {
        this.bgmVolume = volume;
        localStorage.setItem('totoversum_bgm_volume', String(volume));
        if (this.bgm) {
            this.bgm.volume = volume;
        }
    }

    public setSfxVolume(volume: number) {
        this.sfxVolume = volume;
        localStorage.setItem('totoversum_sfx_volume', String(volume));
    }

    // Play placing sound: soft high frequency sweep
    public playPlace() {
        if (this.isMuted || this.sfxVolume <= 0) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(250, now);
        osc.frequency.exponentialRampToValueAtTime(500, now + 0.08);

        // Multiply baseline gain (0.25) by sfxVolume
        gain.gain.setValueAtTime(0.25 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.1);
    }

    // Play merge sound: chime-like pitch sweep scaling with level
    public playMerge(level: number) {
        if (this.isMuted || this.sfxVolume <= 0) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        // Pitch increases with tile level
        const baseFreq = 220 + level * 80; // Level 1 -> 300Hz, Level 4 -> 540Hz
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 2.2, now + 0.22);

        gain.gain.setValueAtTime(0.35 * this.sfxVolume, now);
        gain.gain.setValueAtTime(0.35 * this.sfxVolume, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);

        // Add an extra sparkling layer for high-level merges (L3, L4, Rare)
        if (level >= 3) {
            const oscExtra = this.ctx.createOscillator();
            const gainExtra = this.ctx.createGain();

            oscExtra.type = 'sine';
            oscExtra.frequency.setValueAtTime(baseFreq * 1.5, now + 0.03);
            oscExtra.frequency.exponentialRampToValueAtTime(baseFreq * 3.5, now + 0.22);

            gainExtra.gain.setValueAtTime(0.18 * this.sfxVolume, now + 0.03);
            gainExtra.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

            oscExtra.connect(gainExtra);
            gainExtra.connect(this.ctx.destination);
            oscExtra.start(now + 0.03);
            oscExtra.stop(now + 0.25);
        }
    }

    // Play Game Over sound: retro downward sweep
    public playGameOver() {
        if (this.isMuted || this.sfxVolume <= 0) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.linearRampToValueAtTime(80, now + 0.65);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, now);
        filter.frequency.exponentialRampToValueAtTime(150, now + 0.65);

        gain.gain.setValueAtTime(0.45 * this.sfxVolume, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.65);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.7);
    }

    // Play reset game sound: gentle wind-like upward sweep
    public playReset() {
        if (this.isMuted || this.sfxVolume <= 0) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(360, now + 0.28);

        gain.gain.setValueAtTime(0.2 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.3);
    }
}

export const audioManager = new AudioManager();
