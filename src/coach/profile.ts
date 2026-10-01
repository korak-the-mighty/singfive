// The singer profile: what YOUR FIVE SONGS reveal, together.
// Rebuilt from all accumulated takes each time, so it grows with the evidence.

import { midiToName } from '../songs/notation';
import { songTags, songTraits } from '../songs/traits';
import type { Evidence, ProfileSection, SingerProfile, Song, Take } from '../types';
import { findingsForTake, type Finding } from './findings';
import { buildVoiceMap, melodyShape, suggestShift, type VoiceMap } from './voice';
import { count, list, rangeWords, semitoneWords } from './words';

export interface ProfileInput {
  five: Song[];
  firstFive: Song[];
  takes: Take[];
  bestTakeIds: Record<string, string | undefined>;
  candidates: Song[];
}

type Item = { text: string; evidence: Evidence; proof?: string[] };

const RECURRING: Record<string, string> = {
  'high-flat': 'the high notes go flat',
  'high-sharp': 'the high notes go sharp',
  'long-waver': 'long notes waver',
  'long-sag': 'long notes sink at the end',
  'long-short': 'long notes get cut short',
  'leaps-short': 'jumps up fall short',
  'tuning-loose': 'the tuning is loose',
  'drift-down': 'you drift flat over the song',
  'drift-up': 'you drift sharp over the song',
  rushing: 'you speed up',
  dragging: 'you slow down',
  'late-in': 'you come in late',
  breaks: 'you stop for air mid-line',
  pushing: 'the top gets forced',
  scoops: 'you slide up into notes',
  'interval-miss': 'a jump misses its note',
};

export function representativeTake(songId: string, takes: Take[], bestId?: string): Take | null {
  const mine = takes.filter((t) => t.songId === songId && t.kind !== 'practice' && t.analysis?.matched);
  if (!mine.length) return null;
  return mine.find((t) => t.id === bestId) ?? mine[mine.length - 1];
}

function rank(t: Take): number {
  const m = t.analysis!.measures!;
  return (m.inTuneShare ?? 0) - (m.wanderCents ?? 20) / 60 - m.missedShare;
}

