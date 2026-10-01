# FIVE

**Become a singer in five songs.**

You choose five songs you believe you can sing. You sing a short part of each. FIVE listens, for real, and starts to understand your voice. From then on you always have **YOUR FIVE SONGS**: sing any of them again and FIVE tells you what changed. Swap a song whenever another one becomes more useful or more yours. When your five prove what you can do, the coach proposes **the Sixth**.

The product rules live in [`CORE.md`](CORE.md). Everything in this app exists to help you understand, improve, choose or own your five songs.

---

## Run it

Requirements: Node 20 or newer, a microphone, and a recent Chrome, Edge, Firefox or Safari.

```bash
npm install
npm run dev
```

Open http://localhost:5173. Browsers only allow the microphone on `localhost` or HTTPS.

Headphones help if you turn on “Play the tune while I sing”. Without them the tune leaks into the microphone.

### Optional: the AI coach

FIVE's own coach writes every note from your measurements and needs nothing else. If you add an Anthropic API key, those notes are rewritten in a warmer, more connected voice by Claude. Claude only rewrites them; it adds no claims of its own.

```bash
cp .env.example .env
# then set ANTHROPIC_API_KEY in .env
npm run dev
```

| Variable | Default | What it does |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | not set | Turns on the AI coach. Read only by the server (Vite's dev and preview server), never sent to the browser. |
| `FIVE_COACH_MODEL` | `claude-opus-5-5` | The Claude model used for rewriting. |

The singer can switch the AI coach off on the Privacy page. If the key is missing, wrong, or the API fails, FIVE silently keeps its own coach's words.

### Production build

```bash
npm run build
npm run preview   # serves dist/ and the /api/coach endpoint on http://localhost:4173
```

`dist/` is a static site. Hosted anywhere static, everything works except the AI coach, which needs the small endpoint in `server/coachApi.ts` (served by `vite preview`, or mount its handler in any Node server).

---

## What happens when you sing

1. **Your starting note** plays (before recording, so it can't be mistaken for your voice), then a soft count-in.
2. **Recording**: raw samples from the microphone, with the browser's call-oriented processing (echo cancellation, noise suppression, auto gain) switched off because it distorts singing. Captured in an AudioWorklet and saved as a WAV in your browser.
3. **Listening** runs in a background thread in your browser (`src/analysis/`):
   - Pitch every 10 ms with the YIN algorithm (sub-sample interpolation, octave-error correction, breathy frames accepted only when they agree with their neighbours).
   - **Which key did you sing in?** You can sing in any key or octave. FIVE searches for the transposition that fits and aligns your pitch line to the melody note by note (a left-to-right Viterbi alignment; rests and skipped notes allowed).
   - **Did you sing this song at all?** A take only counts if the pitch fits, most notes were sung, and note lengths stay roughly in proportion. A different melody can be forced onto the notes only by squashing and stretching them, and that is detected. Otherwise FIVE says it couldn't follow, and says nothing else.
   - **Measurements**: tuning per note relative to your own key; slow wander and fast wobble inside notes; vibrato rate and size; whether long notes sink at the end; high, middle and low parts of the melody separately; jumps up and down; tempo, rushing and dragging; timing against your own beat; your entrance after the count-in; breaks for air mid-line; loudness of high notes against the middle; slides into notes; notes missed, sung differently, or sung an octave away.
   - **Recording checks**: too quiet, too loud (clipping), noisy room, too short.
4. **The coach** (`src/coach/`) turns measurements into plain sentences, each tagged:
   - **We heard**: measured.
   - **We think**: an interpretation of what was measured.
   - **Not sure yet**: what audio can't tell us, or what one take can't prove.

   “What we measured” opens the numbers behind any sentence.

### Progress is song-specific

- Every take of a song is kept with its analysis.
- When you sing a song again, it is compared with your best take of that same song. A change is reported only when it's bigger than the normal difference between two takes. Two equally good takes come out as “about the same” (there's a test for this).
- A take that is measurably better becomes your best. You can undo that.
- The coach's memory accumulates: a finding heard again is strengthened; a difficulty that stops showing up is marked as getting better, then gone. Practice is cut from the song itself, and retires when its reason disappears.

### What FIVE does not pretend to know

Audio alone can't say whether you sound like yourself or like the record, whether a strain is physical, or what your “voice type” is. FIVE says “not sure yet” and asks you instead (“How did it feel?”). Then it compares what you felt with what it heard.

---

## Privacy

- **Recordings** stay in this browser's IndexedDB, on this device. They are never uploaded.
- **Analysis** runs in your browser.
- **The AI coach**, if configured and switched on, receives the coach's draft sentences and the numbers behind them. It never receives audio. The server forwards them to Anthropic's API and returns rewritten sentences.
- Fonts are bundled, so loading the app contacts no third party.
- The Privacy page in the app can download everything as JSON or delete everything.

---

## The songs

Ten public-domain songs, each chosen because it asks something different of a voice: long exposed notes, a wide range, big leaps, a strict beat, quick words, softness. Melodies were hand-transcribed for FIVE and checked against published sources (Wikipedia's engraved scores and several ABC transcriptions). Folk songs have variants: if you sing a different version, the coach says “you sang a different note from this version” rather than marking you out of tune.

Each song's traits (range, leaps, long notes, beat) are calculated from its notes (`src/songs/traits.ts`), so the coach can say what your five test, and what they leave out.

---

## Architecture

```
src/
  analysis/   pitch (YIN), contour cleanup, melody alignment, measurements, quality checks — pure TypeScript, unit-tested
  audio/      microphone capture (AudioWorklet), WAV encoding, guide tones and count-in, analysis worker
  coach/      findings, take notes, comparisons, memory, profile, practice, slot suggestions, the Sixth, gestures, optional AI client
  songs/      melody notation parser, the ten songs, computed traits
  data/       IndexedDB storage and the app store (Zustand)
  components/ sing panel, take review, melody drawing, the mouth-and-hand emblem
  pages/      choose, first sing, first read, home, song, sing again, practice, listen blind, change, audition, your voice, the Sixth, privacy
server/
  coachApi.ts optional AI coach endpoint, mounted into Vite's dev and preview servers
```

### Data model

| Entity | Where | What it holds |
| --- | --- | --- |
| Settings | `kv` | AI coach on/off, guide preferences |
| First five | `kv` | The five songs you first believed you could sing (kept for the arc from belief to proof) |
| Five slot | `slots` | A song's place in your five: when it came in, why, its best take, its key. Removed slots stay as history. |
| Take | `takes` | One recording of one song: kind (first, again, practice, audition, sixth), settings, full analysis, how it felt |
| Audio | `audio` | The WAV for each take |
| Observation | `observations` | What the coach understands about a song, with how often it was heard and whether it's getting better |
| Practice | `practices` | A short exercise cut from a song, and the finding that created it |
| Event | `events` | The story of your five: chosen, swapped, auditioned, graduated |
| Singer profile | `kv` | The synthesis across songs, rebuilt from all evidence |
| The Sixth | `kv` | The coach's hypothesis, predictions, and how they turned out |

### The visual system

The mouth is the constant (voice); the hand is the expression. The hand is a small 3D rig of a left hand (`src/components/hand/rig.ts`) projected to line art, with twelve gestures. Each of your five songs shows a gesture: before you sing it, how the song feels; after, how you sing it (reaching, holding back, precise, open…), with the reason in words. The mouth opens with your voice while you sing.

---

## Tests

```bash
npm test              # unit tests: pitch accuracy, alignment, measurements, coach, AI rewrite guard
npm run fixtures      # generate synthetic singers (WAV) for the end-to-end test
npm run e2e           # full flow in Chromium with a WAV file as the microphone (about 5 minutes)
```

The unit tests use a small synthetic singer (`scripts/synthVoice.ts`) with known faults built in: flat high notes, wobbly long notes, rushing, a late entrance, missing notes, a different key or octave, breathiness, a different melody entirely. They check that FIVE hears exactly what was put in, and does not invent change between equally good takes.

The end-to-end test (`tests/e2e/flow.spec.ts`) uses Chromium's fake microphone. It chooses five songs, records all five, checks the first profile, sings one again and checks it is heard as better, compares takes, listens blind, practises, auditions a song into the Saints' place, and confirms that a wrong melody is refused on a phone-sized screen.

`scripts/walk-sixth.mjs` continues a walkthrough profile all the way to graduation: readiness, the coach's hypothesis, singing the Sixth, and the verdict on each prediction.

## Known limits

- The prototype has one singer per browser, and data doesn't sync between devices.
- Ten songs, one section each. Bringing your own song needs automatic melody extraction (see `ROADMAP.md`).
- Thresholds were calibrated on synthetic voices and the measurement literature, not yet on a large set of real amateur singers. They are deliberately conservative: when in doubt, FIVE says less.
- Very breathy or very quiet singing can be partly unreadable. FIVE says so instead of guessing.
