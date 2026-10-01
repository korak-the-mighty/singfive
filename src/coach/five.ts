// Your Five can always change. The coach can suggest a change; you decide.

import { songTags } from '../songs/traits';
import type { Song, Take, TakeAnalysis } from '../types';
import { findingsForTake } from './findings';
import { coverageGap, representativeTake } from './profile';
import { list } from './words';

export interface Suggestion {
  id: string;
  kind: 'learned' | 'stuck' | 'gap' | 'same-thing';
  text: string;
  songId?: string;
  candidates: string[];
}

const matched = (takes: Take[], songId: string) =>
  takes.filter((t) => t.songId === songId && (t.kind === 'first' || t.kind === 'again'));

export function isLearned(songId: string, takes: Take[]): boolean {
  const ts = matched(takes, songId).filter((t) => t.analysis?.matched);
  if (ts.length < 3) return false;
  return ts.slice(-2).every((t) => {
    const m = t.analysis!.measures!;
    return (m.inTuneShare ?? 0) >= 0.85 && (m.wanderCents ?? 99) <= 10 && m.missedShare <= 0.05;
  });
}

export function fiveSuggestions(five: Song[], takes: Take[], candidates: Song[]): Suggestion[] {
  const out: Suggestion[] = [];
  const harder = (s: Song) =>
    candidates.filter((c) => {
      const t = songTags(c);
      return t.includes('wide range') || t.includes('big leaps');
    }).filter((c) => c.id !== s.id);

  const learned = five.filter((s) => isLearned(s.id, takes));
  if (learned.length === 1) {
    const s = learned[0];
    out.push({
      id: `learned:${s.id}`,
      kind: 'learned',
      songId: s.id,
      text: `${s.title} has taught us what it can for now: your last takes were in tune and steady. Keep it as proof, or swap in something that asks more.`,
      candidates: harder(s).map((c) => c.id).slice(0, 3),
    });
  } else if (learned.length > 1) {
    out.push({
      id: 'learned:many',
      kind: 'learned',
      text: `${list(learned.map((s) => s.title))} have taught us what they can for now: your last takes of each were in tune and steady. Keep them as proof, or swap one for a song that asks more.`,
      candidates: harder(learned[0]).map((c) => c.id).slice(0, 3),
    });
  }
  for (const s of five) {
    const ts = matched(takes, s.id);
    const last2 = ts.slice(-2);
    if (last2.length === 2 && last2.every((t) => t.analysis && t.analysis.quality.ok && !t.analysis.matched)) {
      out.push({
        id: `stuck:${s.id}`,
        kind: 'stuck',
        songId: s.id,
        text: `${s.title} isn’t working yet: twice we couldn’t follow the melody. It may not be the right song for now, and that’s useful to know.`,
        candidates: candidates.map((c) => c.id).slice(0, 3),
      });
    }
  }

  const tagCount = new Map<string, number>();
  for (const s of five) for (const t of songTags(s)) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
  const top = [...tagCount.entries()].sort((a, b) => b[1] - a[1])[0];
  const missing = ['wide range', 'big leaps', 'steady beat'].filter((t) => !tagCount.has(t));
  if (top && top[1] >= 4 && missing.length) {
    const cands = candidates.filter((c) => songTags(c).includes(missing[0]));
    out.push({
      id: `same:${top[0]}`,
      kind: 'same-thing',
      text: `Four of your five songs test the same thing (${top[0]}). We’re missing a song that asks for ${missing[0]}.`,
      candidates: cands.map((c) => c.id).slice(0, 3),
    });
  } else {
    const gap = coverageGap(five, candidates);
    if (gap) {
      const tag = ['wide range', 'steady beat', 'big leaps', 'long notes'].find((t) => gap.includes(t))!;
      out.push({ id: `gap:${tag}`, kind: 'gap', text: gap, candidates: candidates.filter((c) => songTags(c).includes(tag)).map((c) => c.id).slice(0, 3) });
    }
  }
  return out;
}

/** What one song would bring to your Five that it doesn't have yet. */
export function whatItAdds(song: Song, five: Song[]): string[] {
  const have = new Set(five.filter((s) => s.id !== song.id).flatMap(songTags));
  return songTags(song).filter((t) => !have.has(t));
}

export interface AuditionVerdict {
  lines: string[];
  /** The slot the coach would let go of, if you take this song. */
  suggestReplace: string | null;
  reason: string | null;
}

export function auditionVerdict(candidate: Song, a: TakeAnalysis, five: Song[], takes: Take[], bestIds: Record<string, string | undefined>): AuditionVerdict {
  if (!a.quality.ok || !a.matched) {
    return { lines: ['We couldn’t follow this audition, so we can’t judge it yet. Try once more after listening to how it goes.'], suggestReplace: null, reason: null };
  }
  const lines: string[] = [];
  const adds = whatItAdds(candidate, five);
  if (adds.length) lines.push(`It adds ${list(adds)} to your Five.`);
  else lines.push('It doesn’t test anything your Five doesn’t already test. It might still be more yours.');
  const f = findingsForTake(candidate, a);
  const strength = f.find((x) => x.tone === 'strength');
  const difficulty = f.find((x) => x.tone === 'difficulty' && x.evidence === 'heard');
  if (strength) lines.push(`First try: ${strength.text.charAt(0).toLowerCase()}${strength.text.slice(1)}`);
  if (difficulty) lines.push(`${strength ? 'And' : 'First try'}: ${difficulty.text.charAt(0).toLowerCase()}${difficulty.text.slice(1)}`);

  // Which slot to let go: one that's learned, or one that duplicates the others most.
  let pick: string | null = null;
  let reason: string | null = null;
  const learned = five.find((s) => isLearned(s.id, takes));
  if (learned) {
    pick = learned.id;
    reason = `${learned.title} has taught us what it can for now.`;
  } else {
    const scored = five.map((s) => {
      const others = new Set(five.filter((o) => o.id !== s.id).flatMap(songTags));
      const unique = songTags(s).filter((t) => !others.has(t)).length;
      const rep = representativeTake(s.id, takes, bestIds[s.id]);
      const unmatched = takes.filter((t) => t.songId === s.id && t.analysis && !t.analysis.matched).length;
      return { s, unique, unmatched, has: !!rep };
    });
    scored.sort((x, y) => y.unmatched - x.unmatched || x.unique - y.unique);
    const c = scored[0];
    if (c) {
      pick = c.s.id;
      reason = c.unmatched
        ? `${c.s.title} has been hard to follow, so it’s teaching us less.`
        : `${c.s.title} tests things your other songs already test.`;
    }
  }
  return { lines, suggestReplace: pick, reason };
}
