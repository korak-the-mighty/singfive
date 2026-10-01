// Core data model for FIVE.
//
// Everything here exists to answer one question about one of YOUR FIVE SONGS:
// can you sing this song better than before?

// ---------------------------------------------------------------------------
// Songs
// ---------------------------------------------------------------------------

export interface RefNote {
  /** MIDI pitch in the song's reference key. NaN for rests. */
  midi: number;
  /** Duration in quarter-note beats. */
  beats: number;
  /** Start position in beats from the first note of the section. */
  start: number;
  /** Syllable sung on this note. Undefined = the previous syllable continues. */
  lyric?: string;
  rest?: boolean;
  /** A natural place to breathe after this note (end of a phrase). */
  breath?: boolean;
}

export interface SongSection {
  /** Plain description of which part you sing, e.g. "The first two lines". */
  label: string;
  /** Lines of lyrics, as displayed. */
  lines: string[];
  notes: RefNote[];
  /** Quarter-note tempo. */
  bpm: number;
  /** Quarter-note beats per bar. */
  beatsPerBar: number;
  /** Quarter-note beats between count-in clicks (1, or 1.5 for a 6/8 feel). */
  clickEvery: number;
  /** Beats sung before the first full bar. */
  pickupBeats: number;
  /** Strict = a steady beat is part of the song. Flexible = rubato is normal. */
  timeFeel: 'strict' | 'flexible';
}

export type GestureId =
  | 'frame' // fingers framing the mouth — YOUR FIVE SONGS
  | 'open' // open palm — openness
  | 'sway' // hand swaying — feeling, phrasing, floating
  | 'mic' // invisible microphone grip — performance
  | 'cup' // cupped hand — projection
  | 'lips' // fingers near lips — intimacy, softness
  | 'pinch' // pinched fingers — precision
  | 'cover' // hand covering mouth — hesitation, hiding
  | 'push' // palm pushing outward — confidence
  | 'release' // fingers opening — release
  | 'reach' // hand reaching up and out — reaching
  | 'tight'; // closed, tense hand — tension

export interface Song {
  id: string;
  title: string;
  /** Where it comes from, and why it's free to use. */
  origin: string;
  /** One line in FIVE's voice about how the song feels. */
  feel: string;
  /** What the song asks of a voice, in plain words. */
  asks: string;
  gesture: GestureId;
  section: SongSection;
}

