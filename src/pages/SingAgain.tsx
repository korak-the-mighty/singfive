import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { compareTakes } from '../coach/compare';
import { songState } from '../coach/songState';
import { SingPanel } from '../components/SingPanel';
import { TakeReview } from '../components/TakeReview';
import { Back } from '../components/ui';
import { activeSlots, useStore } from '../data/store';
import { findSong } from '../songs/catalog';
import type { Take, TakeAnalysis } from '../types';

export function SingAgain({ songId }: { songId: string }) {
  const song = findSong(songId);
  const slots = useStore((s) => s.slots);
  const takes = useStore((s) => s.takes);
  const observations = useStore((s) => s.observations);
  const practices = useStore((s) => s.practices);
  const { commitTake, setGuideShift, setBest, refreshProfile } = useStore.getState();
  const [current, setCurrent] = useState<Take | null>(null);
  const [kept, setKept] = useState(false);
  const [prevBest, setPrevBest] = useState<string | null>(null);
  // What this take is compared with, fixed at the moment you sang it.
  const [against, setAgainst] = useState<{ a: TakeAnalysis | null; label?: string } | null>(null);
  const [, go] = useLocation();
  const slot = activeSlots(slots).find((s) => s.songId === songId);

  if (!song || !slot) {
    return (
      <div className="wrap narrow">
        <h2>This song isn’t in your five right now.</h2>
        <Link href="/">Back to your five songs</Link>
      </div>
    );
  }

  const st = songState(song, takes.filter((t) => t.id !== current?.id), observations, practices, slot.bestTakeId);
  // Compare with your best take; if you haven't chosen one, with your last.
  const before = st.best?.analysis?.matched ? st.best : st.last?.analysis?.matched ? st.last : null;
  const beforeLabel = before ? (before.id === slot.bestTakeId ? 'your best take' : 'your last take') : undefined;
  const shift = slot.guideShift ?? 0;

  const onTake = async (t: Take) => {
    const prevBest = slot.bestTakeId ?? null;
    setAgainst({ a: before?.analysis ?? null, label: beforeLabel });
    setCurrent(t);
    setKept(false);
    setPrevBest(null);
    // Every take of the song is kept in its history.
    await commitTake(t.id);
    // A take that's measurably better than your best becomes your best. You can undo it.
    if (t.analysis?.matched && before?.analysis && compareTakes(song, t.analysis, before.analysis).verdict === 'better') {
      await setBest(song.id, t.id);
      setPrevBest(prevBest);
    }
    setKept(true);
    refreshProfile();
  };

  return (
    <div className="wrap">
      <Back to={`/song/${song.id}`}>{song.title}</Back>
      <div className="mt8">
        <div className="kicker">Sing it again</div>
        <h2 className="mt8">{song.title}</h2>
        {!current && (
          <p className="lead mt16">
            {before ? 'Sing it, and we’ll tell you what changed since ' + beforeLabel + '.' : 'Sing it, and we’ll listen.'}
          </p>
        )}
      </div>
      <section className="mt24">
        {!current ? (
          <SingPanel song={song} kind="again" shift={shift} onShift={(n) => setGuideShift(song.id, n)} onTake={onTake} />
        ) : (
          <TakeReview song={song} take={current} before={against?.a ?? null} beforeLabel={against?.label}>
            {kept && slot.bestTakeId === current.id && (
              <span className="row" style={{ gap: 6 }}>
                <span className="tag heard">This is your best take now</span>
                {prevBest && (
                  <button className="btn quiet small" onClick={() => setBest(song.id, prevBest).then(() => setPrevBest(null))}>
                    Keep the old one as best
                  </button>
                )}
              </span>
            )}
            {kept && slot.bestTakeId !== current.id && current.analysis?.matched && (
              <button className="btn quiet small" onClick={() => setBest(song.id, current.id)}>
                Make this my best take
              </button>
            )}
            <button className="btn" onClick={() => setCurrent(null)}>
              Sing it again
            </button>
            <button className="btn quiet" onClick={() => go(`/song/${song.id}`)}>
              Done
            </button>
          </TakeReview>
        )}
      </section>
    </div>
  );
}
