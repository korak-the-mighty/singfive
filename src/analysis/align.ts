// Match a sung pitch contour to the song's reference melody.
//
// The singer may choose any key, any octave and their own tempo, so we search
// for the transposition that fits best and then run a left-to-right Viterbi
// alignment where each melody note (or rest) is a state that absorbs frames.

import type { RefNote } from '../types';
import { median, type VoiceTrack } from './track';

export interface Alignment {
  /** Semitones between the reference key and the key actually sung. */
  key: number;
  /** For each reference note index: [startFrame, endFrame) or null if skipped. */
  spans: ([number, number] | null)[];
  /** Share of voiced frames that sat within a semitone of their note. */
  fit: number;
  /** Share of melody notes that received some voice. */
  coverage: number;
  /** Share of notes whose length is within 2× of what the melody expects at your tempo. */
  rhythm: number;
  score: number;
  matched: boolean;
  /** Frame range that contains singing. */
  active: [number, number];
}

interface State {
  ref: number; // index into notes, −1 for lead/tail silence
  midi: number; // NaN for silence/rest
  start: number; // beats
  end: number; // beats
}

const BIG = 1e9;

function emission(u: number, state: State, key: number): number {
  const voiced = !Number.isNaN(u);
  if (Number.isNaN(state.midi)) return voiced ? 2.0 : 0.05;
  if (!voiced) return 0.9;
  const target = state.midi + key;
  const d1 = Math.abs(u - target);
  const d2 = Math.min(Math.abs(u - target - 12), Math.abs(u - target + 12)) + 0.75;
  return Math.min(Math.min(d1, d2), 3);
}

function viterbi(track: VoiceTrack, states: State[], key: number, a: number, b: number, beatScale: number, t0: number) {
  const T = b - a;
  const S = states.length;
  const hop = track.hopSec;
  const cost = new Float64Array(S).fill(BIG);
  const next = new Float64Array(S);
  const back = new Int16Array(T * S);
  cost[0] = 0;
  cost[1] = 0;

  for (let ti = 0; ti < T; ti++) {
    const i = a + ti;
    const u = track.midi[i];
    const tRel = i * hop - t0;
    const tol = Math.max(0.5, 0.15 * Math.abs(tRel));
    const onsetBonus = track.onset[i] ? 0.45 : 0;
    for (let s = 0; s < S; s++) {
      // Best predecessor: stay, advance one, or skip one.
      let best = cost[s];
      let arg = s;
      if (s >= 1) {
        const adv = cost[s - 1] + 0.6 - onsetBonus;
        if (adv < best) {
          best = adv;
          arg = s - 1;
        }
      }
      if (s >= 2) {
        const skipped = states[s - 1];
        const skipCost = Number.isNaN(skipped.midi) ? 0.2 : 3.5;
        const sk = cost[s - 2] + skipCost - onsetBonus;
        if (sk < best) {
          best = sk;
          arg = s - 2;
        }
      }
      const st = states[s];
      let prior = 0;
      if (st.ref >= 0) {
        const lo = st.start * beatScale;
        const hi = st.end * beatScale;
        const out = tRel < lo ? lo - tRel : tRel > hi ? tRel - hi : 0;
        if (out > tol) prior = 0.8 * (out - tol);
      }
      next[s] = best + emission(u, st, key) + prior;
      back[ti * S + s] = arg;
    }
    cost.set(next);
  }

  // Finish in the tail silence or on the last note.
  let end = S - 1;
  if (cost[S - 2] < cost[S - 1]) end = S - 2;
  const total = cost[end];
  const path = new Int16Array(T);
  let s = end;
  for (let ti = T - 1; ti >= 0; ti--) {
    path[ti] = s;
    s = back[ti * S + s];
  }
  return { total, path };
}

