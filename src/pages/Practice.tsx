import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { guideContext, playMelody } from '../audio/guide';
import { judgePractice, lineText } from '../coach/practice';
import { songState } from '../coach/songState';
import { MelodyLine } from '../components/MelodyLine';
import { SingPanel } from '../components/SingPanel';
import { Back, PlayButton, Tag } from '../components/ui';
import { activeSlots, useStore } from '../data/store';
import { findSong } from '../songs/catalog';
import type { Take } from '../types';

export function PracticePage({ songId, practiceId }: { songId: string; practiceId: string }) {
  const song = findSong(songId);
  const slots = useStore((s) => s.slots);
  const takes = useStore((s) => s.takes);
  const observations = useStore((s) => s.observations);
  const practices = useStore((s) => s.practices);
  const completePractice = useStore((s) => s.completePractice);
  const [attempt, setAttempt] = useState<Take | null>(null);
  const p = practices.find((x) => x.id === practiceId);
  const slot = activeSlots(slots).find((s) => s.songId === songId);
  const st = useMemo(() => (song ? songState(song, takes, observations, practices, slot?.bestTakeId) : null), [song, takes, observations, practices, slot?.bestTakeId]);

  if (!song || !p || !st) {
    return (
      <div className="wrap narrow">
        <h2>That practice isn’t here any more.</h2>
        <Link href={`/song/${songId}`}>Back to the song</Link>
      </div>
    );
  }
  const reference = st.best?.analysis ?? null;
  const shift = slot?.guideShift ?? 0;
  const result = attempt?.analysis ? judgePractice(song, p, attempt.analysis, reference) : null;
  const playLine = (tempo: number) => {
    const ctx = guideContext();
    ctx.resume();
    playMelody(ctx, song.section, { shift, range: p.noteRange, tempo });
  };

  return (
    <div className="wrap">
      <Back to={`/song/${song.id}`}>{song.title}</Back>
      <div className="mt8">
        <div className="kicker">Practice · because of {song.title}</div>
        <h2 className="mt8">{p.title}</h2>
        <p className="lead mt16">{p.because}</p>
        <p className="muted">{p.howTo}</p>
        {p.result && <p className="small">Last time: {p.result}</p>}
      </div>

      <section className="mt24">
        <div className="small">Where it sits in the song:</div>
        <MelodyLine section={song.section} shift={shift} highlight={p.noteRange} height={100} />
        <div className="row mt8">
          <button className="btn small" onClick={() => playLine(1)}>
            Hear this part
          </button>
          <button className="btn small" onClick={() => playLine(0.7)}>
            Hear it slower
          </button>
          {st.best && (
            <span className="row" style={{ gap: 8 }}>
              <PlayButton takeId={st.best.id} label="Hear your best take of the song" />
              <span className="small">Your take of the whole song</span>
            </span>
          )}
        </div>
      </section>

      <section>
        {!attempt ? (
          <SingPanel song={song} kind="practice" shift={shift} range={p.noteRange} practiceId={p.id} onTake={setAttempt} />
        ) : (
          <div className="fade-in stack">
            <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
              <PlayButton takeId={attempt.id} label="Hear this attempt" />
              <div className="verdict">{result?.text}</div>
            </div>
            {result?.better === true && <Tag kind="better" />}
            {attempt.analysis?.matched && <MelodyLine section={song.section} shift={Math.round(attempt.analysis.measures!.keyShift)} take={attempt.analysis} highlight={p.noteRange} height={110} />}
            <div className="row">
              <button className="btn" onClick={() => setAttempt(null)}>
                Try it again
              </button>
              <Link
                href={`/song/${song.id}/sing`}
                className="btn red"
                onClick={() => result && completePractice(p.id, result.text)}
              >
                Now sing the whole song
              </Link>
              <Link href={`/song/${song.id}`} className="btn quiet" onClick={() => result && completePractice(p.id, result.text)}>
                Done
              </Link>
            </div>
            <p className="tiny">The words: “{lineText(song, p.noteRange)}”</p>
          </div>
        )}
      </section>
    </div>
  );
}
