// Findings: what one take tells us, in plain words, each tagged with how sure we are.
//
//   heard  — we measured it
//   think  — our interpretation of what we measured
//   unsure — we need more evidence

import { wordAt } from '../songs/notation';
import type { Evidence, Feeling, PracticeType, Song, TakeAnalysis } from '../types';
import { distanceWords, quoteWord, steadyWords } from './words';

export interface Finding {
  key: string;
  tone: 'strength' | 'difficulty' | 'neutral';
  evidence: Evidence;
  text: string;
  proof: string[];
  weight: number;
  /** A practice this finding suggests, tied to a part of the song. */
  focus?: { type: PracticeType; noteRange: [number, number] };
}

const longestNote = (song: Song): number => {
  let best = -1;
  song.section.notes.forEach((n, i) => {
    if (!n.rest && (best < 0 || n.beats > song.section.notes[best].beats)) best = i;
  });
  return best;
};

/** Indices of the phrase (line) containing note i, using breath marks and rests. */
export function phraseOf(song: Song, i: number): [number, number] {
  const ns = song.section.notes;
  let a = i;
  while (a > 0 && !ns[a - 1].breath && !ns[a - 1].rest) a--;
  let b = i;
  while (b < ns.length - 1 && !ns[b].breath && !ns[b + 1].rest) b++;
  while (ns[a]?.rest) a++;
  return [a, b];
}

