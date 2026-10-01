import { analyzeTake } from '../src/analysis';
import { buildProfile } from '../src/coach/profile';
import { noteForTake } from '../src/coach/takeNote';
import { getSong, SONGS } from '../src/songs/catalog';
import type { Take } from '../src/types';
import { synthSing } from './synthVoice';
const SR = 16000;
const five = ['amazing-grace', 'danny-boy', 'saints', 'swing-low', 'motherless-child'].map(getSong);
const takes: Take[] = five.map((s, i) => {
  const pcm = synthSing(s.section.notes, { sampleRate: SR, bpm: s.section.bpm, key: -14, seed: i + 10, offCents: (_j, m) => (m >= 71 ? -40 : 0), tempoEnd: s.section.timeFeel === 'strict' ? 1.25 : 1, shaky: (_j, m) => (m <= 62 ? 25 : 0) });
  const a = analyzeTake(pcm, SR, { notes: s.section.notes, firstNoteAt: null, strictTime: s.section.timeFeel === 'strict' });
  const n = noteForTake({ song: s, analysis: a, feeling: i === 0 ? ['easy'] : [] });
  console.log(`\n# ${s.title}\n${n.headline}`);
  for (const l of n.lines) console.log(` - [${l.evidence}] ${l.text}`);
  return { id: `t${i}`, songId: s.id, kind: 'first', createdAt: i, durationSec: 10, settings: { guideShift: 0, countIn: false, firstNoteAt: null, guideWhileSinging: false }, analysis: a, feeling: i === 0 ? ['easy'] : [] } as Take;
});
const p = buildProfile({ five, firstFive: five, takes, bestTakeIds: {}, candidates: SONGS.filter((s) => !five.includes(s)) });
console.log('\nHEADLINE:', p.headline);
for (const s of p.sections) {
  console.log(`\n## ${s.title}`);
  for (const i of s.items) console.log(` - [${i.evidence}] ${i.text}`);
}
