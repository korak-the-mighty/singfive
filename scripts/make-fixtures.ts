// Generate synthetic "singer" recordings used as a fake microphone in the
// end-to-end test (Chromium's --use-file-for-fake-audio-capture).
//
// The singer is a lower voice (an octave below the written key) with known
// habits, so the test can check that FIVE hears them:
//   - high notes go flat in the wide songs
//   - long notes waver in Amazing Grace on the first take, steady on the second
//   - rushes in songs with a steady beat

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { analyzeTake } from '../src/analysis';
import { subSection } from '../src/audio/analyze';
import { findingsForTake } from '../src/coach/findings';
import { getSong } from '../src/songs/catalog';
import { countInSeconds } from '../src/songs/traits';
import { encodeWav, synthSing, type SynthOptions } from './synthVoice';

const SR = 48000;
const OUT = 'tests/fixtures';
mkdirSync(OUT, { recursive: true });

// Time from the microphone opening to the first note being due:
// starting note (1.25 s) + scheduling offset (0.15 s) + count-in.
const leadFor = (id: string) => 1.25 + 0.15 + countInSeconds(getSong(id).section) + 0.12;

function make(name: string, songId: string, o: Partial<SynthOptions>) {
  const song = getSong(songId);
  const pcm = synthSing(song.section.notes, {
    sampleRate: SR,
    bpm: song.section.bpm,
    key: -12,
    lead: leadFor(songId),
    tail: 1.5,
    vibrato: { rateHz: 5.4, cents: 14 },
    wanderCents: 5,
    levelDb: -14,
    noiseDb: -60,
    ...o,
  });
  writeFileSync(`${OUT}/${name}.wav`, encodeWav(pcm, SR));
  console.log(`${name}.wav  ${(pcm.length / SR).toFixed(1)} s`);
}

const flatTop = (limit: number) => (_i: number, m: number) => (m >= limit ? -45 : 0);

make('amazing-grace-1', 'amazing-grace', { seed: 1, shaky: (_i, m) => (m >= 67 ? 30 : 0), endSag: () => -35 });
make('amazing-grace-2', 'amazing-grace', { seed: 2 });
make('danny-boy-1', 'danny-boy', { seed: 3 });
make('saints-1', 'saints', { seed: 4, tempoEnd: 1.28 });
make('shenandoah-1', 'shenandoah', { seed: 5, offCents: flatTop(71), loudness: (_i, m) => (m >= 71 ? 7 : 0) });
make('simple-gifts-1', 'simple-gifts', { seed: 6, offCents: flatTop(77), tempoEnd: 1.15 });
make('swing-low-audition', 'swing-low', { seed: 7 });
// Not singing: a steady hum that ignores the melody.
make('wrong-melody', 'greensleeves', { seed: 8 });

// A practice attempt: work out which phrase the coach will pick from the
// Shenandoah take (same analysis the app runs), then sing just that, better.

function readWav(p: string) {
  const b = readFileSync(p);
  const sr = b.readUInt32LE(24);
  const n = (b.length - 44) / 2;
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = b.readInt16LE(44 + i * 2) / 32768;
  return { x, sr };
}
{
  const song = getSong('shenandoah');
  const { x, sr } = readWav(`${OUT}/shenandoah-1.wav`);
  const a = analyzeTake(x, sr, { notes: song.section.notes, firstNoteAt: null, strictTime: false });
  const focus = findingsForTake(song, a).find((f) => f.tone === 'difficulty' && f.focus)!.focus!;
  const sub = subSection(song.section, focus.noteRange);
  const pcm = synthSing(sub.notes, {
    sampleRate: SR,
    bpm: sub.bpm,
    key: -12,
    lead: 1.25 + 0.15 + countInSeconds(sub) + 0.12,
    tail: 1.5,
    wanderCents: 4,
    seed: 9,
  });
  writeFileSync(`${OUT}/shenandoah-practice.wav`, encodeWav(pcm, SR));
  console.log(`shenandoah-practice.wav  ${focus.type} notes ${focus.noteRange.join('–')}  ${(pcm.length / SR).toFixed(1)} s`);
}