export function findingsForTake(song: Song, a: TakeAnalysis, feeling: Feeling[] = []): Finding[] {
  const out: Finding[] = [];
  const m = a.measures;
  if (!a.quality.ok || !a.matched || !m) return out;
  const notes = a.notes;
  const ns = song.section.notes;
  const word = (ref: number) => quoteWord(wordAt(ns, ref));
  const strict = song.section.timeFeel === 'strict';

  // --- Tuning -------------------------------------------------------------------
  const sungCount = notes.filter((n) => n.status === 'sung').length;
  const closeCount = notes.filter((n) => n.status === 'sung' && Math.abs(n.offCents!) <= 35).length;
  if (m.meanOffCents != null && m.inTuneShare != null) {
    if (m.meanOffCents <= 18 && m.inTuneShare >= 0.8) {
      out.push({
        key: 'in-tune',
        tone: 'strength',
        evidence: 'heard',
        text:
          (Math.abs(m.registers.high.bias ?? 0) >= 25 && m.registers.high.n >= 2) || (Math.abs(m.registers.low.bias ?? 0) >= 25 && m.registers.low.n >= 2)
            ? 'Most of it was in tune.'
            : 'You were in tune nearly all the way through.',
        proof: [`${closeCount} of ${sungCount} notes landed close to the note`, `Average distance from the note: ${m.meanOffCents} cents (100 cents = a semitone)`],
        weight: 0.7,
      });
    } else if (m.meanOffCents >= 32) {
      out.push({
        key: 'tuning-loose',
        tone: 'difficulty',
        evidence: 'heard',
        text: 'The tuning was loose: many notes landed between notes rather than on them.',
        proof: [`${closeCount} of ${sungCount} notes landed close to the note`, `Average distance: ${m.meanOffCents} cents`],
        weight: 0.75,
        focus: { type: 'one-line', noteRange: phraseOf(song, worstNote(a) ?? 0) },
      });
    }
  }

  const { high, mid, low } = m.registers;
  if (high.n >= 2 && high.bias != null && Math.abs(high.bias) >= 25 && Math.abs(mid.bias ?? 0) < Math.abs(high.bias) - 12) {
    const dir = high.bias < 0 ? 'flat' : 'sharp';
    const hiNote = notes.filter((n) => n.status === 'sung').reduce((x, y) => (y.expected > x.expected ? y : x));
    out.push({
      key: `high-${dir}`,
      tone: 'difficulty',
      evidence: 'heard',
      text: `The highest notes went ${dir}, while the rest was closer.`,
      proof: [
        `High notes: ${distanceWords(high.bias)} ${dir} on average (${high.bias} cents)`,
        `Middle notes: ${mid.bias ?? 0} cents`,
      ],
      weight: 0.85,
      focus: { type: 'interval', noteRange: [Math.max(0, prevSung(ns, hiNote.ref)), hiNote.ref] },
    });
    out.push({
      key: `high-${dir}:why`,
      tone: 'neutral',
      evidence: 'think',
      text:
        dir === 'flat'
          ? 'That usually means the top of this song is a stretch in this key, or the breath is running thin as you climb.'
          : 'Going sharp up high often comes from pushing extra effort into the top notes.',
      proof: [],
      weight: 0.4,
    });
  }
  if (low.n >= 2 && low.bias != null && Math.abs(low.bias) >= 25 && Math.abs(mid.bias ?? 0) < Math.abs(low.bias) - 12) {
    const dir = low.bias < 0 ? 'flat' : 'sharp';
    out.push({
      key: `low-${dir}`,
      tone: 'difficulty',
      evidence: 'heard',
      text: `The lowest notes went ${dir}.`,
      proof: [`Low notes: ${low.bias} cents on average`, `Middle notes: ${mid.bias ?? 0} cents`],
      weight: 0.6,
    });
  }
  if (m.keyDriftCents != null && Math.abs(m.keyDriftCents) >= 40) {
    const dir = m.keyDriftCents < 0 ? 'down' : 'up';
    out.push({
      key: `drift-${dir}`,
      tone: 'difficulty',
      evidence: 'heard',
      text: `You drifted ${dir} as you went. By the end you were ${distanceWords(m.keyDriftCents)} away from where you started.`,
      proof: [`Drift across the take: ${m.keyDriftCents} cents`],
      weight: 0.7,
      focus: { type: 'one-line', noteRange: phraseOf(song, lastSung(a)) },
    });
  }

  // --- Long notes ------------------------------------------------------------------
  const longs = notes.filter((n) => n.status === 'sung' && n.wanderCents != null && ns[n.ref].beats * (60 / (m.tempoBpm ?? song.section.bpm)) >= 0.9);
  if (longs.length) {
    const worst = longs.reduce((x, y) => ((y.wanderCents ?? 0) > (x.wanderCents ?? 0) ? y : x));
    const lw = m.longNotes.wanderCents ?? 0;
    if (lw <= 9 && Math.abs(m.longNotes.endDriftCents ?? 0) <= 15) {
      out.push({
        key: 'long-steady',
        tone: 'strength',
        evidence: 'heard',
        text: 'Your long notes were steady.',
        proof: [`Long notes: ${longs.length}, typical wander ${lw} cents`],
        weight: 0.65,
      });
    } else if ((worst.wanderCents ?? 0) >= 16) {
      out.push({
        key: 'long-waver',
        tone: 'difficulty',
        evidence: 'heard',
        text: `The long note on ${word(worst.ref)} was ${steadyWords(worst.wanderCents!)}.`,
        proof: [`Wander on ${word(worst.ref)}: ${worst.wanderCents} cents`, `All long notes, typical: ${lw} cents`],
        weight: 0.75,
        focus: { type: 'hold-note', noteRange: [worst.ref, worst.ref] },
      });
    }
    if ((m.longNotes.endDriftCents ?? 0) <= -22) {
      out.push({
        key: 'long-sag',
        tone: 'difficulty',
        evidence: 'heard',
        text: 'Your long notes sank toward the end.',
        proof: [`End of long notes: ${m.longNotes.endDriftCents} cents below their start`],
        weight: 0.7,
        focus: { type: 'hold-note', noteRange: [longestNote(song), longestNote(song)] },
      });
      out.push({
        key: 'long-sag:why',
        tone: 'neutral',
        evidence: 'think',
        text: 'Notes that sink at the end usually mean the air is running out before the note does.',
        proof: [],
        weight: 0.4,
      });
    }
    if (m.longNotes.heldShare != null && m.longNotes.heldShare < 0.65) {
      out.push({
        key: 'long-short',
        tone: 'difficulty',
        evidence: 'heard',
        text: 'You cut the long notes short.',
        proof: [`Long notes held for about ${Math.round(m.longNotes.heldShare * 100)}% of their length`],
        weight: 0.55,
        focus: { type: 'hold-note', noteRange: [longestNote(song), longestNote(song)] },
      });
    }
  }
  if (m.vibrato.present) {
    out.push({
      key: 'vibrato',
      tone: 'neutral',
      evidence: 'heard',
      text: 'There is a natural vibrato in your long notes.',
      proof: [`About ${m.vibrato.rateHz} pulses a second, ±${m.vibrato.sizeCents} cents`],
      weight: 0.35,
    });
  }

  // --- Jumps -----------------------------------------------------------------------------
  if (m.leapsUp.n >= 2 && m.leapsUp.bias != null && m.leapsUp.bias <= -28) {
    out.push({
      key: 'leaps-short',
      tone: 'difficulty',
      evidence: 'heard',
      text: 'Your jumps up tended to fall short of the note.',
      proof: [`Upward jumps landed ${Math.abs(m.leapsUp.bias)} cents low on average (${m.leapsUp.n} jumps)`],
      weight: 0.7,
      focus: m.worstInterval ? { type: 'interval', noteRange: [m.worstInterval.from, m.worstInterval.to] } : undefined,
    });
  } else if (m.leapsUp.n >= 2 && (m.leapsUp.meanErr ?? 99) <= 20) {
    out.push({
      key: 'leaps-clean',
      tone: 'strength',
      evidence: 'heard',
      text: 'You landed the jumps cleanly.',
      proof: [`Upward jumps: ${m.leapsUp.n}, within ${m.leapsUp.meanErr} cents on average`],
      weight: 0.55,
    });
  }
  if (m.worstInterval && Math.abs(m.worstInterval.errCents) >= 55) {
    const w = m.worstInterval;
    out.push({
      key: 'interval-miss',
      tone: 'difficulty',
      evidence: 'heard',
      text: `The step into ${quoteWord(wordAt(ns, w.to))} missed by ${distanceWords(w.errCents)}.`,
      proof: [`Interval error: ${w.errCents} cents`],
      weight: 0.6,
      focus: { type: 'interval', noteRange: [w.from, w.to] },
    });
  }

  // --- Time ---------------------------------------------------------------------------------
  if (m.entranceMs != null) {
    if (m.entranceMs >= 250) {
      out.push({
        key: 'late-in',
        tone: 'difficulty',
        evidence: 'heard',
        text: 'You came in late after the count-in.',
        proof: [`First note ${(m.entranceMs / 1000).toFixed(2)} s after it was due`],
        weight: 0.55,
        focus: { type: 'one-line', noteRange: phraseOf(song, firstSungRef(song)) },
      });
    } else if (m.entranceMs <= -220) {
      out.push({
        key: 'early-in',
        tone: 'difficulty',
        evidence: 'heard',
        text: 'You came in early, before the count-in finished.',
        proof: [`First note ${(Math.abs(m.entranceMs) / 1000).toFixed(2)} s early`],
        weight: 0.45,
      });
    } else if (Math.abs(m.entranceMs) <= 120) {
      out.push({
        key: 'clean-in',
        tone: 'strength',
        evidence: 'heard',
        text: 'You came in right on time.',
        proof: [`First note within ${Math.abs(m.entranceMs)} ms of the beat`],
        weight: 0.4,
      });
    }
  }
  if (m.tempoChangePct != null && Math.abs(m.tempoChangePct) >= (strict ? 7 : 12)) {
    const faster = m.tempoChangePct > 0;
    out.push({
      key: faster ? 'rushing' : 'dragging',
      tone: 'difficulty',
      evidence: 'heard',
      text: faster ? 'You sped up as you went.' : 'You slowed down as you went.',
      proof: [`Second half ${Math.abs(m.tempoChangePct)}% ${faster ? 'faster' : 'slower'} than the first`],
      weight: strict ? 0.7 : 0.4,
      focus: { type: 'one-line', noteRange: phraseOf(song, lastSung(a)) },
    });
  } else if (strict && m.timingSpreadMs != null && m.timingSpreadMs <= 55 && (m.tempoChangePct == null || Math.abs(m.tempoChangePct) < 5)) {
    out.push({
      key: 'steady-beat',
      tone: 'strength',
      evidence: 'heard',
      text: 'Your beat was steady.',
      proof: [`Notes landed within ${m.timingSpreadMs} ms of your own beat, typically`],
      weight: 0.55,
    });
  }
  if (strict && m.timingSpreadMs != null && m.timingSpreadMs >= 100) {
    out.push({
      key: 'uneven-beat',
      tone: 'difficulty',
      evidence: 'heard',
      text: 'The beat wandered: some words came early, some late.',
      proof: [`Typical timing error: ${m.timingSpreadMs} ms`],
      weight: 0.6,
      focus: { type: 'one-line', noteRange: phraseOf(song, firstSungRef(song)) },
    });
  }

  // --- Breath ---------------------------------------------------------------------------------
  if (m.midPhraseBreaks >= 2) {
    out.push({
      key: 'breaks',
      tone: 'difficulty',
      evidence: 'heard',
      text: `You stopped for air ${m.midPhraseBreaks} times in the middle of a line.`,
      proof: [`Longest unbroken stretch: ${m.longestPhraseSec ?? '?'} s`],
      weight: 0.6,
      focus: { type: 'one-line', noteRange: longestPhrase(song) },
    });
  } else if (m.midPhraseBreaks === 0 && (m.longestPhraseSec ?? 0) >= 5) {
    out.push({
      key: 'one-breath',
      tone: 'strength',
      evidence: 'heard',
      text: 'You carried each line on one breath.',
      proof: [`Longest unbroken stretch: ${m.longestPhraseSec} s`],
      weight: 0.4,
    });
  }

  // --- Effort ----------------------------------------------------------------------------------
  if (
    m.highVsMidDb != null &&
    m.highVsMidDb >= 6 &&
    ((high.wander ?? 0) > (mid.wander ?? 0) + 5 || (high.meanOff ?? 0) > (mid.meanOff ?? 0) + 12)
  ) {
    out.push({
      key: 'pushing',
      tone: 'difficulty',
      evidence: 'think',
      text: 'Your high notes got much louder and less steady. That is often a sign of pushing.',
      proof: [`High notes ${m.highVsMidDb} dB louder than the middle`, `Wander high ${high.wander ?? '?'} vs middle ${mid.wander ?? '?'} cents`],
      weight: 0.65,
      focus: { type: 'softer', noteRange: phraseOf(song, highestRef(song)) },
    });
  }

  // --- Onsets and notes --------------------------------------------------------------------------
  if ((m.scoopShare ?? 0) >= 0.3) {
    out.push({
      key: 'scoops',
      tone: 'difficulty',
      evidence: 'heard',
      text: 'You slid up into many notes from below.',
      proof: [`${Math.round((m.scoopShare ?? 0) * 100)}% of notes started low and slid up`],
      weight: 0.45,
    });
    out.push({
      key: 'scoops:why',
      tone: 'neutral',
      evidence: 'think',
      text: 'Sliding in can be a style choice. Here it blurs where the notes begin.',
      proof: [],
      weight: 0.2,
    });
  }
  const missed = notes.filter((n) => n.status === 'missed');
  if (m.missedShare >= 0.15) {
    out.push({
      key: 'missed',
      tone: 'difficulty',
      evidence: 'heard',
      text: `Some notes didn’t come through, for example on ${word(missed[0].ref)}.`,
      proof: [`${missed.length} of ${notes.length} notes had almost no voice`],
      weight: 0.5,
    });
  }
  const diff = notes.filter((n) => n.status === 'different');
  if (diff.length >= 2) {
    out.push({
      key: 'different-notes',
      tone: 'neutral',
      evidence: 'think',
      text: `You sang a different note from this version of the tune in ${diff.length} places, like ${word(diff[0].ref)}. If you know it that way, that’s fine.`,
      proof: diff.slice(0, 3).map((n) => `${quoteWord(wordAt(ns, n.ref))}: ${distanceWords(n.offCents!)} ${n.offCents! < 0 ? 'below' : 'above'}`),
      weight: 0.35,
      focus: { type: 'listen', noteRange: phraseOf(song, diff[0].ref) },
    });
  }
  if (m.octaveJumps >= 1) {
    const oj = notes.find((n) => n.octaveJump && n.status !== 'missed')!;
    out.push({
      key: 'octave-switch',
      tone: 'neutral',
      evidence: 'think',
      text: `You switched octave on ${word(oj.ref)}. That usually means that part is out of reach in this key.`,
      proof: [`${m.octaveJumps} note${m.octaveJumps > 1 ? 's' : ''} sung an octave away from the rest`],
      weight: 0.55,
    });
  }
  if ((m.breathiness ?? 0) >= 0.55) {
    out.push({
      key: 'airy',
      tone: 'neutral',
      evidence: 'unsure',
      text: 'Your tone sounds airy. It might be your style, or the microphone. We need more takes to tell.',
      proof: [`Breathiness estimate ${m.breathiness}`],
      weight: 0.25,
    });
  }

  // --- What you felt vs what we heard ---------------------------------------------------------------
  const problems = out.filter((f) => f.tone === 'difficulty' && f.evidence === 'heard').sort((x, y) => y.weight - x.weight);
  const strengths = out.filter((f) => f.tone === 'strength');
  if (feeling.includes('easy') && problems.length && problems[0].weight >= 0.6) {
    out.push({
      key: 'belief-easy',
      tone: 'neutral',
      evidence: 'heard',
      text: `It felt easy to you. The recording disagrees in one place: ${lowerFirst(problems[0].text)}`,
      proof: problems[0].proof,
      weight: 0.8,
    });
  }
  if (feeling.includes('pushing')) {
    const heard = m.highVsMidDb != null && m.highVsMidDb >= 4;
    out.push({
      key: 'belief-pushing',
      tone: 'neutral',
      evidence: heard ? 'heard' : 'unsure',
      text: heard
        ? `You felt you were pushing, and we heard it: the high notes were ${m.highVsMidDb} dB louder than the middle.`
        : 'You felt you were pushing, but the loudness stayed even. The effort may be in your throat rather than in volume. Notice where you feel it.',
      proof: [],
      weight: 0.6,
    });
  }
  if (feeling.includes('copying')) {
    out.push({
      key: 'belief-copying',
      tone: 'neutral',
      evidence: 'unsure',
      text: 'You felt you were copying the original. We can’t hear that from the audio alone. Try it once more your own way and compare the two.',
      proof: [],
      weight: 0.5,
    });
  }
  if (feeling.includes('like-me') && strengths.length) {
    out.push({
      key: 'belief-like-me',
      tone: 'strength',
      evidence: 'heard',
      text: `You said this felt like you. It sounded settled too: ${lowerFirst(strengths[0].text)}`,
      proof: strengths[0].proof,
      weight: 0.6,
    });
  }
  return out.sort((x, y) => y.weight - x.weight);
}

