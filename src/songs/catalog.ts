import type { Song, SongSection } from '../types';
import { parseMelody } from './notation';

// Ten songs, all in the public domain, each chosen because it asks something
// different of a voice. Melodies are hand-transcribed and checked against
// several published sources. One short section of each is what you sing.

function section(s: Omit<SongSection, 'notes'> & { melody: string }): SongSection {
  const { melody, ...rest } = s;
  return { ...rest, notes: parseMelody(melody) };
}

export const SONGS: Song[] = [
  {
    id: 'amazing-grace',
    title: 'Amazing Grace',
    origin: 'Hymn. Words John Newton, 1779. Tune “New Britain”, 1829.',
    feel: 'Slow and exposed. Long notes with nowhere to hide.',
    asks: 'Patience, long steady notes, and a climb to the top note on “me”.',
    gesture: 'open',
    section: section({
      label: 'The first two lines',
      lines: ['Amazing grace, how sweet the sound,', 'that saved a wretch like me.'],
      bpm: 72,
      beatsPerBar: 3,
      clickEvery: 1,
      pickupBeats: 1,
      timeFeel: 'flexible',
      melody:
        'D4:1:A- G4:2:ma- B4:.5:zing G4:.5 B4:2:grace A4:1:how G4:2:sweet E4:1:the D4:2:sound / ' +
        'D4:1:that G4:2:saved B4:.5:a G4:.5 B4:2:wretch A4:1:like D5:3:me',
    }),
  },
  {
    id: 'danny-boy',
    title: 'Danny Boy',
    origin: 'Irish air “Londonderry Air”. Words Frederic Weatherly, 1913.',
    feel: 'Tender. Rises on “the pipes”, falls away on “calling”.',
    asks: 'Softness that still carries, and a gentle line that rises and falls.',
    gesture: 'lips',
    section: section({
      label: 'The opening',
      lines: ['Oh Danny boy, the pipes, the pipes are calling', 'from glen to glen, and down the mountain side.'],
      bpm: 60,
      beatsPerBar: 4,
      clickEvery: 1,
      pickupBeats: 1.5,
      timeFeel: 'flexible',
      melody:
        'B3:.5:Oh C4:.5:Dan- D4:.5:ny E4:1.5:boy D4:.5:the E4:.5:pipes A4:.5:the G4:.5:pipes E4:.5:are ' +
        'D4:.5:call- C4:.5 A3:1:ing / r:.5 C4:.5:from E4:.5:glen F4:.5:to ' +
        'G4:1.5:glen A4:.5:and G4:.5:down E4:.5:the C4:.5:moun- E4:.5:tain D4:2:side',
    }),
  },
  {
    id: 'scarborough-fair',
    title: 'Scarborough Fair',
    origin: 'Traditional English ballad.',
    feel: 'Floating and old. The notes lean in unexpected directions.',
    asks: 'A smooth, unhurried line and unusual steps you have to hear clearly.',
    gesture: 'sway',
    section: section({
      label: 'The first two lines',
      lines: ['Are you going to Scarborough Fair?', 'Parsley, sage, rosemary and thyme.'],
      bpm: 96,
      beatsPerBar: 3,
      clickEvery: 1,
      pickupBeats: 0,
      timeFeel: 'flexible',
      melody:
        'D4:2:Are D4:1:you A4:2:go- A4:.5:ing A4:.5:to E4:1.5:Scar- F4:.5:bo- E4:1:rough D4:4:Fair / ' +
        'A4:1:Pars- C5:1:ley D5:2:sage C5:1:rose- A4:1:ma- B4:1:ry G4:1:and A4:3:thyme',
    }),
  },
  {
    id: 'saints',
    title: 'When the Saints Go Marching In',
    origin: 'American spiritual, traditional.',
    feel: 'Short phrases, strong entrances, a beat you can’t fake.',
    asks: 'Coming in on time after each gap, and keeping the beat steady.',
    gesture: 'mic',
    section: section({
      label: 'The first two lines',
      lines: ['Oh when the saints go marching in,', 'oh when the saints go marching in.'],
      bpm: 112,
      beatsPerBar: 4,
      clickEvery: 1,
      pickupBeats: 3,
      timeFeel: 'strict',
      melody:
        'C4:1:Oh E4:1:when F4:1:the G4:4:saints / r:1 C4:1:go E4:1:march- F4:1:ing G4:4:in / ' +
        'r:1 C4:1:oh E4:1:when F4:1:the G4:2:saints E4:2:go C4:2:march- E4:2:ing D4:4:in',
    }),
  },
  {
    id: 'swing-low',
    title: 'Swing Low, Sweet Chariot',
    origin: 'African-American spiritual, before 1862.',
    feel: 'Low, warm and unhurried.',
    asks: 'A relaxed lower voice, and dipping below the tune’s home note without losing warmth.',
    gesture: 'cup',
    section: section({
      label: 'The chorus',
      lines: ['Swing low, sweet chariot, comin’ for to carry me home,', 'swing low, sweet chariot, comin’ for to carry me home.'],
      bpm: 80,
      beatsPerBar: 4,
      clickEvery: 1,
      pickupBeats: 0,
      timeFeel: 'flexible',
      melody:
        'G#4:1:Swing E4:2:low G#4:1:sweet E4:2:char- E4:.5:i- C#4:.75:ot B3:.75 / ' +
        'E4:.5:com- E4:.5:in’ E4:.5:for E4:.5:to G#4:.5:car- G#4:.5:ry B4:1:me B4:4:home / ' +
        'C#5:.5:swing B4:.5 G#4:2:low B4:1:sweet E4:2:char- E4:.5:i- C#4:.75:ot B3:.75 / ' +
        'E4:.5:com- E4:.5:in’ E4:.5:for E4:.5:to G#4:.5:car- G#4:.5:ry F#4:1:me E4:3:home',
    }),
  },
  {
    id: 'greensleeves',
    title: 'Greensleeves',
    origin: 'English ballad, 16th century.',
    feel: 'A lilting minor line that rises, turns and falls.',
    asks: 'Turning corners cleanly in a minor key, and a long phrase on one breath.',
    gesture: 'release',
    section: section({
      label: 'The first verse',
      lines: ['Alas, my love, you do me wrong to cast me off discourteously,', 'for I have loved you well and long, delighting in your company.'],
      bpm: 90,
      beatsPerBar: 3,
      clickEvery: 1.5,
      pickupBeats: 0.5,
      timeFeel: 'flexible',
      melody:
        'G4:.5:A- Bb4:1:las C5:.5:my D5:.75:love Eb5:.25 D5:.5:you C5:1:do A4:.5:me F4:.75:wrong G4:.25 / A4:.5:to ' +
        'Bb4:1:cast G4:.5:me G4:.75:off F#4:.25 G4:.5:dis- A4:1:cour- F#4:.5:teous- D4:1:ly / ' +
        'G4:.5:for Bb4:1:I C5:.5:have D5:.75:loved Eb5:.25 D5:.5:you C5:1:well A4:.5:and F4:.75:long G4:.25 A4:.5:de- ' +
        'Bb4:.75:light- A4:.25:ing G4:.5:in F#4:.75:your E4:.25:com- F#4:.5:pa- G4:1.5:ny',
    }),
  },
  {
    id: 'motherless-child',
    title: 'Sometimes I Feel Like a Motherless Child',
    origin: 'African-American spiritual, traditional.',
    feel: 'Quiet, close, aching. Sung almost to yourself.',
    asks: 'Staying in tune when you sing softly, and holding the low note at the end of each line.',
    gesture: 'cover',
    section: section({
      label: 'The first two lines',
      lines: ['Sometimes I feel like a motherless child,', 'sometimes I feel like a motherless child.'],
      bpm: 58,
      beatsPerBar: 4,
      clickEvery: 1,
      pickupBeats: 0,
      timeFeel: 'flexible',
      melody:
        'F4:.5:Some- A4:1:times F4:.5:I A4:1:feel F4:.5:like G4:.5:a A4:.6667:moth- G4:.6667:er- F4:.6666:less D4:2:child / ' +
        'F4:.5:some- G4:1:times F4:.5:I G4:1:feel F4:.5:like G4:.5:a A4:.6667:moth- G4:.6667:er- F4:.6666:less D4:2:child',
    }),
  },
  {
    id: 'shenandoah',
    title: 'Shenandoah',
    origin: 'American folk song and sea shanty, 19th century.',
    feel: 'Big leaps and a long, slow arc across a river.',
    asks: 'Range. It starts low, leaps up, and reaches its top note on “away”.',
    gesture: 'reach',
    section: section({
      label: 'The first verse',
      lines: ['Oh Shenandoah, I long to see you, away, you rolling river.', 'Oh Shenandoah, I long to see you, away, I’m bound away, ’cross the wide Missouri.'],
      bpm: 76,
      beatsPerBar: 4,
      clickEvery: 1,
      pickupBeats: 1,
      timeFeel: 'flexible',
      melody:
        'A3:1:Oh D4:.5:Shen- D4:.5:an- D4:1.5:doah E4:.5:I F#4:.5:long G4:.5:to B4:.5:see A4:1.5:you / D5:.5:a- C#5:.5 ' +
        'B4:1.5:way A4:.5:you B4:.5:roll- A4:.5:ing F#4:.5:ri- A4:2.5:ver / ' +
        'A4:1:Oh B4:.5:Shen- B4:.5:an- B4:1.5:doah F#4:.5:I A4:.5:long F#4:.5:to E4:.5:see D4:1.5:you / E4:1:a- ' +
        'F#4:1.5:way E4:.5:I’m F#4:.75:bound B4:.25:a- A4:3:way / D4:.75:’cross E4:.25:the F#4:1.5:wide E4:.5:Mis- E4:1:sou- D4:2:ri',
    }),
  },
  {
    id: 'auld-lang-syne',
    title: 'Auld Lang Syne',
    origin: 'Scottish song. Words Robert Burns, 1788.',
    feel: 'Familiar and sociable, with a leap you have to aim for.',
    asks: 'Landing the jump up to “mind” and keeping the beat swinging gently.',
    gesture: 'push',
    section: section({
      label: 'The first verse',
      lines: ['Should auld acquaintance be forgot, and never brought to mind?', 'Should auld acquaintance be forgot, and auld lang syne?'],
      bpm: 80,
      beatsPerBar: 4,
      clickEvery: 1,
      pickupBeats: 1,
      timeFeel: 'strict',
      melody:
        'C4:1:Should F4:1.5:auld F4:.5:ac- F4:1:quain- A4:1:tance G4:1.5:be F4:.5:for- G4:1:got / A4:1:and ' +
        'F4:1.5:ne- F4:.5:ver A4:1:brought C5:1:to D5:3:mind / D5:1:should C5:1.5:auld A4:.5:ac- A4:1:quain- F4:1:tance ' +
        'G4:1.5:be F4:.5:for- G4:1:got / A4:1:and F4:1.5:auld D4:.5 D4:1:lang C4:1 F4:3:syne',
    }),
  },
  {
    id: 'simple-gifts',
    title: 'Simple Gifts',
    origin: 'Shaker song, Joseph Brackett, 1848.',
    feel: 'Bright and clear. Every note in plain view.',
    asks: 'Clean, exact notes and light, crisp words at a walking pace.',
    gesture: 'pinch',
    section: section({
      label: 'The first verse',
      lines: [
        '’Tis the gift to be simple, ’tis the gift to be free,',
        '’tis the gift to come down where we ought to be,',
        'and when we find ourselves in the place just right,',
        '’twill be in the valley of love and delight.',
      ],
      bpm: 96,
      beatsPerBar: 4,
      clickEvery: 1,
      pickupBeats: 2,
      timeFeel: 'strict',
      melody:
        'G4:1:’Tis G4:1:the C5:1:gift C5:.5:to D5:.5:be E5:.5:sim- C5:.5:ple E5:.5:’tis F5:.5:the ' +
        'G5:1:gift G5:.5:to G5:.5:be E5:1:free / D5:.5:’tis C5:.5:the D5:1:gift D5:1:to D5:1:come D5:1:down ' +
        'D5:.5:where E5:.5:we D5:.5:ought B4:.5:to G4:1:be / G4:1:and ' +
        'C5:.5:when B4:.5:we C5:.5:find D5:.5:our- E5:1:selves D5:.5:in D5:.5:the E5:1:place F5:1:just G5:1.5:right / G5:.5:’twill ' +
        'D5:1:be D5:.5:in E5:.5:the D5:1:val- C5:.5:ley C5:.5:of D5:1:love C5:.5:and B4:.5:de- C5:2:light',
    }),
  },
];

const BY_ID = new Map(SONGS.map((s) => [s.id, s]));

export function getSong(id: string): Song {
  const s = BY_ID.get(id);
  if (!s) throw new Error(`Unknown song ${id}`);
  return s;
}

export function findSong(id: string): Song | undefined {
  return BY_ID.get(id);
}