export function buildProfile(input: ProfileInput): SingerProfile {
  const { five, firstFive, takes } = input;
  const reps = five
    .map((s) => ({ song: s, take: representativeTake(s.id, takes, input.bestTakeIds[s.id]) }))
    .filter((x): x is { song: Song; take: Take } => !!x.take);
  const map = buildVoiceMap(takes.filter((t) => t.kind !== 'practice'));
  const findings = new Map<string, Finding[]>(reps.map((r) => [r.song.id, findingsForTake(r.song, r.take.analysis!, r.take.feeling)]));
  const sections: ProfileSection[] = [];

  // 1. What we already know about your voice.
  const know: Item[] = [];
  if (map.lowest != null && map.highest != null) {
    know.push({
      text: `We’ve heard you sing from ${midiToName(map.lowest)} to ${midiToName(map.highest)}: ${rangeWords(map.lowest, map.highest)}.`,
      evidence: 'heard',
      proof: [`${map.notesHeard} notes heard across ${count(new Set(takes.filter((t) => t.analysis?.matched).map((t) => t.songId)).size, 'song')}`],
    });
  }
  if (map.steady) {
    know.push({
      text: `You are steadiest and most in tune between ${midiToName(map.steady.low)} and ${midiToName(map.steady.high)}.`,
      evidence: 'heard',
      proof: steadyProof(map),
    });
  } else if (map.notesHeard >= 10) {
    know.push({ text: 'We haven’t found a part of your range that is reliably steady yet.', evidence: 'unsure' });
  }
  const vib = reps.filter((r) => r.take.analysis!.measures!.vibrato.present);
  if (vib.length >= 2) know.push({ text: `You have a natural vibrato on long notes. We heard it in ${count(vib.length, 'song')}.`, evidence: 'heard' });
  else if (reps.length >= 3 && vib.length === 0) know.push({ text: 'Your long notes are straight, without vibrato. That’s neither good nor bad; it’s your sound for now.', evidence: 'heard' });
  sections.push({ id: 'know', title: 'What we already know about your voice', items: know });

  // 2. Where you sound strongest.
  const strong: Item[] = [];
  if (reps.length) {
    const sorted = [...reps].sort((a, b) => rank(b.take) - rank(a.take));
    const top = sorted[0];
    const topFind = findings.get(top.song.id)!.filter((f) => f.tone === 'strength');
    if (topFind.length) {
      strong.push({
        text: `${top.song.title} is where you sound most settled right now. ${topFind
          .slice(0, 2)
          .map((f) => f.text)
          .join(' ')}`,
        evidence: 'heard',
        proof: topFind.flatMap((f) => f.proof).slice(0, 3),
      });
    } else {
      strong.push({ text: `${top.song.title} came out most even of your five, though none were easy.`, evidence: 'heard' });
    }
    const allNotes = reps.flatMap((r) => r.take.analysis!.notes.filter((n) => n.status === 'sung'));
    const regs = ['low', 'mid', 'high'] as const;
    const regOff = regs.map((k) => {
      const xs = reps.map((r) => r.take.analysis!.measures!.registers[k].meanOff).filter((x): x is number => x != null);
      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
    });
    const bestReg = regOff.reduce<number>((b, x, i) => (x != null && (b < 0 || x < (regOff[b] ?? 999)) ? i : b), -1);
    if (bestReg >= 0 && allNotes.length >= 15) {
      const label = ['the lower part of each melody', 'the middle of each melody', 'the high parts of each melody'][bestReg];
      const others = regOff.filter((x, i) => x != null && i !== bestReg) as number[];
      if (others.length && Math.min(...others) - regOff[bestReg]! >= 8) {
        strong.push({ text: `Across your songs, you’re most in tune in ${label}.`, evidence: 'heard', proof: regs.map((k, i) => `${k}: ${regOff[i] == null ? '–' : Math.round(regOff[i]!)} cents average`) });
      }
    }
  }
  sections.push({ id: 'strongest', title: 'Where you sound strongest', items: strong });

  // 3. What changes from song to song.
  const changes: Item[] = [];
  if (reps.length >= 3) {
    const wide = reps.filter((r) => songTraits(r.song).spanSemitones >= 12);
    const narrow = reps.filter((r) => songTraits(r.song).spanSemitones < 12);
    const avgOff = (xs: typeof reps) => xs.reduce((s, r) => s + (r.take.analysis!.measures!.meanOffCents ?? 0), 0) / xs.length;
    if (wide.length && narrow.length) {
      const dw = avgOff(wide);
      const dn = avgOff(narrow);
      if (dw - dn >= 10) changes.push({ text: `Your tuning holds in songs with a small range (${list(narrow.map((r) => r.song.title))}) and slips in the wide ones (${list(wide.map((r) => r.song.title))}).`, evidence: 'heard', proof: [`Narrow songs: ${Math.round(dn)} cents average · wide songs: ${Math.round(dw)} cents`] });
      else if (dn - dw >= 10) changes.push({ text: `Interesting: you’re more in tune in the wide songs than the narrow ones. The bigger shapes may suit you.`, evidence: 'heard', proof: [`Narrow: ${Math.round(dn)} cents · wide: ${Math.round(dw)} cents`] });
    }
    const strict = reps.filter((r) => r.song.section.timeFeel === 'strict');
    const rushers = strict.filter((r) => (r.take.analysis!.measures!.tempoChangePct ?? 0) >= 7);
    if (strict.length >= 2 && rushers.length === strict.length) changes.push({ text: `In every song with a steady beat, you sped up: ${list(strict.map((r) => r.song.title))}.`, evidence: 'heard' });
    else if (strict.length === 1 && rushers.length === 1) changes.push({ text: `${strict[0].song.title} is your one song with a steady beat, and you sped up in it. The slower songs don’t show this.`, evidence: 'heard' });
    const longy = reps.filter((r) => r.take.analysis!.measures!.longNotes.wanderCents != null);
    if (longy.length >= 3) {
      const ws = longy.map((r) => ({ t: r.song.title, w: r.take.analysis!.measures!.longNotes.wanderCents! }));
      ws.sort((a, b) => a.w - b.w);
      if (ws[ws.length - 1].w - ws[0].w >= 10) changes.push({ text: `Your long notes are steady in ${ws[0].t} but waver in ${ws[ws.length - 1].t}.`, evidence: 'heard', proof: ws.map((x) => `${x.t}: ${x.w} cents`) });
    }
    if (!changes.length) changes.push({ text: 'You sound fairly similar from song to song. No single kind of song throws you yet.', evidence: 'heard' });
  } else {
    changes.push({ text: 'We need at least three of your songs to see what changes between them.', evidence: 'unsure' });
  }
  sections.push({ id: 'changes', title: 'What changes from song to song', items: changes });

  // 4. What your Five say about the songs you choose.
  const choose: Item[] = [];
  const chosen = firstFive.length ? firstFive : five;
  const tagCount = new Map<string, number>();
  for (const s of chosen) for (const t of songTags(s)) if (t !== 'an octave') tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
  const most = [...tagCount.entries()].sort((a, b) => b[1] - a[1])[0];
  if (most && most[1] >= 3) {
    choose.push({
      text: most[1] >= chosen.length ? `Every one of your first five has ${most[0]}. That’s what you were drawn to.` : `You were drawn to songs with ${most[0]}: ${count(most[1], 'of your first five', 'of your first five')} have it.`,
      evidence: 'heard',
    });
  }
  const absent = ['wide range', 'big leaps', 'steady beat', 'long notes'].filter((t) => !tagCount.has(t));
  if (absent.length) choose.push({ text: `None of your first five asks for ${list(absent)}. That may be a belief about your voice worth testing.`, evidence: 'think' });
  // Belief vs evidence: where the songs sat in your voice vs where you're steadiest.
  if (map.steady && reps.length >= 3) {
    const centres = reps.map((r) => melodyShape(r.song).centre + r.take.analysis!.measures!.keyShift);
    const below = centres.filter((c) => c < map.steady!.low).length;
    const above = centres.filter((c) => c > map.steady!.high).length;
    const zone = `${midiToName(map.steady.low)}–${midiToName(map.steady.high)}`;
    if (below >= 3) choose.push({ text: `You sang ${count(below, 'of your songs', 'of your songs')} low, but your steadiest notes are higher (${zone}). Your voice may be higher than you think.`, evidence: 'heard' });
    else if (above >= 3) choose.push({ text: `You sang ${count(above, 'of your songs', 'of your songs')} high, but your steadiest notes are lower (${zone}). You may be reaching for a voice you don’t need.`, evidence: 'heard' });
    else choose.push({ text: 'You placed most of your songs where your voice is steadiest. Your instinct for your own voice is good.', evidence: 'heard' });
  }
  const easyButHard = reps.filter((r) => r.take.feeling?.includes('easy') && findings.get(r.song.id)!.some((f) => f.tone === 'difficulty' && f.weight >= 0.6));
  if (easyButHard.length) choose.push({ text: `${list(easyButHard.map((r) => r.song.title))} felt easy to you, but the recording shows work to do. Ease and accuracy aren’t the same thing yet.`, evidence: 'heard' });
  sections.push({ id: 'choose', title: 'What your Five say about the songs you choose', items: choose });

  // 5. What seems difficult.
  const hard: Item[] = [];
  const byKey = new Map<string, string[]>();
  for (const r of reps) for (const f of findings.get(r.song.id)!) if (f.tone === 'difficulty' && RECURRING[f.key]) byKey.set(f.key, [...(byKey.get(f.key) ?? []), r.song.title]);
  const priority = Object.keys(RECURRING);
  const recurring = [...byKey.entries()]
    .filter(([, songs]) => songs.length >= 2)
    .sort((a, b) => b[1].length - a[1].length || priority.indexOf(a[0]) - priority.indexOf(b[0]));
  for (const [k, songs] of recurring.slice(0, 2)) hard.push({ text: `In ${count(songs.length, 'of your songs', 'of your songs')}, ${RECURRING[k]}: ${list(songs)}.`, evidence: 'heard' });
  if (!recurring.length) {
    const single = reps
      .flatMap((r) => findings.get(r.song.id)!.filter((f) => f.tone === 'difficulty').map((f) => ({ f, song: r.song })))
      .sort((a, b) => b.f.weight - a.f.weight)[0];
    if (single) hard.push({ text: `In ${single.song.title}: ${single.f.text.charAt(0).toLowerCase()}${single.f.text.slice(1)} It doesn’t show up in your other songs.`, evidence: 'heard', proof: single.f.proof });
    else if (reps.length) hard.push({ text: 'Nothing stood out as difficult across your songs. That usually means the songs aren’t asking enough of you yet.', evidence: 'think' });
  }
  if (recurring.some(([k]) => k === 'high-flat')) hard.push({ text: 'When the same thing happens in several songs, it’s about your voice, not the song. That makes it worth working on.', evidence: 'think' });
  sections.push({ id: 'hard', title: 'What seems difficult', items: hard });

  // 6. What we don't know yet.
  const unknown: Item[] = [];
  const takesPerSong = five.map((s) => takes.filter((t) => t.songId === s.id && t.kind !== 'practice' && t.analysis?.matched).length);
  if (takesPerSong.every((n) => n <= 1)) unknown.push({ text: 'Which of this is a habit and which was a moment. We’ve heard each song once.', evidence: 'unsure' });
  if (map.highest != null) unknown.push({ text: `How your voice behaves above ${midiToName(map.highest)}. None of your songs went there.`, evidence: 'unsure' });
  if (recurring.some(([k]) => k === 'high-flat' || k === 'pushing')) unknown.push({ text: 'Whether the high notes struggle because of the key or because of effort. Singing one song a little lower will tell us.', evidence: 'unsure' });
  unknown.push({ text: 'Whether you sound like yourself or like the record. Audio alone can’t tell us that. Your ears can.', evidence: 'unsure' });
  sections.push({ id: 'unknown', title: 'What we don’t know yet', items: unknown.slice(0, 3) });

  // 7. What to explore next.
  const next: Item[] = [];
  for (const r of reps) {
    const f = findings.get(r.song.id)!;
    if (f.some((x) => x.key === 'high-flat' || x.key === 'octave-switch')) {
      const shift = suggestShift(r.song, map);
      const now = r.take.analysis!.measures!.keyShift;
      if (shift != null && shift < now - 0.8) {
        next.push({ text: `Sing ${r.song.title} again ${semitoneWords(now - shift)} lower. If the top settles, it was the key, not you.`, evidence: 'think' });
        break;
      }
    }
  }
  const focusSong = reps
    .map((r) => ({ r, f: findings.get(r.song.id)!.find((x) => x.tone === 'difficulty' && x.focus) }))
    .filter((x) => x.f)
    .sort((a, b) => b.f!.weight - a.f!.weight)[0];
  if (focusSong) next.push({ text: `Open ${focusSong.r.song.title}: it has a short practice waiting, built from your take.`, evidence: 'think' });
  const gap = coverageGap(five, input.candidates);
  if (gap) next.push({ text: gap, evidence: 'think' });
  if (!next.length) next.push({ text: 'Sing any one of your five again. The second take is where we start to learn what’s really yours.', evidence: 'think' });
  sections.push({ id: 'next', title: 'What to explore next', items: next.slice(0, 3) });

  const firstSentence = (t?: string) => (t ? t.split(/(?<=\.)\s/)[0] : undefined);
  const headline =
    choose.find((i) => i.text.includes('than you think') || i.text.includes('don’t need'))?.text ??
    hard.find((i) => / of your songs, /.test(i.text))?.text ??
    firstSentence(strong[0]?.text) ??
    choose.find((i) => i.text.includes('steadiest'))?.text ??
    'Sing your five songs, and we’ll start to understand your voice.';

  const now = Date.now();
  return { createdAt: now, updatedAt: now, sections, headline, source: 'rules' };
}

function steadyProof(map: VoiceMap): string[] {
  return map.bins
    .filter((b) => b.midi >= map.steady!.low && b.midi <= map.steady!.high)
    .slice(0, 6)
    .map((b) => `${midiToName(b.midi)}: ${b.n} notes, ${Math.round(b.meanOff)} cents off on average`);
}

export function coverageGap(five: Song[], candidates: Song[]): string | null {
  const have = new Set(five.flatMap((s) => songTags(s)));
  const order = ['wide range', 'steady beat', 'big leaps', 'long notes'];
  for (const tag of order) {
    if (have.has(tag)) continue;
    const c = candidates.find((s) => songTags(s).includes(tag));
    if (c) return `Your Five has no song with ${tag}. ${c.title} would add it. You could audition it.`;
  }
  return null;
}
