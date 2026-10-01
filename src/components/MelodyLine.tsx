// The melody as a shape (bars), with your singing drawn over it.
// Your contour is placed on the melody's timeline using the alignment, so
// you can see where you were above or below the line.

import type { SongSection, TakeAnalysis } from '../types';

interface Props {
  section: SongSection;
  /** Semitones to draw the melody in (the key you sing it in). */
  shift: number;
  take?: TakeAnalysis | null;
  compare?: TakeAnalysis | null;
  highlight?: [number, number] | null;
  height?: number;
  showWords?: boolean;
  /** Beat position of a moving cursor (while the guide plays). */
  cursor?: number | null;
}

function contourPath(a: TakeAnalysis, section: SongSection, x: (beat: number) => number, y: (m: number) => number, keyFix: number): string {
  // Map each analysed note's frames onto its reference beats.
  const hop = a.contour.hop;
  let d = '';
  for (const n of a.notes) {
    if (n.onset == null || n.status === 'missed') continue;
    const ref = section.notes[n.ref];
    const start = n.onset;
    const end = n.onset + Math.max(0.05, n.duration);
    const f0 = Math.floor(start / hop);
    const f1 = Math.min(a.contour.midi.length, Math.ceil(end / hop));
    let open = false;
    for (let f = f0; f < f1; f++) {
      const m = a.contour.midi[f];
      if (m == null) {
        open = false;
        continue;
      }
      // Fold octave jumps back so the line stays readable.
      const exp = n.expected;
      const mm = m - 12 * Math.round((m - exp) / 12) - keyFix;
      const beat = ref.start + ((f - f0) / Math.max(1, f1 - f0)) * ref.beats;
      d += `${open ? 'L' : 'M'}${x(beat).toFixed(1)} ${y(mm).toFixed(1)} `;
      open = true;
    }
  }
  return d;
}

export function MelodyLine({ section, shift, take, compare, highlight, height = 150, showWords = true, cursor = null }: Props) {
  const notes = section.notes;
  const sung = notes.filter((n) => !n.rest);
  const lo = Math.min(...sung.map((n) => n.midi)) + shift - 1.5;
  const hi = Math.max(...sung.map((n) => n.midi)) + shift + 1.5;
  const total = notes[notes.length - 1].start + notes[notes.length - 1].beats;
  const W = 800;
  const top = 8;
  const bottom = showWords ? 22 : 6;
  const H = height;
  const x = (b: number) => (b / total) * W;
  const y = (m: number) => top + (1 - (m - lo) / (hi - lo)) * (H - top - bottom);
  // Draw the take in the key it was sung, mapped onto this drawing's key.
  const fix = (a: TakeAnalysis) => (a.measures ? a.measures.keyShift - shift : 0);
  const bar = Math.max(7, ((H - top - bottom) / (hi - lo)) * 0.85);
  let lastLen = 3;

  return (
    <svg className="melody" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="The melody, with your singing drawn over it">
      {notes.map((n, i) =>
        n.rest ? null : (
          <rect
            key={i}
            className={`ref${highlight && i >= highlight[0] && i <= highlight[1] ? ' hl' : ''}`}
            x={x(n.start) + 1}
            y={y(n.midi + shift) - bar / 2}
            width={Math.max(2, x(n.beats) - 2)}
            height={bar}
            rx={bar / 2}
          />
        ),
      )}
      {showWords &&
        (() => {
          // Only label where there's room, so the words never collide.
          let lastX = -999;
          return notes.map((n, i) => {
            if (!n.lyric) return null;
            const px = x(n.start) + 2;
            if (px - lastX < 7 * Math.max(3, lastLen)) return null;
            lastX = px;
            lastLen = n.lyric.length;
            return (
              <text key={`w${i}`} x={px} y={H - 6}>
                {n.lyric.replace(/-$/, '')}
              </text>
            );
          });
        })()}
      {cursor != null && <line x1={x(cursor)} x2={x(cursor)} y1={0} y2={H - bottom + 2} stroke="var(--lips)" strokeWidth={2} />}
      {compare?.matched && <path className="you b" d={contourPath(compare, section, x, y, fix(compare))} />}
      {take?.matched && <path className="you" d={contourPath(take, section, x, y, fix(take))} />}
    </svg>
  );
}
