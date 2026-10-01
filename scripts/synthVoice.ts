// A small synthetic singer used to test FIVE's listening.
//
// It sings a song section with controlled, known faults (flat high notes,
// wobbly long notes, rushing, a different key) so tests can check that the
// analysis reports what was actually put into the audio.

import type { RefNote } from '../src/types';

export interface SynthOptions {
  sampleRate?: number;
  /** Semitones relative to the reference key (e.g. −12 for a lower voice). */
  key?: number;
  bpm: number;
  /** Silence before the first note, seconds. */
  lead?: number;
  tail?: number;
  /** Cents offset for a note, given its index and reference MIDI. */
  offCents?: (i: number, midi: number) => number;
  /** Vibrato on notes longer than 0.45 s. */
  vibrato?: { rateHz: number; cents: number } | null;
  /** Slow random wander inside notes, cents (std). */
  wanderCents?: number;
  /** Extra wander applied to notes for which this returns true. */
  shaky?: (i: number, midi: number) => number;
  /** Tempo multiplier at the end of the section (1.2 = 20% faster by the end). */
  tempoEnd?: number;
  /** Indices of notes to leave out. */
  omit?: Set<number>;
  /** Loudness in dB relative to normal, per note. */
  loudness?: (i: number, midi: number) => number;
  /** Breath noise mixed into the voice, 0–1. */
  breathy?: number;
  /** Overall level in dBFS for the voice peak. */
  levelDb?: number;
  noiseDb?: number;
  seed?: number;
  /** Shift the end of each long note by this many cents (sag). */
  endSag?: (i: number, midi: number) => number;
  /** Stretch individual notes (rubato, held notes). */
  durMul?: (i: number, midi: number) => number;
  /** Random pitch error per note, cents (standard deviation). */
  sloppyCents?: number;
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
}

const FORMANTS = [
  { f: 730, bw: 90, g: 1 },
  { f: 1090, bw: 110, g: 0.5 },
  { f: 2440, bw: 170, g: 0.25 },
];

function formantGain(freq: number): number {
  let g = 0.08;
  for (const fm of FORMANTS) {
    const x = (freq - fm.f) / (fm.bw / 2);
    g += fm.g / (1 + x * x);
  }
  return g;
}

