/**
 * Yalla Center - Procedural Web Audio API Sound Synthesis Engine
 * Path: lib/attendance/audio.ts
 *
 * Clean procedural audio chimes for reception attendance without external MP3/WAV files.
 * Provides Success, Warning, and Error chimes with browser autoplay unlock.
 */

let audioCtx: AudioContext | null = null;
let isAudioMuted: boolean = false;
const globalVolume: number = 0.8;

// Initialize mute state from localStorage if available
if (typeof window !== 'undefined') {
  try {
    isAudioMuted = localStorage.getItem('yc_reception_muted') === 'true';
  } catch {
    isAudioMuted = false;
  }
}

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function setMuted(muted: boolean): void {
  isAudioMuted = muted;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('yc_reception_muted', String(muted));
    } catch {
      // ignore localStorage quota or permission errors
    }
  }
}

export function getMuted(): boolean {
  return isAudioMuted;
}

export function toggleMuted(): boolean {
  setMuted(!isAudioMuted);
  return isAudioMuted;
}

/**
 * Procedural Success Chime (Major Triad Ascending: C6 -> E6 -> G6)
 * Synthesizes a crisp, positive check-in confirmation (~350ms).
 */
export function playSuccessChime(): void {
  if (isAudioMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [
    { freq: 1046.5, time: now, dur: 0.12 },        // C6
    { freq: 1318.5, time: now + 0.08, dur: 0.12 }, // E6
    { freq: 1568.0, time: now + 0.16, dur: 0.22 }, // G6
  ];

  notes.forEach(({ freq, time, dur }) => {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.25 * globalVolume, time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(time);
      osc.stop(time + dur + 0.05);
    } catch {
      // Audio node scheduling guard
    }
  });
}

/**
 * Procedural Warning Chime (Dual Pulse Attention Alert: 580Hz -> 720Hz)
 * Synthesizes a warm cautionary double-chime for overdue balances (~300ms).
 */
export function playWarningChime(): void {
  if (isAudioMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const pulses = [
    { freq: 580, time: now, dur: 0.09 },
    { freq: 720, time: now + 0.12, dur: 0.14 },
  ];

  pulses.forEach(({ freq, time, dur }) => {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.3 * globalVolume, time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(time);
      osc.stop(time + dur + 0.05);
    } catch {
      // Audio node scheduling guard
    }
  });
}

/**
 * Procedural Error Chime (Descending Sawtooth Buzz: 220Hz -> 110Hz with Lowpass Filter)
 * Synthesizes a low-pitch rejection tone for unregistered codes (~250ms).
 */
export function playErrorChime(): void {
  if (isAudioMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.22);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(750, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.35 * globalVolume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  } catch {
    // Audio node scheduling guard
  }
}
