// How the coach talks about measurements: plain words first, numbers as proof.

import { midiToName } from '../songs/notation';

export function pitchWords(cents: number): string {
  const a = Math.abs(cents);
  const dir = cents < 0 ? 'flat' : 'sharp';
  if (a < 15) return 'right on the note';
  if (a < 30) return `a touch ${dir}`;
  if (a < 50) return `a little ${dir}`;
  if (a < 85) return `clearly ${dir}`;
  return `a different note`;
}

export function distanceWords(cents: number): string {
  const a = Math.abs(cents);
  if (a < 30) return 'a hair';
  if (a < 60) return 'about a quarter of a step';
  if (a < 80) return 'more than a quarter of a step';
  if (a < 130) return 'about a semitone';
  if (a < 250) return 'about a whole step';
  return `about ${Math.round(a / 100)} semitones`;
}

export function steadyWords(wanderCents: number): string {
  if (wanderCents < 8) return 'steady';
  if (wanderCents < 14) return 'mostly steady';
  if (wanderCents < 22) return 'wavering';
  return 'wobbling a lot';
}

export function semitoneWords(n: number): string {
  const a = Math.abs(Math.round(n));
  if (a === 0) return 'the same key';
  if (a === 1) return 'a semitone';
  if (a === 2) return 'a whole step';
  if (a === 12) return 'an octave';
  return `${a} semitones`;
}

/** How far a key is from the written one, in words a singer uses. */
export function keyWords(shift: number): string {
  const n = Math.round(shift);
  if (n === 0) return 'in its written key';
  const dir = n < 0 ? 'lower' : 'higher';
  const a = Math.abs(n);
  if (a === 12) return `an octave ${dir} than written`;
  if (a >= 10 && a <= 14) return `about an octave ${dir} than written`;
  return `${semitoneWords(a)} ${dir} than written`;
}

/** "A3" → "A3 (low)" style helper for proof lines. */
export function noteLabel(midi: number): string {
  return midiToName(midi);
}

export function rangeWords(lo: number, hi: number): string {
  const span = Math.round(hi - lo);
  if (span <= 0) return 'a single note';
  if (span < 12) return `${semitoneWords(span)} wide`;
  if (span === 12) return 'an octave';
  if (span < 16) return 'a little over an octave';
  if (span < 20) return 'an octave and a half';
  return 'well over an octave and a half';
}

export function quoteWord(w: string): string {
  return `“${w}”`;
}

export function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export function count(n: number, one: string, many = `${one}s`): string {
  const words = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  return `${n <= 10 ? words[n] : n} ${n === 1 ? one : many}`;
}

export function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function capital(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
