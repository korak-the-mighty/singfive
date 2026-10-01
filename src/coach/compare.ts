// Same song, two takes: what actually changed?
//
// Only differences bigger than normal take-to-take variation are reported,
// so "better" means better, not noise.

import { wordAt } from '../songs/notation';
import type { Song, TakeAnalysis } from '../types';
import { phraseOf } from './findings';
import { pitchWords, quoteWord, semitoneWords } from './words';

export type Verdict = 'better' | 'worse' | 'mixed' | 'same' | 'cant-tell';

export interface Change {
  key: string;
  tone: 'better' | 'worse' | 'same' | 'neutral';
  text: string;
  proof: string[];
  weight: number;
}

export interface Comparison {
  verdict: Verdict;
  headline: string;
  changes: Change[];
}

const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

export function phrases(song: Song): [number, number][] {
  const out: [number, number][] = [];
  const ns = song.section.notes;
  for (let i = 0; i < ns.length; i++) {
    if (ns[i].rest) continue;
    const p = phraseOf(song, i);
    out.push(p);
    i = p[1];
  }
  return out;
}

function phraseStats(a: TakeAnalysis, ph: [number, number]) {
  const ns = a.notes.filter((n) => n.ref >= ph[0] && n.ref <= ph[1] && n.status === 'sung');
  if (ns.length < 2) return null;
  return ns.reduce((s, n) => s + Math.abs(n.offCents!), 0) / ns.length;
}

const meanDb = (a: TakeAnalysis) => {
  const d = a.notes.map((n) => n.db).filter((x): x is number => x != null);
  return d.length ? d.reduce((x, y) => x + y, 0) / d.length : null;
};