export function align(track: VoiceTrack, notes: RefNote[]): Alignment {
  const n = track.midi.length;
  const empty: Alignment = { key: 0, spans: notes.map(() => null), fit: 0, coverage: 0, rhythm: 0, score: 0, matched: false, active: [0, 0] };
  let first = -1;
  let last = -1;
  for (let i = 0; i < n; i++) {
    if (!Number.isNaN(track.midi[i])) {
      if (first < 0) first = i;
      last = i;
    }
  }
  if (first < 0 || last - first < 10) return empty;

  const pad = Math.round(0.15 / track.hopSec);
  const a = Math.max(0, first - pad);
  const b = Math.min(n, last + pad + 1);

  // States: lead silence, every note/rest, tail silence.
  const states: State[] = [{ ref: -1, midi: NaN, start: 0, end: 0 }];
  notes.forEach((nt, idx) =>
    states.push({ ref: idx, midi: nt.rest ? NaN : nt.midi, start: nt.start, end: nt.start + nt.beats }),
  );
  const totalBeats = notes[notes.length - 1].start + notes[notes.length - 1].beats;
  states.push({ ref: -1, midi: NaN, start: totalBeats, end: totalBeats });

  // Time scaling: the singer's own tempo, assuming they sang the whole section.
  const t0 = first * track.hopSec;
  const sungSec = (last - first) * track.hopSec;
  const beatScale = Math.max(0.2, sungSec / totalBeats); // seconds per beat

  // Initial key guess: compare medians, weighted by note length.
  const voiced: number[] = [];
  for (let i = first; i <= last; i++) if (!Number.isNaN(track.midi[i])) voiced.push(track.midi[i]);
  const weighted: number[] = [];
  for (const nt of notes) if (!nt.rest) for (let k = 0; k < Math.max(1, Math.round(nt.beats * 4)); k++) weighted.push(nt.midi);
  const k0 = median(voiced) - median(weighted);

  let bestKey = k0;
  let bestRun: ReturnType<typeof viterbi> | null = null;
  for (let d = -3; d <= 3; d += 1) {
    const run = viterbi(track, states, k0 + d, a, b, beatScale, t0);
    if (!bestRun || run.total < bestRun.total) {
      bestRun = run;
      bestKey = k0 + d;
    }
  }

  // Refine the key from the frames themselves, then align once more.
  for (let pass = 0; pass < 2; pass++) {
    const resid: number[] = [];
    bestRun!.path.forEach((s, ti) => {
      const st = states[s];
      const u = track.midi[a + ti];
      if (Number.isNaN(st.midi) || Number.isNaN(u)) return;
      let r = u - st.midi;
      r -= 12 * Math.round((r - bestKey) / 12);
      if (Math.abs(r - bestKey) < 1.5) resid.push(r);
    });
    if (resid.length > 10) bestKey = median(resid);
    bestRun = viterbi(track, states, bestKey, a, b, beatScale, t0);
  }

  const path = bestRun!.path;
  const spans: ([number, number] | null)[] = notes.map(() => null);
  for (let ti = 0; ti < path.length; ti++) {
    const ref = states[path[ti]].ref;
    if (ref < 0) continue;
    const f = a + ti;
    const cur = spans[ref];
    if (!cur) spans[ref] = [f, f + 1];
    else cur[1] = f + 1;
  }

  let inNote = 0;
  let close = 0;
  let sungNotes = 0;
  let covered = 0;
  notes.forEach((nt, idx) => {
    if (nt.rest) return;
    sungNotes++;
    const sp = spans[idx];
    if (!sp) return;
    let v = 0;
    for (let f = sp[0]; f < sp[1]; f++) {
      const u = track.midi[f];
      if (Number.isNaN(u)) continue;
      v++;
      inNote++;
      const target = nt.midi + bestKey;
      const d = Math.min(Math.abs(u - target), Math.abs(u - target - 12), Math.abs(u - target + 12));
      if (d <= 1) close++;
    }
    if (v >= 3 && v >= 0.25 * (sp[1] - sp[0])) covered++;
  });
  const fit = inNote ? close / inNote : 0;
  const coverage = sungNotes ? covered / sungNotes : 0;
  // A different melody can be forced onto the notes, but only by squashing
  // and stretching them wildly. A real attempt keeps lengths roughly in proportion.
  let inProportion = 0;
  notes.forEach((nt, idx) => {
    if (nt.rest) return;
    const sp = spans[idx];
    if (!sp) return;
    const ratio = ((sp[1] - sp[0]) * track.hopSec) / (nt.beats * beatScale);
    if (ratio >= 0.5 && ratio <= 2) inProportion++;
  });
  const rhythm = sungNotes ? inProportion / sungNotes : 0;
  const score = 0.4 * fit + 0.3 * coverage + 0.3 * rhythm;
  return {
    key: bestKey,
    spans,
    fit,
    coverage,
    rhythm,
    score,
    // Calibrated on synthetic takes: genuine loose singing scores ≥ 2.9 in total,
    // a different melody forced onto the song ≤ 2.2.
    matched: fit >= 0.55 && coverage >= 0.6 && rhythm >= 0.6 && fit + coverage + rhythm >= 2.35,
    active: [first, last + 1],
  };
}