function lowerFirst(s: string): string {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}

function prevSung(ns: Song['section']['notes'], i: number): number {
  for (let j = i - 1; j >= 0; j--) if (!ns[j].rest) return j;
  return i;
}

function worstNote(a: TakeAnalysis): number | null {
  const s = a.notes.filter((n) => n.status === 'sung');
  if (!s.length) return null;
  return s.reduce((x, y) => (Math.abs(y.offCents!) > Math.abs(x.offCents!) ? y : x)).ref;
}

function lastSung(a: TakeAnalysis): number {
  const s = a.notes.filter((n) => n.status !== 'missed');
  return s.length ? s[s.length - 1].ref : 0;
}

function firstSungRef(song: Song): number {
  return song.section.notes.findIndex((n) => !n.rest);
}

function highestRef(song: Song): number {
  let best = 0;
  song.section.notes.forEach((n, i) => {
    if (!n.rest && n.midi > song.section.notes[best].midi) best = i;
  });
  return best;
}

function longestPhrase(song: Song): [number, number] {
  let best: [number, number] = [0, 0];
  for (let i = 0; i < song.section.notes.length; i++) {
    if (song.section.notes[i].rest) continue;
    const p = phraseOf(song, i);
    const len = (x: [number, number]) => song.section.notes[x[1]].start + song.section.notes[x[1]].beats - song.section.notes[x[0]].start;
    if (len(p) > len(best)) best = p;
    i = p[1];
  }
  return best;
}