export function compareTakes(song: Song, now: TakeAnalysis, before: TakeAnalysis): Comparison {
  const changes: Change[] = [];
  const A = now.measures;
  const B = before.measures;
  if (!A || !B || !now.matched || !before.matched) {
    return {
      verdict: 'cant-tell',
      headline: 'We can’t compare these two takes: one of them couldn’t be matched to the melody.',
      changes,
    };
  }
  const ns = song.section.notes;
  const push = (c: Change) => changes.push(c);
  const better = (key: string, text: string, proof: string[], weight = 0.6) => push({ key, tone: 'better', text, proof, weight });
  const worse = (key: string, text: string, proof: string[], weight = 0.6) => push({ key, tone: 'worse', text, proof, weight });

  // Tuning overall.
  if (A.meanOffCents != null && B.meanOffCents != null) {
    const d = B.meanOffCents - A.meanOffCents;
    const proof = [`Average distance from the note: ${B.meanOffCents} → ${A.meanOffCents} cents`];
    if (d >= Math.max(6, 0.25 * B.meanOffCents)) better('tuning', 'You were more in tune than before.', proof, 0.8);
    else if (-d >= Math.max(6, 0.25 * A.meanOffCents)) worse('tuning', 'The tuning was looser than before.', proof, 0.8);
  }

  // Long notes: compare the same note when we can.
  const longest = longestSung(now, before, song);
  if (longest != null) {
    const a = now.notes.find((n) => n.ref === longest)!;
    const b = before.notes.find((n) => n.ref === longest)!;
    const w = quoteWord(wordAt(ns, longest));
    const d = b.wanderCents! - a.wanderCents!;
    const proof = [`Wander on ${w}: ${b.wanderCents} → ${a.wanderCents} cents`];
    if (d >= Math.max(4, 0.3 * b.wanderCents!)) better('long-note', `The long note on ${w} is steadier than last time.`, proof, 0.75);
    else if (-d >= Math.max(4, 0.3 * a.wanderCents!)) worse('long-note', `The long note on ${w} wavered more than before.`, proof, 0.7);
  } else if (A.longNotes.wanderCents != null && B.longNotes.wanderCents != null) {
    const d = B.longNotes.wanderCents - A.longNotes.wanderCents;
    const proof = [`Long-note wander: ${B.longNotes.wanderCents} → ${A.longNotes.wanderCents} cents`];
    if (d >= Math.max(4, 0.3 * B.longNotes.wanderCents)) better('long-note', 'Your long notes are steadier than before.', proof, 0.7);
    else if (-d >= Math.max(4, 0.3 * A.longNotes.wanderCents)) worse('long-note', 'Your long notes wavered more than before.', proof, 0.65);
  }
  if (A.longNotes.endDriftCents != null && B.longNotes.endDriftCents != null) {
    if (B.longNotes.endDriftCents <= -20 && A.longNotes.endDriftCents - B.longNotes.endDriftCents >= 15) {
      better('sag', 'The long notes no longer sink as much at the end.', [`End drift: ${B.longNotes.endDriftCents} → ${A.longNotes.endDriftCents} cents`], 0.6);
    }
  }

  // High notes.
  const hb = B.registers.high.bias;
  const ha = A.registers.high.bias;
  if (hb != null && ha != null) {
    const d = Math.abs(hb) - Math.abs(ha);
    const proof = [`High notes: ${hb} → ${ha} cents`];
    if (Math.abs(hb) >= 20 && d >= 15) better('high', 'The high notes are closer to the note than before.', proof, 0.75);
    else if (Math.abs(ha) >= 20 && -d >= 15) worse('high', `The high notes were further off this time (${pitchWords(ha)}).`, proof, 0.7);
  }

  // Holding the key.
  if (A.keyDriftCents != null && B.keyDriftCents != null) {
    const d = Math.abs(B.keyDriftCents) - Math.abs(A.keyDriftCents);
    const proof = [`Drift across the take: ${B.keyDriftCents} → ${A.keyDriftCents} cents`];
    if (Math.abs(B.keyDriftCents) >= 30 && d >= 20) better('drift', 'You held your key better from start to finish.', proof, 0.65);
    else if (Math.abs(A.keyDriftCents) >= 30 && -d >= 20) worse('drift', 'You drifted further from your starting key this time.', proof, 0.6);
  }

  // Jumps.
  if (A.leapsUp.bias != null && B.leapsUp.bias != null && A.leapsUp.n >= 2) {
    const d = Math.abs(B.leapsUp.bias) - Math.abs(A.leapsUp.bias);
    if (Math.abs(B.leapsUp.bias) >= 20 && d >= 15) better('leaps', 'Your jumps up land closer than before.', [`Upward jumps: ${B.leapsUp.bias} → ${A.leapsUp.bias} cents`], 0.6);
  }

  // Time.
  if (A.entranceMs != null && B.entranceMs != null) {
    const d = Math.abs(B.entranceMs) - Math.abs(A.entranceMs);
    const proof = [`Entrance: ${B.entranceMs} → ${A.entranceMs} ms from the beat`];
    if (Math.abs(A.entranceMs) <= 150 && Math.abs(B.entranceMs) <= 150) push({ key: 'entrance', tone: 'same', text: 'You’re hitting the entrance consistently now.', proof, weight: 0.45 });
    else if (d >= 150) better('entrance', 'You came in closer to the beat.', proof, 0.55);
    else if (-d >= 150) worse('entrance', 'You came in further from the beat than before.', proof, 0.5);
  }
  if (A.tempoChangePct != null && B.tempoChangePct != null) {
    const d = Math.abs(B.tempoChangePct) - Math.abs(A.tempoChangePct);
    const proof = [`Speed change within the take: ${B.tempoChangePct}% → ${A.tempoChangePct}%`];
    if (Math.abs(B.tempoChangePct) >= 6 && d >= 5) better('tempo', 'Your tempo held steadier.', proof, 0.6);
    else if (Math.abs(A.tempoChangePct) >= 6 && -d >= 5) worse('tempo', A.tempoChangePct > 0 ? 'You rushed more than before.' : 'You dragged more than before.', proof, 0.55);
  }
  if (A.timingSpreadMs != null && B.timingSpreadMs != null && song.section.timeFeel === 'strict') {
    const d = B.timingSpreadMs - A.timingSpreadMs;
    const proof = [`Typical timing error: ${B.timingSpreadMs} → ${A.timingSpreadMs} ms`];
    if (d >= Math.max(20, 0.3 * B.timingSpreadMs)) better('beat', 'Your beat was tighter.', proof, 0.55);
    else if (-d >= Math.max(20, 0.3 * A.timingSpreadMs)) worse('beat', 'Your beat was looser.', proof, 0.5);
  }

  // Breath and completeness.
  if (B.midPhraseBreaks - A.midPhraseBreaks >= 1 && B.midPhraseBreaks >= 1) {
    better('breath', 'Fewer breaks for air in the middle of lines.', [`Mid-line breaks: ${B.midPhraseBreaks} → ${A.midPhraseBreaks}`], 0.5);
  } else if (A.midPhraseBreaks - B.midPhraseBreaks >= 2) {
    worse('breath', 'More breaks for air in the middle of lines.', [`Mid-line breaks: ${B.midPhraseBreaks} → ${A.midPhraseBreaks}`], 0.45);
  }
  if (B.missedShare - A.missedShare >= 0.1) better('complete', 'More of the notes came through.', [`Notes without voice: ${Math.round(B.missedShare * 100)}% → ${Math.round(A.missedShare * 100)}%`], 0.5);
  else if (A.missedShare - B.missedShare >= 0.1) worse('complete', 'More notes were lost this time.', [`Notes without voice: ${Math.round(B.missedShare * 100)}% → ${Math.round(A.missedShare * 100)}%`], 0.5);

  // Less force, more stability.
  const dbA = meanDb(now);
  const dbB = meanDb(before);
  const steadier = changes.some((c) => c.tone === 'better' && (c.key === 'long-note' || c.key === 'tuning' || c.key === 'high'));
  if (dbA != null && dbB != null && dbB - dbA >= 3 && steadier) {
    push({
      key: 'less-force',
      tone: 'better',
      text: 'You used less force and gained stability.',
      proof: [`About ${Math.round(dbB - dbA)} dB softer overall`],
      weight: 0.85,
    });
  }

  // Key.
  if (Math.abs(A.keyShift - B.keyShift) >= 0.8) {
    const lower = A.keyShift < B.keyShift;
    push({
      key: 'key',
      tone: 'neutral',
      text: `You sang it ${semitoneWords(A.keyShift - B.keyShift)} ${lower ? 'lower' : 'higher'} this time.`,
      proof: [],
      weight: 0.3,
    });
  }

  // Lines: where the pitch still drifts, or where it settled.
  const phs = phrases(song);
  const statsA = phs.map((p) => phraseStats(now, p));
  const statsB = phs.map((p) => phraseStats(before, p));
  const worstIdx = (xs: (number | null)[]) => xs.reduce<number>((best, x, i) => (x != null && (best < 0 || x > (xs[best] ?? -1)) ? i : best), -1);
  const wa = worstIdx(statsA);
  const wb = worstIdx(statsB);
  if (phs.length > 1 && wa >= 0 && wa === wb && (statsA[wa] ?? 0) >= 28 && (statsB[wb] ?? 0) >= 28) {
    push({
      key: 'line-still',
      tone: 'same',
      text: `The ${ORD[wa] ?? 'same'} line is still where the pitch drifts.`,
      proof: [`Average distance on that line: ${Math.round(statsB[wb]!)} → ${Math.round(statsA[wa]!)} cents`],
      weight: 0.55,
    });
  } else if (phs.length > 1 && wb >= 0 && (statsB[wb] ?? 0) >= 28 && statsA[wb] != null && statsB[wb]! - statsA[wb]! >= 12) {
    push({
      key: 'line-settled',
      tone: 'better',
      text: `The ${ORD[wb] ?? ''} line, where the pitch used to drift, has settled.`,
      proof: [`Average distance on that line: ${Math.round(statsB[wb]!)} → ${Math.round(statsA[wb]!)} cents`],
      weight: 0.6,
    });
  }

  // One note that turned around.
  let bestTurn: { ref: number; from: number; to: number } | null = null;
  for (const a of now.notes) {
    const b = before.notes.find((x) => x.ref === a.ref);
    if (!b || a.status !== 'sung' || b.status !== 'sung') continue;
    const gain = Math.abs(b.offCents!) - Math.abs(a.offCents!);
    if (gain >= 35 && Math.abs(a.offCents!) <= 20 && (!bestTurn || gain > Math.abs(bestTurn.from) - Math.abs(bestTurn.to))) {
      bestTurn = { ref: a.ref, from: b.offCents!, to: a.offCents! };
    }
  }
  if (bestTurn) {
    push({
      key: 'note-fixed',
      tone: 'better',
      text: `${quoteWord(wordAt(ns, bestTurn.ref))} is on the note now.`,
      proof: [`${bestTurn.from} → ${bestTurn.to} cents`],
      weight: 0.5,
    });
  }

  changes.sort((x, y) => y.weight - x.weight);
  const up = changes.filter((c) => c.tone === 'better').reduce((s, c) => s + c.weight, 0);
  const down = changes.filter((c) => c.tone === 'worse').reduce((s, c) => s + c.weight, 0);
  let verdict: Verdict;
  let headline: string;
  if (up === 0 && down === 0) {
    verdict = 'same';
    headline = 'About the same as before. Nothing changed beyond the normal difference between two takes.';
  } else if (down === 0 || up >= down * 2.5) {
    verdict = 'better';
    headline = 'Yes. You sang it better than before.';
  } else if (up === 0 || down >= up * 2.5) {
    verdict = 'worse';
    headline = 'Not this time. This take was weaker than before. That happens; one take is one take.';
  } else {
    verdict = 'mixed';
    headline = 'Partly. Some things got better, some got worse.';
  }
  return { verdict, headline, changes };
}

function longestSung(a: TakeAnalysis, b: TakeAnalysis, song: Song): number | null {
  let best: number | null = null;
  for (const n of a.notes) {
    const m = b.notes.find((x) => x.ref === n.ref);
    if (!m || n.wanderCents == null || m.wanderCents == null || n.status !== 'sung' || m.status !== 'sung') continue;
    if (best == null || song.section.notes[n.ref].beats > song.section.notes[best].beats) best = n.ref;
  }
  if (best == null) return null;
  return song.section.notes[best].beats >= 1.5 ? best : null;
}
