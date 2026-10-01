// analyzeTake: from raw microphone samples to measurements of one take of one song.

import type { RefNote, TakeAnalysis } from '../types';
import { align } from './align';
import { measureTake } from './measures';
import { checkQuality } from './quality';
import { highpass, resample } from './resample';
import { buildTrack } from './track';
import { yin } from './yin';

export const ANALYSIS_VERSION = 1;
const RATE = 16000;

export interface AnalyzeOptions {
  notes: RefNote[];
  firstNoteAt: number | null;
  strictTime: boolean;
  /** Seconds of voice needed before we trust a take (shorter for practice). */
  minVoicedSec?: number;
}

export function analyzeTake(pcm: Float32Array, sampleRate: number, opts: AnalyzeOptions): TakeAnalysis {
  const x = highpass(resample(pcm, sampleRate, RATE), RATE, 60);
  const frames = yin(x, RATE, { hop: 160, window: 512 });
  const track = buildTrack(frames);
  const quality = checkQuality(pcm, track, opts.minVoicedSec ?? 3);

  // Contour for display at 20 ms.
  const midi: (number | null)[] = [];
  const db: number[] = [];
  for (let i = 0; i < track.midi.length; i += 2) {
    const m = track.midi[i];
    midi.push(Number.isNaN(m) ? null : Math.round(m * 100) / 100);
    db.push(Math.round(track.db[i] * 10) / 10);
  }
  const base: TakeAnalysis = {
    version: ANALYSIS_VERSION,
    durationSec: Math.round((pcm.length / sampleRate) * 100) / 100,
    quality,
    matched: false,
    matchScore: 0,
    contour: { hop: track.hopSec * 2, midi, db },
    notes: [],
    measures: null,
  };
  if (!quality.ok) return base;

  const alignment = align(track, opts.notes);
  base.matchScore = Math.round(alignment.score * 100) / 100;
  base.matched = alignment.matched;
  if (!alignment.matched) return base;

  const { notes, measures } = measureTake({
    track,
    alignment,
    notes: opts.notes,
    firstNoteAt: opts.firstNoteAt,
    strictTime: opts.strictTime,
  });
  base.notes = notes;
  base.measures = measures;
  return base;
}
