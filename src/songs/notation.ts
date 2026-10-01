import type { RefNote } from '../types';

const STEP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "F#4" → 66, "Bb3" → 58. */
export function nameToMidi(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`Bad note name: ${name}`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + STEP[m[1]] + acc;
}

const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/** 60 → "C4". Rounds to the nearest semitone. */
export function midiToName(midi: number): string {
  const r = Math.round(midi);
  return `${NAMES[((r % 12) + 12) % 12]}${Math.floor(r / 12) - 1}`;
}

/**
 * Parse a melody written as space-separated tokens: `pitch:beats[:syllable]`.
 * `r:beats` is a rest. A note with no syllable continues the previous one.
 */
export function parseMelody(src: string): RefNote[] {
  const notes: RefNote[] = [];
  let pos = 0;
  for (const token of src.trim().split(/\s+/)) {
    if (token === '/') {
      // Phrase end: a natural place to breathe after the previous note.
      if (notes.length) notes[notes.length - 1].breath = true;
      continue;
    }
    const [p, b, ...lyricParts] = token.split(':');
    const beats = Number(b);
    if (!Number.isFinite(beats) || beats <= 0) throw new Error(`Bad duration in ${token}`);
    const lyric = lyricParts.length ? lyricParts.join(':') : undefined;
    if (p === 'r') {
      notes.push({ midi: NaN, beats, start: pos, rest: true });
    } else {
      notes.push({ midi: nameToMidi(p), beats, start: pos, lyric });
    }
    pos += beats;
  }
  return notes;
}

/** The words sung from note i up to (not including) the next note with a syllable. */
export function wordsAround(notes: RefNote[], i: number, span = 2): string {
  const out: string[] = [];
  let k = i;
  while (k >= 0 && !notes[k].lyric) k--;
  for (let j = Math.max(0, k); j < notes.length && out.length < span; j++) {
    if (notes[j].lyric) out.push(notes[j].lyric!);
  }
  return out
    .join(' ')
    .replace(/- /g, '')
    .replace(/-$/, '');
}

/** The syllable a note belongs to, joined into a readable word where possible. */
export function wordAt(notes: RefNote[], i: number): string {
  let k = i;
  while (k >= 0 && !notes[k].lyric) k--;
  if (k < 0) return '';
  // Walk back to the start of the word (previous syllable ends with "-").
  let s = k;
  for (let j = k - 1; j >= 0; j--) {
    if (notes[j].rest) break;
    if (notes[j].lyric) {
      if (notes[j].lyric!.endsWith('-')) s = j;
      else break;
    }
  }
  let word = '';
  for (let j = s; j < notes.length; j++) {
    const l = notes[j].lyric;
    if (!l) continue;
    if (j > k && !word.endsWith('-')) break;
    word = word.endsWith('-') ? word.slice(0, -1) + l : word + l;
    if (!l.endsWith('-') && j >= k) break;
  }
  return word.replace(/-$/, '');
}
