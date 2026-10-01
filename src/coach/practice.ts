// Practice exists only because of one of YOUR FIVE SONGS.
// Each one is cut from the song itself, aimed at what your take revealed.

import { wordAt } from '../songs/notation';
import type { Practice, Song, TakeAnalysis } from '../types';
import type { Finding } from './findings';
import { quoteWord, steadyWords } from './words';

export function lineText(song: Song, range: [number, number]): string {
  const ns = song.section.notes.slice(range[0], range[1] + 1);
  let out = '';
  for (const n of ns) {
    if (!n.lyric) continue;
    if (out && !out.endsWith('-')) out += ' ';
    out = out.endsWith('-') ? out.slice(0, -1) + n.lyric : out + n.lyric;
  }
  return out.replace(/-$/, '');
}

export function practiceFromFinding(song: Song, f: Finding, id: string, now: number): Practice | null {
  if (!f.focus) return null;
  const { type, noteRange } = f.focus;
  const ns = song.section.notes;
  const w = (i: number) => quoteWord(wordAt(ns, i));
  const line = `“${lineText(song, noteRange)}”`;
  const base = { id, songId: song.id, type, noteRange, createdAt: now, findingKey: f.key };
  switch (type) {
    case 'hold-note':
      return {
        ...base,
        title: `Hold ${w(noteRange[0])}`,
        because:
          f.key === 'long-sag'
            ? `Because the long notes in ${song.title} sink at the end.`
            : f.key === 'long-short'
              ? `Because you cut the long notes in ${song.title} short.`
              : `Because the long note on ${w(noteRange[0])} in ${song.title} wavered.`,
        howTo: `Take a calm breath. Sing just ${w(noteRange[0])} and hold it a little longer than the song asks. Keep it level, like drawing a straight line. Softer is fine.`,
      };
    case 'interval':
      return {
        ...base,
        title: `The jump to ${w(noteRange[1])}`,
        because: `Because the step into ${w(noteRange[1])} in ${song.title} didn’t land.`,
        howTo: `Sing ${w(noteRange[0])} to ${w(noteRange[1])}, slowly. Before the second note, hear it in your head. Then sing it as if it were easy.`,
      };
    case 'softer':
      return {
        ...base,
        title: 'Same line, half the effort',
        because: `Because the high notes in ${song.title} got louder and less steady.`,
        howTo: `Sing ${line} with the high notes at half your usual volume. Let them be small. See if they get steadier.`,
      };
    case 'listen':
      return {
        ...base,
        title: 'Listen first, then sing',
        because: `Because a few notes in ${song.title} differ from this version of the tune.`,
        howTo: `Play the line twice and just listen. Then sing ${line}.`,
      };
    case 'one-line':
    default: {
      const why =
        f.key === 'late-in'
          ? `Because you came in late in ${song.title}. Aim to land the first word on the beat.`
          : f.key === 'rushing'
            ? `Because ${song.title} sped up. Keep the line at the count-in’s speed.`
            : f.key === 'breaks'
              ? `Because you stopped for air mid-line in ${song.title}. One good breath, then carry it to the end.`
              : f.key.startsWith('drift')
                ? `Because ${song.title} drifted away from its key by the end.`
                : f.key === 'uneven-beat'
                  ? `Because the beat in ${song.title} wandered.`
                  : `Because this is where ${song.title} slipped.`;
      return {
        ...base,
        type: 'one-line',
        title: 'Just one line',
        because: why,
        howTo: `Sing only this line: ${line}. Nothing before it, nothing after.`,
      };
    }
  }
}

