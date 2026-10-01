// The voice map: everything we've heard, note by note, across all songs.
// It answers "where does your voice sit, and where is it steadiest?"

import { sungNotes } from '../songs/traits';
import type { Song, Take } from '../types';

export interface VoiceBin {
  midi: number;
  n: number;
  meanOff: number;
  wander: number | null;
  songs: Set<string>;
}

export interface VoiceMap {
  bins: VoiceBin[];
  notesHeard: number;
  lowest: number | null;
  highest: number | null;
  /** Contiguous stretch of notes that were both in tune and steady. */
  steady: { low: number; high: number } | null;
  /** Middle of what you actually sing, MIDI. */
  centre: number | null;
}

export function buildVoiceMap(takes: Take[]): VoiceMap {
  const bins = new Map<number, { offs: number[]; wanders: number[]; songs: Set<string> }>();
  let notesHeard = 0;
  const all: number[] = [];
  for (const t of takes) {
    const a = t.analysis;
    if (!a?.matched) continue;
    for (const n of a.notes) {
      if (n.status !== 'sung' || n.sung == null) continue;
      notesHeard++;
      const k = Math.round(n.sung);
      all.push(n.sung);
      if (!bins.has(k)) bins.set(k, { offs: [], wanders: [], songs: new Set() });
      const b = bins.get(k)!;
      b.offs.push(Math.abs(n.offCents!));
      if (n.wanderCents != null) b.wanders.push(n.wanderCents);
      b.songs.add(t.songId);
    }
  }
  const out: VoiceBin[] = [...bins.entries()]
    .map(([midi, b]) => ({
      midi,
      n: b.offs.length,
      meanOff: b.offs.reduce((x, y) => x + y, 0) / b.offs.length,
      wander: b.wanders.length ? b.wanders.reduce((x, y) => x + y, 0) / b.wanders.length : null,
      songs: b.songs,
    }))
    .sort((x, y) => x.midi - y.midi);

  // Use notes heard at least twice for the extremes, to ignore one-off slips.
  const solid = out.filter((b) => b.n >= 2);
  const lowest = solid.length ? solid[0].midi : out.length ? out[0].midi : null;
  const highest = solid.length ? solid[solid.length - 1].midi : out.length ? out[out.length - 1].midi : null;

  // Steadiest stretch: in tune and not wandering, allowing one-semitone holes.
  const good = (b: VoiceBin) => b.n >= 2 && b.meanOff <= 22 && (b.wander == null || b.wander <= 11);
  let best: { low: number; high: number; score: number } | null = null;
  let start: VoiceBin | null = null;
  let last: VoiceBin | null = null;
  let score = 0;
  for (const b of out) {
    if (!good(b)) continue;
    if (start && last && b.midi - last.midi <= 2) {
      last = b;
      score += b.n;
    } else {
      start = b;
      last = b;
      score = b.n;
    }
    if (!best || score > best.score) best = { low: start.midi, high: last.midi, score };
  }
  all.sort((x, y) => x - y);
  return {
    bins: out,
    notesHeard,
    lowest,
    highest,
    steady: best && best.high - best.low >= 2 ? { low: best.low, high: best.high } : null,
    centre: all.length ? all[Math.floor(all.length / 2)] : null,
  };
}

/** Duration-weighted centre and range of a song's melody, MIDI in its reference key. */
export function melodyShape(song: Song) {
  const ns = sungNotes(song.section.notes);
  let w = 0;
  let s = 0;
  for (const n of ns) {
    s += n.midi * n.beats;
    w += n.beats;
  }
  return { centre: s / w, low: Math.min(...ns.map((n) => n.midi)), high: Math.max(...ns.map((n) => n.midi)) };
}

/**
 * Pick a key (semitone shift from the reference) that puts the song where your
 * voice is steadiest. Returns null if we haven't heard enough yet.
 */
export function suggestShift(song: Song, map: VoiceMap): number | null {
  if (!map.centre || map.notesHeard < 12) return null;
  const shape = melodyShape(song);
  const target = map.steady ? (map.steady.low + map.steady.high) / 2 : map.centre;
  let shift = Math.round(target - shape.centre);
  // Keep the top note within what we've heard you sing, if we can.
  if (map.highest != null && shape.high + shift > map.highest + 1) shift = Math.round(map.highest + 1 - shape.high);
  if (map.lowest != null && shape.low + shift < map.lowest - 1) shift = Math.max(shift, Math.round(map.lowest - 1 - shape.low));
  return shift;
}
