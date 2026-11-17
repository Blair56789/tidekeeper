// All sound is synthesised with WebAudio: no audio files, no network. Short
// blips for shots, hits and pickups; a soft arpeggio loop under the game; a
// rising jingle for victory and a low one for defeat. Muted until the first
// user gesture, as browsers require.
const NOTE = { C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.0, A4: 440.0, C5: 523.25, E5: 659.25, G5: 783.99 };

export function createAudio() {
  let context = null;
  let master = null;
  let musicGain = null;
  let musicTimer = null;
  let muted = false;
  let musicStep = 0;

  /** A gentle tide arpeggio, one note per step. */
  const MELODY = [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.A4, NOTE.G4, NOTE.E4, NOTE.D4, NOTE.E4];

  function ensure() {
    if (context) {
      if (context.state === 'suspended') void context.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      musicGain = context.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      return true;
    } catch {
      return false;
    }
  }

  function tone({ frequency, endFrequency = null, type = 'sine', duration = 0.15, volume = 0.5, when = 0, toMusic = false }) {
    if (!ensure()) return;
    const start = context.currentTime + when;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency !== null) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain);
    gain.connect(toMusic ? musicGain : master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  function noise({ duration = 0.2, volume = 0.4, lowpass = 1200, when = 0 }) {
    if (!ensure()) return;
    const start = context.currentTime + when;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
  }

  return {
    /** Call on the first user gesture so the context may start. */
    unlock() {
      ensure();
    },
    setMuted(value) {
      muted = value;
      if (master && context) master.gain.setTargetAtTime(muted ? 0 : 0.5, context.currentTime, 0.02);
    },
    isMuted() {
      return muted;
    },
    shoot() {
      tone({ frequency: 880, endFrequency: 660, type: 'triangle', duration: 0.07, volume: 0.12 });
    },
    enemyHit() {
      tone({ frequency: 320, endFrequency: 180, type: 'square', duration: 0.08, volume: 0.12 });
    },
    enemyDie() {
      noise({ duration: 0.18, volume: 0.25, lowpass: 900 });
      tone({ frequency: 220, endFrequency: 60, type: 'sine', duration: 0.18, volume: 0.3 });
    },
    playerHit() {
      tone({ frequency: 160, endFrequency: 70, type: 'sawtooth', duration: 0.25, volume: 0.4 });
      noise({ duration: 0.2, volume: 0.3, lowpass: 600 });
    },
    pickup() {
      tone({ frequency: 1320, endFrequency: 1760, type: 'sine', duration: 0.09, volume: 0.16 });
    },
    heart() {
      tone({ frequency: 523.25, type: 'sine', duration: 0.12, volume: 0.25 });
      tone({ frequency: 783.99, type: 'sine', duration: 0.18, volume: 0.25, when: 0.09 });
    },
    levelUp() {
      [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C5 * 2].forEach((frequency, i) => {
        tone({ frequency, type: 'triangle', duration: 0.16, volume: 0.28, when: i * 0.08 });
      });
    },
    burst() {
      noise({ duration: 0.35, volume: 0.4, lowpass: 2400 });
      tone({ frequency: 120, endFrequency: 480, type: 'sine', duration: 0.3, volume: 0.35 });
    },
    waveStart() {
      tone({ frequency: NOTE.C4, type: 'triangle', duration: 0.2, volume: 0.3 });
      tone({ frequency: NOTE.G4, type: 'triangle', duration: 0.25, volume: 0.3, when: 0.12 });
    },
    bossRoar() {
      tone({ frequency: 90, endFrequency: 45, type: 'sawtooth', duration: 0.9, volume: 0.5 });
      noise({ duration: 0.8, volume: 0.3, lowpass: 400 });
    },
    click() {
      tone({ frequency: 660, type: 'sine', duration: 0.06, volume: 0.2 });
    },
    win() {
      [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.C5, NOTE.E5, NOTE.G5].forEach((frequency, i) => {
        tone({ frequency, type: 'triangle', duration: 0.3, volume: 0.3, when: i * 0.13 });
      });
    },
    lose() {
      [NOTE.E4, NOTE.D4, NOTE.C4, NOTE.C4 / 2].forEach((frequency, i) => {
        tone({ frequency, type: 'sine', duration: 0.4, volume: 0.3, when: i * 0.22 });
      });
    },
    startMusic() {
      if (!ensure() || musicTimer !== null) return;
      musicTimer = window.setInterval(() => {
        if (muted) return;
        const frequency = MELODY[musicStep % MELODY.length];
        tone({ frequency, type: 'sine', duration: 0.9, volume: 0.5, toMusic: true });
        if (musicStep % 4 === 0) tone({ frequency: frequency / 2, type: 'sine', duration: 1.4, volume: 0.4, toMusic: true });
        musicStep += 1;
      }, 520);
    },
    stopMusic() {
      if (musicTimer !== null) {
        window.clearInterval(musicTimer);
        musicTimer = null;
      }
    },
  };
}
