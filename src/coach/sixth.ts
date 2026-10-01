// The Sixth: graduation. A hypothesis — "if we really understand your voice,
// you can sing this" — that tests the singer and the coach at once.

import { midiToName } from '../songs/notation';
import { songTags, sungNotes } from '../songs/traits';
import type { Sixth, Song, Take, TakeAnalysis } from '../types';
import { compareTakes } from './compare';
import { findingsForTake } from './findings';
import { representativeTake } from './profile';
import { buildVoiceMap, suggestShift } from './voice';
import { keyWords } from './words';

export interface Criterion {
  text: string;
  met: boolean;
  detail: string;
}

export function readiness(five: Song[], takes: Take[], bestIds: Record<string, string | undefined>): { ready: boolean; criteria: Criterion[] } {
  const songTakes = (id: string) => takes.filter((t) => t.songId === id && (t.kind === 'first' || t.kind === 'again') && t.analysis?.matched);
  const counts = five.map((s) => songTakes(s.id).length);
  const c1: Criterion = {
    text: 'You’ve sung every one of your five songs at least three times.',
    met: counts.every((n) => n >= 3),
    detail: five.map((s, i) => `${s.title}: ${counts[i]}`).join(' · '),
  };
  const improvedSongs = five.filter((s) => {
    const ts = songTakes(s.id);
    if (ts.length < 2) return false;
    const rep = representativeTake(s.id, takes, bestIds[s.id]);
    if (!rep || rep.id === ts[0].id) return false;
    const c = compareTakes(s, rep.analysis!, ts[0].analysis!);
    return c.verdict === 'better';
  });
  const c2: Criterion = {
    text: 'At least three of your songs are measurably better than your first take.',
    met: improvedSongs.length >= 3,
    detail: improvedSongs.length ? `Better so far: ${improvedSongs.map((s) => s.title).join(', ')}` : 'None yet',
  };
  const inTune = five.filter((s) => {
    const rep = representativeTake(s.id, takes, bestIds[s.id]);
    return (rep?.analysis?.measures?.inTuneShare ?? 0) >= 0.75;
  });
  const c3: Criterion = {
    text: 'Your best takes are in tune in at least four of your songs.',
    met: inTune.length >= 4,
    detail: `${inTune.length} of 5 so far`,
  };
  const map = buildVoiceMap(takes.filter((t) => t.kind !== 'practice'));
  const c4: Criterion = {
    text: 'The coach knows where your voice is steadiest.',
    met: !!map.steady && map.notesHeard >= 60,
    detail: map.steady ? `Steadiest between ${midiToName(map.steady.low)} and ${midiToName(map.steady.high)}, from ${map.notesHeard} notes` : `${map.notesHeard} notes heard so far`,
  };
  const criteria = [c1, c2, c3, c4];
  return { ready: criteria.every((c) => c.met), criteria };
}

export function proposeSixth(five: Song[], everInFive: Set<string>, takes: Take[], candidates: Song[]): Sixth | null {
  const map = buildVoiceMap(takes.filter((t) => t.kind !== 'practice'));
  if (!map.steady) return null;
  const pool = candidates.filter((c) => !everInFive.has(c.id));
  const list = (pool.length ? pool : candidates).map((song) => {
    const shift = suggestShift(song, map) ?? 0;
    const ns = sungNotes(song.section.notes);
    const inZone = ns.filter((n) => n.midi + shift >= map.steady!.low && n.midi + shift <= map.steady!.high).length / ns.length;
    return { song, shift, inZone };
  });
  list.sort((a, b) => b.inZone - a.inZone);
  const pick = list[0];
  if (!pick) return null;

  // Habits heard across the Five.
  const recurring = new Map<string, number>();
  for (const s of five) {
    const rep = representativeTake(s.id, takes);
    if (!rep) continue;
    for (const f of findingsForTake(s, rep.analysis!)) recurring.set(f.key, (recurring.get(f.key) ?? 0) + 1);
  }
  const has = (k: string) => (recurring.get(k) ?? 0) >= 2;
  const tags = songTags(pick.song);
  const top = Math.max(...sungNotes(pick.song.section.notes).map((n) => n.midi)) + pick.shift;
  const predictions: Sixth['predictions'] = [];
  predictions.push(
    pick.inZone >= 0.7
      ? { key: 'tuning', text: 'Most notes will land in tune.', expect: 'strong' }
      : { key: 'tuning', text: 'Tuning will be harder here than in your Five.', expect: 'hard' },
  );
  if (tags.includes('long notes')) {
    predictions.push(has('long-steady') ? { key: 'long', text: 'The long notes will be steady.', expect: 'strong' } : { key: 'long', text: 'The long notes will waver.', expect: 'hard' });
  }
  if (top > map.steady.high + 1 || has('high-flat')) predictions.push({ key: 'high', text: `The top note (${midiToName(top)}) will be the hardest part.`, expect: 'hard' });
  if (pick.song.section.timeFeel === 'strict') predictions.push(has('rushing') ? { key: 'tempo', text: 'You’ll want to speed up.', expect: 'hard' } : { key: 'tempo', text: 'You’ll keep the beat steady.', expect: 'strong' });
  if (tags.includes('big leaps')) predictions.push(has('leaps-short') ? { key: 'leaps', text: 'The jumps up will fall short.', expect: 'hard' } : { key: 'leaps', text: 'You’ll land the jumps.', expect: 'strong' });

  return {
    songId: pick.song.id,
    proposedAt: Date.now(),
    hypothesis: `If we really understand your voice, you can sing ${pick.song.title}, ${keyWords(pick.shift)}, the first time. You’ve never sung it here.`,
    predictions,
  };
}

export function judgeSixth(s: Sixth, a: TakeAnalysis): Sixth['verdict'] {
  const m = a.measures;
  if (!a.matched || !m) return [];
  return s.predictions.map((p) => {
    let happened: boolean;
    switch (p.key) {
      case 'tuning':
        happened = (m.inTuneShare ?? 0) >= 0.75;
        break;
      case 'long':
        happened = (m.longNotes.wanderCents ?? 99) <= 12;
        break;
      case 'high':
        happened = (m.registers.high.meanOff ?? 0) >= 25 || m.octaveJumps > 0;
        break;
      case 'tempo':
        happened = Math.abs(m.tempoChangePct ?? 0) < 6;
        break;
      case 'leaps':
        happened = (m.leapsUp.bias ?? 0) > -25;
        break;
      default:
        happened = false;
    }
    // For "hard" predictions, the event predicted is the difficulty.
    const right = p.expect === 'strong' ? happened : p.key === 'high' ? happened : !happened;
    return { key: p.key, right, text: `${p.text} ${right ? 'Right.' : 'Wrong.'}` };
  });
}
