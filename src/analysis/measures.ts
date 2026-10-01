// Per-note results and take-level measurements, computed from the pitch
// contour and its alignment to the melody. Everything here is a measurement;
// interpretation happens in the coach.

import type { Measures, NoteResult, RefNote, RegisterStats } from '../types';
import { wordsAround } from '../songs/notation';
import type { Alignment } from './align';
import { median, type VoiceTrack } from './track';

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const std = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
const round1 = (x: number | null) => (x == null ? null : Math.round(x * 10) / 10);

function movingAverage(xs: number[], w: number): number[] {
  const half = Math.floor(w / 2);
  return xs.map((_, i) => {
    let s = 0;
    let c = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(xs.length - 1, i + half); j++) {
      s += xs[j];
      c++;
    }
    return s / c;
  });
}

function linfit(xs: number[], ys: number[]): { a: number; b: number } | null {
  if (xs.length < 2) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den < 1e-9) return null;
  const b = num / den;
  return { a: my - b * mx, b };
}

interface Vib {
  rateHz: number;
  sizeCents: number;
}

function detectVibrato(resid: number[], hop: number): Vib | null {
  if (resid.length * hop < 0.7) return null;
  const s = std(resid);
  if (s * 100 < 10) return null;
  const minLag = Math.round(0.11 / hop);
  const maxLag = Math.round(0.25 / hop);
  const m = mean(resid);
  const x = resid.map((v) => v - m);
  let e = 0;
  for (const v of x) e += v * v;
  let bestR = 0;
  let bestLag = 0;
  for (let lag = minLag; lag <= maxLag && lag < x.length - 4; lag++) {
    let c = 0;
    for (let i = 0; i + lag < x.length; i++) c += x[i] * x[i + lag];
    const r = c / e;
    if (r > bestR) {
      bestR = r;
      bestLag = lag;
    }
  }
  if (bestR < 0.35) return null;
  return { rateHz: 1 / (bestLag * hop), sizeCents: s * 100 * Math.SQRT2 };
}

export interface MeasureInput {
  track: VoiceTrack;
  alignment: Alignment;
  notes: RefNote[];
  /** Seconds into the recording where the first note was due (count-in), if known. */
  firstNoteAt: number | null;
  strictTime: boolean;
}

