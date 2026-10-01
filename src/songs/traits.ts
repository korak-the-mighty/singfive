import type { RefNote, Song, SongSection, SongTraits } from '../types';

export const sungNotes = (notes: RefNote[]) => notes.filter((n) => !n.rest);

export function sectionBeats(s: SongSection): number {
  const last = s.notes[s.notes.length - 1];
  return last.start + last.beats;
}

export function sectionSeconds(s: SongSection): number {
  return (sectionBeats(s) * 60) / s.bpm;
}

/** Seconds of count-in before the first sung note: one full bar, plus the beats before the pickup. */
export function countInSeconds(s: SongSection): number {
  const beats = s.pickupBeats > 0 ? 2 * s.beatsPerBar - s.pickupBeats : s.beatsPerBar;
  return (beats * 60) / s.bpm;
}

/** Click times (seconds) for the count-in. The first of each bar is accented. */
export function countInClicks(s: SongSection): { t: number; accent: boolean }[] {
  const total = countInSeconds(s);
  const beatSec = 60 / s.bpm;
  const out: { t: number; accent: boolean }[] = [];
  for (let b = 0; b * beatSec < total - 1e-6; b += s.clickEvery) {
    out.push({ t: b * beatSec, accent: Math.abs(b % s.beatsPerBar) < 1e-6 });
  }
  return out;
}

export function songTraits(song: Song): SongTraits {
  const s = song.section;
  const notes = sungNotes(s.notes);
  const beatSec = 60 / s.bpm;
  const pitches = notes.map((n) => n.midi);
  const lo = Math.min(...pitches);
  const hi = Math.max(...pitches);
  let wsum = 0;
  let w = 0;
  for (const n of notes) {
    wsum += n.midi * n.beats;
    w += n.beats;
  }
  const centre = wsum / w;
  let biggestLeap = 0;
  let leapCount = 0;
  for (let i = 1; i < notes.length; i++) {
    const d = Math.abs(notes[i].midi - notes[i - 1].midi);
    biggestLeap = Math.max(biggestLeap, d);
    if (d >= 5) leapCount++;
  }
  const secs = notes.map((n) => n.beats * beatSec);
  const durationSec = sectionSeconds(s);
  return {
    spanSemitones: hi - lo,
    heightCentre: hi > lo ? (centre - lo) / (hi - lo) : 0.5,
    biggestLeap,
    leapCount,
    longestNoteSec: Math.max(...secs),
    longNotes: secs.filter((x) => x >= 1.2).length,
    notesPerSecond: notes.length / durationSec,
    durationSec,
    strictTime: s.timeFeel === 'strict',
  };
}

/** Short plain-language tags for what a song tests. */
export function songTags(song: Song): string[] {
  const t = songTraits(song);
  const tags: string[] = [];
  if (t.spanSemitones >= 14) tags.push('wide range');
  else if (t.spanSemitones <= 8) tags.push('narrow range');
  else tags.push('an octave');
  if (t.longNotes >= 5 || t.longestNoteSec >= 2.5) tags.push('long notes');
  if (t.biggestLeap >= 7 && t.leapCount >= 3) tags.push('big leaps');
  if (t.strictTime) tags.push('steady beat');
  if (t.notesPerSecond >= 2.1) tags.push('quick words');
  return tags;
}
