// What the coach says right after you sing: short, honest, about this song.

import type { Evidence, Feeling, Observation, Song, TakeAnalysis } from '../types';
import { compareTakes, type Comparison } from './compare';
import { findingsForTake, type Finding } from './findings';

export interface NoteLine {
  text: string;
  evidence: Evidence;
  tone: 'strength' | 'difficulty' | 'neutral' | 'better' | 'worse' | 'same';
  proof: string[];
}

export interface TakeNote {
  /** Recording problem that stopped us from listening properly. */
  problem: string | null;
  headline: string;
  lines: NoteLine[];
  comparison: Comparison | null;
  findings: Finding[];
}

export function qualityMessage(a: TakeAnalysis, song: Song): string | null {
  const q = a.quality;
  if (q.issues.includes('no-voice')) return 'We couldn’t hear any singing. Check that the right microphone is on, and try again a little closer.';
  if (q.issues.includes('short')) return 'That was too short for us to learn from. Try singing the whole section.';
  if (!a.matched) return `We heard you, but couldn’t follow the melody of ${song.title}. Play “Hear how it goes” first, then sing the words on screen.`;
  return null;
}

export function softQualityHints(a: TakeAnalysis): string[] {
  const out: string[] = [];
  if (a.quality.issues.includes('clipping')) out.push('Your voice was too loud for the microphone in places. Move back a little.');
  if (a.quality.issues.includes('quiet')) out.push('You were quiet. We could follow, but sing a little closer to the microphone next time.');
  if (a.quality.issues.includes('noisy')) out.push('There’s noise in the room. A quieter spot will help us hear you better.');
  return out;
}

export function noteForTake(opts: {
  song: Song;
  analysis: TakeAnalysis;
  feeling?: Feeling[];
  /** A previous take of the same song to compare with (your best, or your last). */
  before?: TakeAnalysis | null;
  beforeLabel?: string;
  history?: Observation[];
}): TakeNote {
  const { song, analysis } = opts;
  const problem = qualityMessage(analysis, song);
  if (problem) return { problem, headline: problem, lines: [], comparison: null, findings: [] };

  const findings = findingsForTake(song, analysis, opts.feeling ?? []);
  const lines: NoteLine[] = [];
  const asLine = (f: Finding): NoteLine => ({ text: f.text, evidence: f.evidence, tone: f.tone, proof: f.proof });

  let comparison: Comparison | null = null;
  if (opts.before && opts.before.matched) comparison = compareTakes(song, analysis, opts.before);

  let headline: string;
  if (comparison && comparison.verdict !== 'cant-tell') {
    headline = comparison.headline;
    for (const c of comparison.changes.slice(0, 3)) {
      lines.push({ text: c.text, evidence: 'heard', tone: c.tone, proof: c.proof });
    }
    // One thing still to work on, if it's not already said.
    const still = findings.find((f) => f.tone === 'difficulty' && f.evidence === 'heard');
    if (still && !lines.some((l) => l.text === still.text)) lines.push({ ...asLine(still), tone: 'same' });
  } else {
    const strength = findings.find((f) => f.tone === 'strength');
    const difficulty = findings.find((f) => f.tone === 'difficulty');
    const belief = findings.find((f) => f.key.startsWith('belief'));
    // Lead with what matters most, whether it's good news or not.
    const leadWithDifficulty = !!difficulty && (!strength || difficulty.weight > strength.weight + 0.1);
    headline = leadWithDifficulty ? difficulty!.text : strength ? strength.text : 'We heard you.';
    if (belief) lines.push(asLine(belief));
    if (leadWithDifficulty && strength) lines.push(asLine(strength));
    if (difficulty && difficulty !== belief) {
      const alreadySaid = belief?.key === 'belief-easy' || leadWithDifficulty;
      if (!alreadySaid) lines.push(asLine(difficulty));
      const why = findings.find((f) => f.key === `${difficulty.key}:why`);
      if (why) lines.push(asLine(why));
    }
    const second = findings.find((f) => f.tone === 'strength' && f !== strength);
    if (second && lines.length < 3) lines.push(asLine(second));
    const seenBefore = opts.history?.some((o) => o.songId === song.id) ?? false;
    if (!seenBefore && lines.length < 4) {
      lines.push({
        text: 'One take isn’t a pattern yet. The next time you sing it, we’ll know what’s a habit and what was a moment.',
        evidence: 'unsure',
        tone: 'neutral',
        proof: [],
      });
    }
  }
  return { problem: null, headline, lines: lines.slice(0, 4), comparison, findings };
}
