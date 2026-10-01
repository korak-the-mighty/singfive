import { hzToMidi, type PitchFrames } from './yin';

export interface VoiceTrack {
  hopSec: number;
  /** MIDI pitch per frame, NaN where unvoiced. */
  midi: Float32Array;
  db: Float32Array;
  clarity: Float32Array;
  /** Likely start of a sung syllable or note. */
  onset: Uint8Array;
  noiseDb: number;
  levelDb: number;
  peakFrameDb: number;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))));
  return s[i];
}

export function median(values: number[]): number {
  return percentile(values, 50);
}

/** Turn raw YIN frames into a cleaned singing-pitch contour. */
export function buildTrack(frames: PitchFrames): VoiceTrack {
  const n = frames.f0.length;
  const dbs = Array.from(frames.db).filter((v) => v > -119);
  const noiseDb = dbs.length ? percentile(dbs, 5) : -90;
  const levelDb = dbs.length ? percentile(dbs, 90) : -90;
  const peakFrameDb = dbs.length ? Math.max(...dbs) : -90;
  // Voice must stand clear of the room noise, but never demand more than
  // 15 dB below your typical level (soft singing is still singing).
  const gate = Math.max(Math.min(noiseDb + 9, levelDb - 15), levelDb - 32, -62);

  // Clear frames are voiced outright. Breathy or noisy frames (lower clarity)
  // count only when their pitch agrees with their clear-ish neighbours.
  const raw = new Float32Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    const f = frames.f0[i];
    if (f > 0 && frames.clarity[i] >= 0.42 && frames.db[i] >= gate) raw[i] = hzToMidi(f);
  }
  const midi = new Float32Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    if (Number.isNaN(raw[i])) continue;
    if (frames.clarity[i] >= 0.7) {
      midi[i] = raw[i];
      continue;
    }
    const near: number[] = [];
    for (let j = Math.max(0, i - 4); j <= Math.min(n - 1, i + 4); j++) {
      if (j !== i && !Number.isNaN(raw[j])) near.push(raw[j]);
    }
    if (near.length >= 5) {
      const m = median(near);
      if (Math.abs(m - raw[i]) < 1) midi[i] = raw[i];
    }
  }

  // Octave-error correction against a local median of voiced neighbours.
  const radius = 15;
  const fixed = new Float32Array(midi);
  for (let i = 0; i < n; i++) {
    if (Number.isNaN(midi[i])) continue;
    const near: number[] = [];
    for (let j = Math.max(0, i - radius); j <= Math.min(n - 1, i + radius); j++) {
      if (!Number.isNaN(midi[j])) near.push(midi[j]);
    }
    if (near.length < 6) continue;
    const med = median(near);
    const diff = med - midi[i];
    if (Math.abs(diff) > 8) {
      const shifted = midi[i] + 12 * Math.round(diff / 12);
      if (Math.abs(med - shifted) < 4) fixed[i] = shifted;
    }
  }

  // 5-frame median filter inside voiced runs.
  const smooth = new Float32Array(fixed);
  for (let i = 0; i < n; i++) {
    if (Number.isNaN(fixed[i])) continue;
    const win: number[] = [];
    for (let j = i - 2; j <= i + 2; j++) if (j >= 0 && j < n && !Number.isNaN(fixed[j])) win.push(fixed[j]);
    smooth[i] = median(win);
  }

  // Drop voiced islands shorter than 50 ms.
  const minRun = Math.max(3, Math.round(0.05 / frames.hopSec));
  for (let i = 0; i < n; ) {
    if (Number.isNaN(smooth[i])) {
      i++;
      continue;
    }
    let j = i;
    while (j < n && !Number.isNaN(smooth[j])) j++;
    if (j - i < minRun) for (let k = i; k < j; k++) smooth[k] = NaN;
    i = j;
  }

  // Onset hints: voice starting after a gap, a loudness jump, or a held pitch change.
  const onset = new Uint8Array(n);
  const k = Math.max(2, Math.round(0.04 / frames.hopSec));
  for (let i = 1; i < n; i++) {
    if (Number.isNaN(smooth[i])) continue;
    let gap = 0;
    for (let j = i - 1; j >= 0 && Number.isNaN(smooth[j]); j--) gap++;
    if (gap >= k || i === 0) {
      onset[i] = 1;
      continue;
    }
    if (i >= k && i + 1 < n) {
      let dip = Infinity;
      for (let j = i - k; j < i; j++) dip = Math.min(dip, frames.db[j]);
      if (frames.db[i] - dip >= 6 && frames.db[i + 1] >= frames.db[i] - 1) onset[i] = 1;
    }
    if (i >= k && i + k < n && !Number.isNaN(smooth[i - k]) && !Number.isNaN(smooth[i + k])) {
      const before = smooth[i - k];
      const after = smooth[i + k];
      if (Math.abs(after - before) >= 0.8 && Math.abs(smooth[i] - before) < Math.abs(after - before) * 0.6) {
        onset[i] = 1;
      }
    }
  }
  // Keep only the first hint in a cluster.
  for (let i = n - 1; i > 0; i--) {
    if (onset[i]) for (let j = Math.max(0, i - k); j < i; j++) if (onset[j]) onset[i] = 0;
  }

  return { hopSec: frames.hopSec, midi: smooth, db: frames.db, clarity: frames.clarity, onset, noiseDb, levelDb, peakFrameDb };
}