/** How did a practice attempt go, compared with the same notes in the song's take? */
export function judgePractice(song: Song, p: Practice, attempt: TakeAnalysis, reference: TakeAnalysis | null): { text: string; better: boolean | null } {
  if (!attempt.quality.ok || !attempt.matched || !attempt.measures) {
    return { text: 'We couldn’t follow that one. Try again, singing just the words shown.', better: null };
  }
  // Attempt notes already refer to the full song's note indices.
  const notes = attempt.notes;
  const refNotes = reference?.notes.filter((n) => n.ref >= p.noteRange[0] && n.ref <= p.noteRange[1]) ?? [];
  const ns = song.section.notes;
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  if (p.type === 'hold-note') {
    const n = notes[0];
    const r = refNotes[0];
    if (n.wanderCents == null) return { text: 'Hold it a bit longer next time so we can hear how steady it is.', better: null };
    const nowW = n.wanderCents;
    if (r?.wanderCents != null) {
      const d = r.wanderCents - nowW;
      if (d >= 4) return { text: `Steadier than in the song: ${steadyWords(nowW)} now (${r.wanderCents} → ${nowW} cents). Carry this feeling back into ${song.title}.`, better: true };
      if (d <= -4) return { text: `This one wavered more than in the song (${r.wanderCents} → ${nowW} cents). Try it softer.`, better: false };
    }
    return { text: `The note was ${steadyWords(nowW)} (${nowW} cents of wander).`, better: null };
  }

  const offs = notes.filter((n) => n.status === 'sung').map((n) => Math.abs(n.offCents!));
  const refOffs = refNotes.filter((n) => n.status === 'sung').map((n) => Math.abs(n.offCents!));
  const a = avg(offs);
  const b = avg(refOffs);

  if (p.type === 'interval' && notes.length >= 2) {
    const first = notes[0];
    const second = notes[notes.length - 1];
    if (first.status === 'sung' && second.status === 'sung') {
      const err = second.offCents! - first.offCents!;
      const refA = refNotes[0];
      const refB = refNotes[refNotes.length - 1];
      const refErr = refA?.status === 'sung' && refB?.status === 'sung' ? refB.offCents! - refA.offCents! : null;
      const label = quoteWord(wordAt(ns, p.noteRange[1]));
      if (Math.abs(err) <= 25) return { text: `You landed ${label} cleanly${refErr != null ? ` (in the song you missed by ${Math.abs(refErr)} cents; now ${Math.abs(err)})` : ''}.`, better: refErr != null ? Math.abs(err) < Math.abs(refErr) : true };
      return { text: `${label} landed ${Math.abs(err)} cents ${err < 0 ? 'low' : 'high'}${refErr != null ? ` (in the song: ${Math.abs(refErr)})` : ''}. Hear it before you sing it.`, better: refErr != null ? Math.abs(err) < Math.abs(refErr) - 10 : false };
    }
  }

  if (p.type === 'softer') {
    const db = avg(notes.map((n) => n.db).filter((x): x is number => x != null));
    const refDb = avg(refNotes.map((n) => n.db).filter((x): x is number => x != null));
    const w = avg(notes.map((n) => n.wanderCents).filter((x): x is number => x != null));
    const rw = avg(refNotes.map((n) => n.wanderCents).filter((x): x is number => x != null));
    const softer = db != null && refDb != null && refDb - db >= 3;
    const steadier = (w != null && rw != null && rw - w >= 3) || (a != null && b != null && b - a >= 6);
    if (softer && steadier) return { text: 'You used less force and gained stability. That’s the lesson of this song.', better: true };
    if (softer) return { text: 'Softer, but not steadier yet. Keep the breath moving even when it’s quiet.', better: null };
    return { text: 'That wasn’t much softer than in the song. Try really small — almost a whisper with pitch.', better: null };
  }

  if (a != null && b != null) {
    if (b - a >= 8) return { text: `More in tune than in the song (${Math.round(b)} → ${Math.round(a)} cents on average).`, better: true };
    if (a - b >= 8) return { text: `Less in tune than in the song (${Math.round(b)} → ${Math.round(a)} cents). Slow it down and listen first.`, better: false };
    return { text: `About as in tune as in the song (${Math.round(a)} cents on average).`, better: null };
  }
  return { text: 'Done. Sing the whole song again to hear if it carries over.', better: null };
}
