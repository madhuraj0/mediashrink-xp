// Retro Windows XP Synthesizer Sound Effects using Web Audio API
class AudioSynth {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('mediashrink_muted') === 'true';
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  isMuted() {
    return this.muted;
  }

  setMuted(muted) {
    this.muted = muted;
    localStorage.setItem('mediashrink_muted', muted ? 'true' : 'false');
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  playClick() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {
      // AudioContext error handling
    }
  }

  playDing() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      [880, 1760].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.15 / (i + 1), now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.45);
      });
    } catch (e) {}
  }

  playSuccess() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const notes = [
        { f: 523.25, t: 0 },    // C5
        { f: 659.25, t: 0.1 },  // E5
        { f: 783.99, t: 0.2 },  // G5
        { f: 1046.50, t: 0.3 }  // C6
      ];

      const now = this.ctx.currentTime;
      notes.forEach(({ f, t }) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + t);

        gain.gain.setValueAtTime(0, now + t);
        gain.gain.linearRampToValueAtTime(0.2, now + t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + t);
        osc.stop(now + t + 0.45);
      });
    } catch (e) {}
  }

  playError() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.25);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {}
  }

  playStartupSound() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      // Classic XP startup chime imitation: Eb4, Bb4, Eb5, G5, Bb5, Eb6
      const chords = [
        { freq: 311.13, start: 0.0, dur: 1.2 }, // Eb4
        { freq: 466.16, start: 0.15, dur: 1.2 }, // Bb4
        { freq: 622.25, start: 0.3, dur: 1.5 }, // Eb5
        { freq: 783.99, start: 0.45, dur: 1.8 }, // G5
        { freq: 932.33, start: 0.6, dur: 2.0 }, // Bb5
        { freq: 1244.5, start: 0.75, dur: 2.4 }  // Eb6
      ];

      const now = this.ctx.currentTime;
      chords.forEach(({ freq, start, dur }) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + start);

        gain.gain.setValueAtTime(0, now + start);
        gain.gain.linearRampToValueAtTime(0.12, now + start + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + dur);
      });
    } catch (e) {}
  }
}

export const sound = new AudioSynth();