export function measureTake({ track, alignment, notes, firstNoteAt }: MeasureInput): {
  notes: NoteResult[];
  measures: Measures;
  vibratoNotes: Vib[];
} {
  const hop = track.hopSec;
  const key = alignment.key;
  const results: NoteResult[] = [];
  const vibs: Vib[] = [];

  notes.forEach((nt, idx) => {
    if (nt.rest) return;
    const expected = nt.midi + key;
    const span = alignment.spans[idx];
    const base: NoteResult = {
      ref: idx,
      expected,
      sung: null,
      offCents: null,
      wanderCents: null,
      wobbleCents: null,
      octaveJump: false,
      onset: null,
      timingMs: null,
      duration: span ? (span[1] - span[0]) * hop : 0,
      expectedDuration: 0,
      voiced: 0,
      db: null,
      endDriftCents: null,
      scoop: false,
      status: 'missed',
    };
    if (!span) {
      results.push(base);
      return;
    }
    const frames: number[] = [];
    for (let f = span[0]; f < span[1]; f++) if (!Number.isNaN(track.midi[f])) frames.push(f);
    base.voiced = frames.length / Math.max(1, span[1] - span[0]);
    if (frames.length < 3) {
      results.push(base);
      return;
    }
    const raw = frames.map((f) => track.midi[f]);
    const unwrapped = raw.map((u) => u - 12 * Math.round((u - expected) / 12));
    let lo = 0;
    let hi = unwrapped.length;
    if (unwrapped.length >= 8) {
      lo = Math.floor(unwrapped.length * 0.2);
      hi = Math.ceil(unwrapped.length * 0.85);
    }
    const central = unwrapped.slice(lo, hi);
    const sungU = median(central);
    const sungRaw = median(raw.slice(lo, hi));
    base.sung = sungRaw;
    base.octaveJump = Math.abs(sungRaw - expected) > 6;
    base.offCents = Math.round((sungU - expected) * 100);
    base.status = Math.abs(base.offCents) >= 85 ? 'different' : 'sung';
    base.onset = frames[0] * hop;
    base.db = mean(frames.map((f) => track.db[f]));

    // Steadiness inside the note.
    if (central.length * hop >= 0.3) {
      const win = Math.max(3, Math.round(0.18 / hop));
      const slow = movingAverage(central, win);
      base.wanderCents = Math.round(std(slow) * 100);
      const resid = central.map((v, i) => v - slow[i]);
      base.wobbleCents = Math.round(std(resid) * 100);
      const v = detectVibrato(resid, hop);
      if (v) vibs.push(v);
    }
    // Long notes: does the end drift?
    if (central.length * hop >= 0.8) {
      const a = central.slice(0, Math.floor(central.length * 0.5));
      const b = central.slice(Math.floor(central.length * 0.7));
      base.endDriftCents = Math.round((median(b) - median(a)) * 100);
    }
    // Scoop: starting clearly below and sliding up, when not coming from a lower note.
    const early = median(unwrapped.slice(0, Math.min(5, unwrapped.length)));
    const prev = results.length ? results[results.length - 1] : null;
    const prevLower = prev && prev.sung != null && prev.expected < expected - 0.5;
    if (sungU - early >= 0.6 && !prevLower) base.scoop = true;
    results.push(base);
  });

  // --- Timing: fit your own steady beat through clear onsets --------------------
  const clear = results.filter((r, i) => {
    if (r.onset == null || r.status === 'missed') return false;
    const nt = notes[r.ref];
    const prev = i > 0 ? results[i - 1] : null;
    return !!nt.lyric || !prev || Math.abs(notes[prev.ref].midi - nt.midi) >= 1;
  });
  let fit = linfit(
    clear.map((r) => notes[r.ref].start),
    clear.map((r) => r.onset!),
  );
  if (fit) {
    // One robust refit without outliers.
    const keep = clear.filter((r) => Math.abs(r.onset! - (fit!.a + fit!.b * notes[r.ref].start)) < 0.35);
    const refit = linfit(
      keep.map((r) => notes[r.ref].start),
      keep.map((r) => r.onset!),
    );
    if (refit && refit.b > 0) fit = refit;
  }
  const beatSec = fit && fit.b > 0.15 && fit.b < 2.5 ? fit.b : null;
  for (const r of results) {
    const nt = notes[r.ref];
    if (beatSec) r.expectedDuration = nt.beats * beatSec;
    if (beatSec && fit && clear.includes(r)) r.timingMs = Math.round((r.onset! - (fit.a + fit.b * nt.start)) * 1000);
  }
  const timingResid = results.filter((r) => r.timingMs != null).map((r) => Math.abs(r.timingMs!));
  let tempoChangePct: number | null = null;
  if (clear.length >= 10) {
    const half = Math.floor(clear.length / 2);
    const f1 = linfit(
      clear.slice(0, half).map((r) => notes[r.ref].start),
      clear.slice(0, half).map((r) => r.onset!),
    );
    const f2 = linfit(
      clear.slice(half).map((r) => notes[r.ref].start),
      clear.slice(half).map((r) => r.onset!),
    );
    if (f1 && f2 && f1.b > 0 && f2.b > 0) tempoChangePct = Math.round((f1.b / f2.b - 1) * 100);
  }
  const firstSung = results.find((r) => r.status !== 'missed');
  const entranceMs =
    firstNoteAt != null && firstSung && firstSung === results[0] && firstSung.onset != null
      ? Math.round((firstSung.onset - firstNoteAt) * 1000)
      : null;

  // --- Tuning --------------------------------------------------------------------
  const tuned = results.filter((r) => r.status === 'sung');
  const offs = tuned.map((r) => r.offCents!);
  let keyDriftCents: number | null = null;
  if (tuned.length >= 6) {
    const f = linfit(
      tuned.map((r) => r.onset!),
      offs,
    );
    const t0 = tuned[0].onset!;
    const t1 = tuned[tuned.length - 1].onset!;
    if (f && t1 - t0 > 4) keyDriftCents = Math.round(f.b * (t1 - t0));
  }

  // --- Registers: thirds of the melody's span, as sung ----------------------------
  const exp = results.map((r) => r.expected);
  const lo = Math.min(...exp);
  const hi = Math.max(...exp);
  const cut1 = lo + (hi - lo) / 3;
  const cut2 = lo + (2 * (hi - lo)) / 3;
  const band = (pred: (e: number) => boolean): RegisterStats => {
    const rs = results.filter((r) => pred(r.expected));
    const sung = rs.filter((r) => r.status === 'sung');
    const w = sung.map((r) => r.wanderCents).filter((x): x is number => x != null);
    const d = rs.map((r) => r.db).filter((x): x is number => x != null);
    return {
      n: sung.length,
      meanOff: sung.length ? Math.round(mean(sung.map((r) => Math.abs(r.offCents!)))) : null,
      bias: sung.length ? Math.round(median(sung.map((r) => r.offCents!))) : null,
      wander: w.length ? Math.round(median(w)) : null,
      db: d.length ? round1(mean(d)) : null,
      low: rs.length ? Math.min(...rs.map((r) => r.expected)) : NaN,
      high: rs.length ? Math.max(...rs.map((r) => r.expected)) : NaN,
    };
  };
  const registers = {
    low: band((e) => e < cut1 - 0.01),
    mid: band((e) => e >= cut1 - 0.01 && e <= cut2 + 0.01),
    high: band((e) => e > cut2 + 0.01),
  };

  // --- Intervals -------------------------------------------------------------------
  const steps: number[] = [];
  const ups: number[] = [];
  const downs: number[] = [];
  let worst: Measures['worstInterval'] = null;
  for (let i = 1; i < results.length; i++) {
    const a = results[i - 1];
    const b = results[i];
    if (a.status !== 'sung' || b.status !== 'sung') continue;
    const refInt = notes[b.ref].midi - notes[a.ref].midi;
    if (refInt === 0) continue;
    const err = b.offCents! - a.offCents!;
    if (Math.abs(refInt) <= 2) steps.push(err);
    else if (refInt > 0) ups.push(err);
    else downs.push(err);
    if (Math.abs(refInt) >= 3 && Math.abs(err) >= 40 && (!worst || Math.abs(err) > Math.abs(worst.errCents))) {
      worst = { from: a.ref, to: b.ref, errCents: err, words: wordsAround(notes, b.ref, 2) };
    }
  }
  const absMean = (xs: number[]) => (xs.length ? Math.round(mean(xs.map(Math.abs))) : null);
  const sMean = (xs: number[]) => (xs.length ? Math.round(mean(xs)) : null);

  // --- Long notes ---------------------------------------------------------------------
  const longs = results.filter((r) => r.status === 'sung' && notes[r.ref].beats * (beatSec ?? 0.6) >= 0.9);
  const lw = longs.map((r) => r.wanderCents).filter((x): x is number => x != null);
  const ld = longs.map((r) => r.endDriftCents).filter((x): x is number => x != null);
  const held = longs.filter((r) => r.expectedDuration > 0).map((r) => Math.min(1.5, (r.duration * r.voiced) / r.expectedDuration));

  // --- Breath and phrases --------------------------------------------------------------
  const gapSec = 0.3;
  let midPhraseBreaks = 0;
  for (let i = 1; i < results.length; i++) {
    const a = results[i - 1];
    const b = results[i];
    const between = notes.slice(a.ref, b.ref).some((n) => n.rest || n.breath);
    if (between || a.status === 'missed' || b.status === 'missed') continue;
    const spA = alignment.spans[a.ref]!;
    let lastVoiced = -1;
    for (let f = spA[1] - 1; f >= spA[0]; f--) if (!Number.isNaN(track.midi[f])) {
      lastVoiced = f;
      break;
    }
    if (lastVoiced >= 0 && b.onset != null && b.onset - lastVoiced * hop >= gapSec) midPhraseBreaks++;
  }
  let longestPhrase = 0;
  {
    const [a0, a1] = alignment.active;
    let runStart = -1;
    let gap = 0;
    for (let f = a0; f < a1; f++) {
      const v = !Number.isNaN(track.midi[f]);
      if (v) {
        if (runStart < 0) runStart = f;
        gap = 0;
      } else if (runStart >= 0) {
        gap++;
        if (gap * hop >= gapSec) {
          longestPhrase = Math.max(longestPhrase, (f - gap - runStart) * hop);
          runStart = -1;
          gap = 0;
        }
      }
    }
    if (runStart >= 0) longestPhrase = Math.max(longestPhrase, (a1 - gap - runStart) * hop);
  }

  // --- Loudness and tone -----------------------------------------------------------------
  const vdb: number[] = [];
  const vclar: number[] = [];
  for (let f = alignment.active[0]; f < alignment.active[1]; f++) {
    if (!Number.isNaN(track.midi[f])) {
      vdb.push(track.db[f]);
      vclar.push(track.clarity[f]);
    }
  }
  vdb.sort((x, y) => x - y);
  const p = (q: number) => vdb[Math.min(vdb.length - 1, Math.floor(q * (vdb.length - 1)))];
  const loudnessRangeDb = vdb.length > 20 ? round1(p(0.9) - p(0.1)) : null;
  const breathiness = vclar.length > 20 ? Math.max(0, Math.min(1, (0.985 - median(vclar)) / 0.2)) : null;

  const sungAll = results.filter((r) => r.sung != null);
  const vib = vibs.length >= 2 ? { rateHz: median(vibs.map((v) => v.rateHz)), sizeCents: median(vibs.map((v) => v.sizeCents)) } : null;

  const measures: Measures = {
    keyShift: Math.round(key * 100) / 100,
    lowMidi: sungAll.length ? Math.min(...sungAll.map((r) => r.sung!)) : null,
    highMidi: sungAll.length ? Math.max(...sungAll.map((r) => r.sung!)) : null,
    meanOffCents: offs.length ? Math.round(mean(offs.map(Math.abs))) : null,
    inTuneShare: offs.length ? Math.round((offs.filter((o) => Math.abs(o) <= 35).length / offs.length) * 100) / 100 : null,
    biasCents: offs.length ? Math.round(median(offs)) : null,
    keyDriftCents,
    wanderCents: (() => {
      const w = results.map((r) => r.wanderCents).filter((x): x is number => x != null);
      return w.length ? Math.round(median(w)) : null;
    })(),
    longNotes: {
      count: longs.length,
      wanderCents: lw.length ? Math.round(median(lw)) : null,
      endDriftCents: ld.length ? Math.round(median(ld)) : null,
      heldShare: held.length ? Math.round(mean(held) * 100) / 100 : null,
    },
    vibrato: { present: !!vib, rateHz: vib ? round1(vib.rateHz) : null, sizeCents: vib ? Math.round(vib.sizeCents) : null },
    registers,
    steps: { n: steps.length, meanErr: absMean(steps) },
    leapsUp: { n: ups.length, meanErr: absMean(ups), bias: sMean(ups) },
    leapsDown: { n: downs.length, meanErr: absMean(downs), bias: sMean(downs) },
    worstInterval: worst,
    tempoBpm: beatSec ? Math.round(60 / beatSec) : null,
    tempoChangePct,
    timingSpreadMs: timingResid.length >= 5 ? Math.round(median(timingResid)) : null,
    entranceMs,
    loudnessRangeDb,
    highVsMidDb: registers.high.db != null && registers.mid.db != null ? round1(registers.high.db - registers.mid.db) : null,
    midPhraseBreaks,
    longestPhraseSec: longestPhrase > 0 ? round1(longestPhrase) : null,
    scoopShare: tuned.length ? Math.round((tuned.filter((r) => r.scoop).length / tuned.length) * 100) / 100 : null,
    missedShare: results.length ? Math.round((results.filter((r) => r.status === 'missed').length / results.length) * 100) / 100 : 1,
    differentNotes: results.filter((r) => r.status === 'different').length,
    octaveJumps: results.filter((r) => r.octaveJump && r.status !== 'missed').length,
    breathiness: breathiness == null ? null : Math.round(breathiness * 100) / 100,
  };
  return { notes: results, measures, vibratoNotes: vibs };
}