/** Facts about a melody, computed from its notes. Used to understand what a set of five songs tests. */
export interface SongTraits {
  spanSemitones: number;
  /** 0 = melody lives near the bottom of its span, 1 = near the top. */
  heightCentre: number;
  biggestLeap: number;
  leapCount: number;
  longestNoteSec: number;
  longNotes: number;
  notesPerSecond: number;
  durationSec: number;
  strictTime: boolean;
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

export type QualityIssue = 'quiet' | 'clipping' | 'noisy' | 'short' | 'no-voice';

export interface TakeQuality {
  ok: boolean;
  issues: QualityIssue[];
  peakDb: number;
  levelDb: number;
  noiseDb: number;
  voicedSec: number;
}

export interface NoteResult {
  /** Index into the section's notes (rests included). */
  ref: number;
  /** Expected pitch in the key you actually sang in (MIDI). */
  expected: number;
  /** What you sang (median of the note's middle), MIDI. Null if not sung. */
  sung: number | null;
  /** Sung minus expected, in cents (100 = a semitone). */
  offCents: number | null;
  /** Slow wander inside the note, in cents (standard deviation). Only for notes long enough to judge. */
  wanderCents: number | null;
  /** Fast wobble size (cents, standard deviation of the fast part). */
  wobbleCents: number | null;
  /** True if the note was sung an octave away from the rest of the take. */
  octaveJump: boolean;
  /** Seconds from the start of the recording. */
  onset: number | null;
  /** Timing error against your own steady beat, ms (positive = late). */
  timingMs: number | null;
  /** Seconds the note lasted. */
  duration: number;
  /** Seconds the melody expects at your tempo. */
  expectedDuration: number;
  /** Share of the note that had voice in it. */
  voiced: number;
  /** Average loudness, dB relative to full scale. */
  db: number | null;
  /** For long notes: how far the end drifts from the start, cents. */
  endDriftCents: number | null;
  /** Started noticeably below the note and slid up. */
  scoop: boolean;
  status: 'sung' | 'missed' | 'different';
}

export interface RegisterStats {
  n: number;
  meanOff: number | null; // mean |offCents|
  bias: number | null; // median signed offCents
  wander: number | null; // median wanderCents
  db: number | null; // mean loudness
  low: number; // lowest expected midi in band
  high: number;
}

export interface Measures {
  // Where you sang it
  keyShift: number; // semitones from the reference key (can be fractional)
  lowMidi: number | null;
  highMidi: number | null;
  // Tuning
  meanOffCents: number | null;
  inTuneShare: number | null; // share of notes within 35 cents
  biasCents: number | null; // + sharp, − flat
  keyDriftCents: number | null; // how far your key moved from start to end
  // Steadiness
  wanderCents: number | null;
  longNotes: {
    count: number;
    wanderCents: number | null;
    endDriftCents: number | null;
    heldShare: number | null; // held time / expected time
  };
  vibrato: { present: boolean; rateHz: number | null; sizeCents: number | null };
  // High / middle / low parts of the melody, as you sang it
  registers: { low: RegisterStats; mid: RegisterStats; high: RegisterStats };
  // Intervals
  steps: { n: number; meanErr: number | null };
  leapsUp: { n: number; meanErr: number | null; bias: number | null };
  leapsDown: { n: number; meanErr: number | null; bias: number | null };
  worstInterval: { from: number; to: number; errCents: number; words: string } | null;
  // Timing
  tempoBpm: number | null;
  tempoChangePct: number | null; // second half vs first half
  timingSpreadMs: number | null;
  entranceMs: number | null; // vs the count-in, if there was one
  // Dynamics
  loudnessRangeDb: number | null;
  highVsMidDb: number | null;
  // Breath and onsets
  midPhraseBreaks: number;
  longestPhraseSec: number | null;
  scoopShare: number | null;
  missedShare: number;
  differentNotes: number;
  octaveJumps: number;
  /** Rough breathiness: how noisy the voiced sound is (0 clean … 1 noisy). */
  breathiness: number | null;
}

export interface TakeAnalysis {
  version: number;
  durationSec: number;
  quality: TakeQuality;
  /** True if the singing could be matched to the song's melody. */
  matched: boolean;
  matchScore: number;
  /** Pitch contour for display: 20 ms frames, MIDI or null. */
  contour: { hop: number; midi: (number | null)[]; db: number[] };
  notes: NoteResult[];
  measures: Measures | null;
}

// ---------------------------------------------------------------------------
// Takes, songs-in-your-five, coach memory
// ---------------------------------------------------------------------------

export type TakeKind = 'first' | 'again' | 'practice' | 'audition' | 'sixth';

export type Feeling = 'easy' | 'pushing' | 'holding-back' | 'copying' | 'like-me' | 'unsure';

export interface TakeSettings {
  /** Semitones the guide was shifted from the reference key. */
  guideShift: number;
  countIn: boolean;
  /** Seconds from start of recording to where the first note was due. Null without count-in. */
  firstNoteAt: number | null;
  guideWhileSinging: boolean;
  /** Practice takes can sing part of the section. */
  noteRange?: [number, number];
}

export interface Take {
  id: string;
  songId: string;
  kind: TakeKind;
  createdAt: number;
  durationSec: number;
  settings: TakeSettings;
  analysis: TakeAnalysis | null;
  feeling?: Feeling[];
  practiceId?: string;
  /** Short coach note written right after the take. */
  note?: string;
  /** Counted in the coach's memory (kept, not a discarded retry). */
  committed?: boolean;
}

export interface FiveSlot {
  id: string;
  songId: string;
  position: number; // 0–4
  addedAt: number;
  removedAt?: number;
  /** Why this song entered the Five. */
  reasonIn: string;
  /** Why it left. */
  reasonOut?: string;
  /** The take the singer chose as their best. */
  bestTakeId?: string;
  /** Semitone shift that suits this singer, learned from takes. */
  guideShift?: number;
}

export type Evidence = 'heard' | 'think' | 'unsure';

export interface Observation {
  /** Stable key so the same finding accumulates instead of repeating. */
  key: string;
  songId: string | null; // null = about the voice across songs
  evidence: Evidence;
  text: string;
  /** Plain-language numbers behind it. */
  proof: string[];
  firstSeen: number;
  lastSeen: number;
  timesSeen: number;
  status: 'open' | 'better' | 'gone';
  /** Positive finding or a difficulty. */
  tone: 'strength' | 'difficulty' | 'neutral';
}

export type PracticeType = 'one-line' | 'hold-note' | 'interval' | 'softer' | 'listen';

export interface Practice {
  id: string;
  songId: string;
  type: PracticeType;
  title: string;
  /** Why this exists — always tied to the song. */
  because: string;
  howTo: string;
  /** Section note indices this practice uses. */
  noteRange: [number, number];
  /** The finding that created it; when that finding stops showing up, the practice retires. */
  findingKey?: string;
  createdAt: number;
  doneAt?: number;
  result?: string;
}

export interface FiveEvent {
  id: string;
  at: number;
  type: 'chose-five' | 'replaced' | 'audition' | 'coach-suggested' | 'first-profile' | 'sixth';
  text: string;
  songIds: string[];
}

export interface ProfileSection {
  id: string;
  title: string;
  items: { text: string; evidence: Evidence; proof?: string[] }[];
}

export interface SingerProfile {
  createdAt: number;
  updatedAt: number;
  sections: ProfileSection[];
  /** One sentence for the top of the home screen. */
  headline: string;
  source: 'rules' | 'ai';
}

export interface Settings {
  aiCoach: boolean;
  /** Learned from the first take: which octave the guide should play in. */
  guideOctave: -1 | 0;
  guideWhileSinging: boolean;
}

export interface Sixth {
  songId: string;
  proposedAt: number;
  hypothesis: string;
  predictions: { key: string; text: string; expect: 'strong' | 'hard' }[];
  takeId?: string;
  verdict?: { key: string; right: boolean; text: string }[];
}
