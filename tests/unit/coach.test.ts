import { describe, expect, it } from 'vitest';
import { analyzeTake } from '../../src/analysis';
import { compareTakes } from '../../src/coach/compare';
import { findingsForTake } from '../../src/coach/findings';
import { buildProfile } from '../../src/coach/profile';
import { noteForTake } from '../../src/coach/takeNote';
import { getSong, SONGS } from '../../src/songs/catalog';
import type { Take } from '../../src/types';
import { synthSing, type SynthOptions } from '../../scripts/synthVoice';

const SR = 16000;

function take(songId: string, o: Partial<SynthOptions> = {}) {
  const song = getSong(songId);
  const pcm = synthSing(song.section.notes, { sampleRate: SR, bpm: song.section.bpm, ...o });
  return analyzeTake(pcm, SR, { notes: song.section.notes, firstNoteAt: null, strictTime: song.section.timeFeel === 'strict' });
}

describe('comparing takes of the same song', () => {
  it('does not invent progress between two equally good takes', () => {
    const song = getSong('amazing-grace');
    for (const seeds of [[1, 2], [3, 4], [5, 6]]) {
      const a = take('amazing-grace', { seed: seeds[0], key: -3 });
      const b = take('amazing-grace', { seed: seeds[1], key: -3 });
      const c = compareTakes(song, a, b);
      expect(c.verdict).toBe('same');
    }
  });

  it('hears a steadier long note as better', () => {
    const song = getSong('amazing-grace');
    const before = take('amazing-grace', { shaky: () => 35, seed: 2 });
    const after = take('amazing-grace', { seed: 3 });
    const c = compareTakes(song, after, before);
    expect(c.verdict).toBe('better');
    expect(c.changes.some((x) => x.key === 'long-note' && x.tone === 'better')).toBe(true);
  });

  it('notices when the high notes come back in tune', () => {
    const song = getSong('shenandoah');
    const before = take('shenandoah', { offCents: (_i, m) => (m >= 70 ? -50 : 0), seed: 4 });
    const after = take('shenandoah', { seed: 5 });
    const c = compareTakes(song, after, before);
    expect(c.changes.some((x) => x.key === 'high' && x.tone === 'better')).toBe(true);
  });
});

describe('what the coach says', () => {
  it('names flat high notes and suggests a practice tied to the song', () => {
    const song = getSong('shenandoah');
    const a = take('shenandoah', { offCents: (_i, m) => (m >= 70 ? -50 : 0) });
    const f = findingsForTake(song, a);
    const hf = f.find((x) => x.key === 'high-flat');
    expect(hf).toBeTruthy();
    expect(hf!.focus).toBeTruthy();
  });

  it('says honestly when it cannot follow the melody', () => {
    const pcm = synthSing(getSong('saints').section.notes, { sampleRate: SR, bpm: 112 });
    const a = analyzeTake(pcm, SR, { notes: getSong('greensleeves').section.notes, firstNoteAt: null, strictTime: false });
    const n = noteForTake({ song: getSong('greensleeves'), analysis: a });
    expect(n.problem).toMatch(/couldn’t follow/);
  });

  it('builds a first profile from five real takes', () => {
    const five = ['amazing-grace', 'danny-boy', 'saints', 'swing-low', 'simple-gifts'].map(getSong);
    const takes: Take[] = five.map((s, i) => ({
      id: `t${i}`,
      songId: s.id,
      kind: 'first',
      createdAt: i,
      durationSec: 10,
      settings: { guideShift: 0, countIn: false, firstNoteAt: null, guideWhileSinging: false },
      analysis: take(s.id, { key: -12, seed: i + 10, offCents: (_j, m) => (m >= 72 ? -40 : 0), tempoEnd: s.section.timeFeel === 'strict' ? 1.25 : 1 }),
    }));
    const p = buildProfile({ five, firstFive: five, takes, bestTakeIds: {}, candidates: SONGS.filter((s) => !five.includes(s)) });
    expect(p.sections).toHaveLength(7);
    for (const s of p.sections) expect(s.items.length).toBeGreaterThan(0);
    const text = JSON.stringify(p);
    expect(text).toMatch(/We’ve heard you sing from/);
    expect(text).toMatch(/sped up/);
  });
});
