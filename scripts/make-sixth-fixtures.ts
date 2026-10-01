// More takes for the long road to the Sixth: later takes improve.
import { mkdirSync, writeFileSync } from 'node:fs';
import { getSong } from '../src/songs/catalog';
import { countInSeconds } from '../src/songs/traits';
import { encodeWav, synthSing, type SynthOptions } from './synthVoice';

const SR = 48000;
const OUT = 'tests/fixtures';
mkdirSync(OUT, { recursive: true });
const leadFor = (id: string) => 1.25 + 0.15 + countInSeconds(getSong(id).section) + 0.12;
function make(name: string, songId: string, o: Partial<SynthOptions>) {
  const song = getSong(songId);
  const pcm = synthSing(song.section.notes, { sampleRate: SR, bpm: song.section.bpm, key: -12, lead: leadFor(songId), tail: 1.5, vibrato: { rateHz: 5.4, cents: 14 }, wanderCents: 5, levelDb: -14, noiseDb: -60, ...o });
  writeFileSync(`${OUT}/${name}.wav`, encodeWav(pcm, SR));
  console.log(name);
}
const flat = (limit: number, c: number) => (_i: number, m: number) => (m >= limit ? c : 0);
make('amazing-grace-3', 'amazing-grace', { seed: 21 });
make('danny-boy-2', 'danny-boy', { seed: 22 });
make('danny-boy-3', 'danny-boy', { seed: 23 });
make('swing-low-2', 'swing-low', { seed: 24 });
make('swing-low-3', 'swing-low', { seed: 25 });
make('shenandoah-2', 'shenandoah', { seed: 26, offCents: flat(71, -15) });
make('shenandoah-3', 'shenandoah', { seed: 27 });
make('simple-gifts-2', 'simple-gifts', { seed: 28 });
make('simple-gifts-3', 'simple-gifts', { seed: 29 });
for (const id of ['scarborough-fair', 'greensleeves', 'motherless-child', 'auld-lang-syne', 'saints']) make(`${id}-sixth`, id, { seed: 30 });
