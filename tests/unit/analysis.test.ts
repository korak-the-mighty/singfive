import { describe, expect, it } from 'vitest';
import { analyzeTake } from '../../src/analysis';
import { yin, hzToMidi } from '../../src/analysis/yin';
import { getSong } from '../../src/songs/catalog';
import { synthSing } from '../../scripts/synthVoice';

const SR = 16000;

function tone(hz: number, sec: number): Float32Array {
  const out = new Float32Array(Math.round(sec * SR));
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    out[i] = 0.3 * (Math.sin(2 * Math.PI * hz * t) + 0.5 * Math.sin(4 * Math.PI * hz * t) + 0.3 * Math.sin(6 * Math.PI * hz * t));
  }
  return out;
}

describe('YIN pitch', () => {
  it.each([82.4, 110, 196, 261.6, 440, 698.5])('finds %f Hz within 5 cents', (hz) => {
    const fr = yin(tone(hz, 0.6), SR, { hop: 160, window: 512 });
    const mid = Array.from(fr.f0).slice(10, -10);
    const errs = mid.map((f) => Math.abs(hzToMidi(f) - hzToMidi(hz)) * 100);
    errs.sort((a, b) => a - b);
    expect(errs[Math.floor(errs.length / 2)]).toBeLessThan(5);
  });
});

function run(songId: string, opts: Parameters<typeof synthSing>[1], firstNoteAt: number | null = null) {
  const song = getSong(songId);
  const pcm = synthSing(song.section.notes, { sampleRate: SR, ...opts });
  return analyzeTake(pcm, SR, { notes: song.section.notes, firstNoteAt, strictTime: song.section.timeFeel === 'strict' });
}

describe('listening to a whole take', () => {
  it('hears a well-sung take as well-sung, and finds the key', () => {
    const a = run('amazing-grace', { bpm: 72, key: -5, vibrato: { rateHz: 5.5, cents: 25 } });
    expect(a.quality.ok).toBe(true);
    expect(a.matched).toBe(true);
    const m = a.measures!;
    expect(Math.abs(m.keyShift - -5)).toBeLessThan(0.15);
    expect(m.meanOffCents!).toBeLessThan(15);
    expect(m.inTuneShare!).toBeGreaterThan(0.9);
    expect(m.missedShare).toBeLessThan(0.1);
    expect(Math.abs(m.tempoBpm! - 72)).toBeLessThan(6);
    expect(m.vibrato.present).toBe(true);
  });

  it('finds a key an octave and a bit lower (a lower voice)', () => {
    const a = run('scarborough-fair', { bpm: 96, key: -14.3 });
    expect(a.matched).toBe(true);
    expect(Math.abs(a.measures!.keyShift - -14.3)).toBeLessThan(0.15);
  });

  it('hears high notes going flat while the rest is in tune', () => {
    const song = getSong('shenandoah');
    const notes = song.section.notes.filter((n) => !n.rest).map((n) => n.midi);
    const hi = Math.max(...notes);
    const a = run('shenandoah', { bpm: 76, key: -7, offCents: (_i, midi) => (midi >= hi - 4 ? -45 : 0) });
    expect(a.matched).toBe(true);
    const r = a.measures!.registers;
    expect(r.high.bias!).toBeLessThan(-25);
    expect(Math.abs(r.mid.bias ?? 0)).toBeLessThan(20);
    expect(Math.abs(r.low.bias ?? 0)).toBeLessThan(20);
  });

  it('hears wobbly long notes as less steady than steady ones', () => {
    const steady = run('amazing-grace', { bpm: 72, wanderCents: 3 });
    const shaky = run('amazing-grace', { bpm: 72, wanderCents: 3, shaky: () => 35 });
    expect(shaky.measures!.longNotes.wanderCents!).toBeGreaterThan(steady.measures!.longNotes.wanderCents! + 8);
  });

  it('hears rushing', () => {
    const a = run('saints', { bpm: 112, tempoEnd: 1.3 });
    expect(a.matched).toBe(true);
    expect(a.measures!.tempoChangePct!).toBeGreaterThan(8);
    const b = run('saints', { bpm: 112 });
    expect(Math.abs(b.measures!.tempoChangePct!)).toBeLessThan(6);
  });

  it('hears a late entrance against the count-in', () => {
    const a = run('saints', { bpm: 112, lead: 2.0 }, 1.6);
    expect(a.measures!.entranceMs!).toBeGreaterThan(300);
    const b = run('saints', { bpm: 112, lead: 1.6 }, 1.6);
    expect(Math.abs(b.measures!.entranceMs!)).toBeLessThan(120);
  });

  it('notices missing notes', () => {
    const a = run('auld-lang-syne', { bpm: 80, omit: new Set([9, 10, 11, 12, 13]) });
    expect(a.measures!.missedShare).toBeGreaterThan(0.08);
  });

  it('does not pretend to understand silence', () => {
    const a = analyzeTake(new Float32Array(SR * 5), SR, { notes: getSong('saints').section.notes, firstNoteAt: null, strictTime: true });
    expect(a.quality.ok).toBe(false);
    expect(a.quality.issues).toContain('no-voice');
    expect(a.measures).toBeNull();
  });

  it('does not match a different melody to the song', () => {
    // Sing Saints' melody but analyse it as Greensleeves.
    const song = getSong('saints');
    const pcm = synthSing(song.section.notes, { sampleRate: SR, bpm: 112 });
    const a = analyzeTake(pcm, SR, { notes: getSong('greensleeves').section.notes, firstNoteAt: null, strictTime: false });
    expect(a.matched).toBe(false);
  });
});

describe('knowing which song you sang', () => {
  const ids = ['amazing-grace', 'danny-boy', 'saints', 'greensleeves', 'shenandoah', 'simple-gifts', 'swing-low', 'auld-lang-syne', 'motherless-child', 'scarborough-fair'];
  it('never matches a song to a different song’s melody', () => {
    for (const a of ids) {
      const sa = getSong(a);
      const pcm = synthSing(sa.section.notes, { sampleRate: SR, bpm: sa.section.bpm, key: -12, seed: 3 });
      for (const b of ids) {
        const r = analyzeTake(pcm, SR, { notes: getSong(b).section.notes, firstNoteAt: null, strictTime: false });
        expect({ sang: a, as: b, matched: r.matched }).toEqual({ sang: a, as: b, matched: a === b });
      }
    }
  });

  it('still follows a loose, human take: rubato, held notes, rough pitch', () => {
    for (const id of ids) {
      const s = getSong(id);
      let k = 0;
      const pcm = synthSing(s.section.notes, {
        sampleRate: SR,
        bpm: s.section.bpm * 0.92,
        key: -9.4,
        seed: 11,
        sloppyCents: 22,
        wanderCents: 9,
        durMul: () => [1, 1.25, 0.8, 1.6, 1, 0.85, 1.15][k++ % 7],
        tempoEnd: 1.08,
      });
      const r = analyzeTake(pcm, SR, { notes: s.section.notes, firstNoteAt: null, strictTime: false });
      expect({ id, matched: r.matched }).toEqual({ id, matched: true });
    }
  });
});