export function synthSing(notes: RefNote[], o: SynthOptions): Float32Array {
  const sr = o.sampleRate ?? 16000;
  const key = o.key ?? 0;
  const lead = o.lead ?? 0.6;
  const tail = o.tail ?? 0.6;
  const rand = rng(o.seed ?? 7);
  const beatSec0 = 60 / o.bpm;
  const totalBeats = notes[notes.length - 1].start + notes[notes.length - 1].beats;
  const tempoEnd = o.tempoEnd ?? 1;

  // Beat → time with a linear tempo change across the section.
  const beatTime = (beat: number) => {
    const steps = 200;
    let t = 0;
    for (let k = 0; k < steps; k++) {
      const b0 = (beat * k) / steps;
      const frac = b0 / totalBeats;
      const tempoMul = 1 + (tempoEnd - 1) * frac;
      t += (beat / steps) * (beatSec0 / tempoMul);
    }
    return t;
  };


  // Per-note plan.
  interface Plan {
    t0: number;
    t1: number;
    midi: number;
    amp: number;
    syllable: boolean;
    sung: boolean;
    wander: number;
    sag: number;
  }
  // Note timeline, with optional per-note stretching.
  const starts: number[] = [];
  const ends: number[] = [];
  let shiftSec = 0;
  notes.forEach((n, i) => {
    const a = beatTime(n.start);
    const b = beatTime(n.start + n.beats);
    const mul = o.durMul ? o.durMul(i, n.midi) : 1;
    starts.push(lead + a + shiftSec);
    shiftSec += (b - a) * (mul - 1);
    ends.push(lead + b + shiftSec);
  });
  const plans: Plan[] = notes.map((n, i) => ({
    t0: starts[i],
    t1: ends[i],
    midi: n.rest ? NaN : n.midi + key + (o.offCents ? o.offCents(i, n.midi) / 100 : 0) + (o.sloppyCents ? (rand() * Math.sqrt(3) * o.sloppyCents) / 100 : 0),
    amp: Math.pow(10, (o.loudness ? o.loudness(i, n.midi) : 0) / 20),
    syllable: !!n.lyric,
    sung: !n.rest && !(o.omit?.has(i) ?? false),
    wander: (o.wanderCents ?? 4) + (o.shaky && !n.rest ? o.shaky(i, n.midi) : 0),
    sag: o.endSag && !n.rest ? o.endSag(i, n.midi) : 0,
  }));

  const len = Math.ceil((ends[ends.length - 1] + tail) * sr);
  const out = new Float32Array(len);
  const peak = Math.pow(10, (o.levelDb ?? -12) / 20);
  const noiseAmp = Math.pow(10, (o.noiseDb ?? -62) / 20);
  let phase = 0;
  let curMidi = plans.find((p) => p.sung)?.midi ?? 60;
  // Slow random wander: smoothed noise per note.
  let wanderState = 0;
  let breathLp = 0;
  const harmPhases = new Float64Array(64);

  for (let s = 0; s < len; s++) {
    const t = s / sr;
    // Which note is active?
    let p: Plan | null = null;
    for (const pl of plans) if (t >= pl.t0 && t < pl.t1) {
      p = pl;
      break;
    }
    let env = 0;
    let target = curMidi;
    if (p && p.sung) {
      const dur = p.t1 - p.t0;
      const local = t - p.t0;
      const gap = p.syllable ? 0.05 : 0; // consonant
      const attack = 0.03;
      const release = 0.05;
      if (local < gap) env = 0;
      else env = Math.min(1, (local - gap) / attack) * Math.min(1, (p.t1 - t) / release);
      target = p.midi;
      // Vibrato after the first 250 ms of a long note.
      if (o.vibrato && dur > 0.45 && local > 0.25) {
        const ramp = Math.min(1, (local - 0.25) / 0.2);
        target += (ramp * o.vibrato.cents * Math.SQRT2 * Math.sin(2 * Math.PI * o.vibrato.rateHz * local)) / 100;
      }
      if (p.sag && dur > 0.6) target += (p.sag / 100) * Math.max(0, (local - dur * 0.5) / (dur * 0.5));
      env *= p.amp;
    }
    // Portamento toward target.
    const glide = 1 - Math.exp(-1 / (0.025 * sr));
    curMidi += (target - curMidi) * glide;
    // Wander: low-passed noise, scaled per note.
    const w = p?.wander ?? 4;
    // Ornstein–Uhlenbeck process: unit variance, ~0.15 s memory.
    const dt = 1 / sr;
    const tau = 0.15;
    wanderState += (-wanderState * dt) / tau + Math.sqrt((2 * dt) / tau) * rand() * Math.sqrt(3);
    const wander = (wanderState * w) / 100;
    const f0 = 440 * Math.pow(2, (curMidi + wander - 69) / 12);
    phase += f0 / sr;
    if (phase > 1e6) phase -= 1e6;

    let v = 0;
    if (env > 0) {
      const kMax = Math.min(48, Math.floor(4200 / f0));
      for (let k = 1; k <= kMax; k++) {
        harmPhases[k] = phase * k;
        const a = formantGain(k * f0) / Math.pow(k, 0.9);
        v += a * Math.sin(2 * Math.PI * harmPhases[k]);
      }
      v *= 0.18;
      if (o.breathy) {
        breathLp += (rand() - breathLp) * 0.3;
        v += breathLp * o.breathy * 0.5;
      }
    }
    // Consonant noise at syllable starts.
    let cons = 0;
    if (p && p.sung && p.syllable && t - p.t0 < 0.05) cons = rand() * 0.04 * p.amp;
    out[s] = v * env + cons;
  }
  // Normalise the voice to the requested peak, then add room noise.
  let max = 0;
  for (let s = 0; s < len; s++) max = Math.max(max, Math.abs(out[s]));
  const gain = max > 0 ? peak / max : 0;
  for (let s = 0; s < len; s++) out[s] = out[s] * gain + rand() * noiseAmp;
  return out;
}

export function encodeWav(pcm: Float32Array, sampleRate: number): Uint8Array {
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  v.setUint32(4, 36 + pcm.length * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 32767, true);
  return new Uint8Array(buf);
}
