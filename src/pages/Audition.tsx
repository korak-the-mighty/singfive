import { useState } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { auditionVerdict } from '../coach/five';
import { buildVoiceMap, suggestShift } from '../coach/voice';
import { SingPanel } from '../components/SingPanel';
import { TakeReview } from '../components/TakeReview';
import { Back } from '../components/ui';
import { activeSlots, bestIds, fiveSongs, useStore } from '../data/store';
import { findSong, getSong } from '../songs/catalog';
import type { Take } from '../types';

export function Audition({ candidateId }: { candidateId: string }) {
  const search = useSearch();
  const replaceId = new URLSearchParams(search).get('replace');
  const song = findSong(candidateId);
  const slots = useStore((s) => s.slots);
  const takes = useStore((s) => s.takes);
  const settings = useStore((s) => s.settings);
  const { commitTake, replaceSlot, addEvent } = useStore.getState();
  const [current, setCurrent] = useState<Take | null>(null);
  const [shiftOverride, setShiftOverride] = useState<number | null>(null);
  const [out, setOut] = useState<string | null>(replaceId);
  const [, go] = useLocation();
  const five = fiveSongs(slots);

  if (!song || five.some((f) => f.id === song.id)) {
    return (
      <div className="wrap narrow">
        <h2>That song is already in your five, or doesn’t exist.</h2>
        <Link href="/">Back to your five songs</Link>
      </div>
    );
  }
  const committed = takes.filter((t) => t.committed);
  const map = buildVoiceMap(committed.filter((t) => t.kind !== 'practice'));
  const shift = shiftOverride ?? suggestShift(song, map) ?? settings.guideOctave * 12;
  const verdict = current?.analysis ? auditionVerdict(song, current.analysis, five, committed, bestIds(slots)) : null;
  const choice = out ?? verdict?.suggestReplace ?? null;

  const onTake = async (t: Take) => {
    setCurrent(t);
    await commitTake(t.id);
  };

  const accept = async () => {
    if (!choice || !current) return;
    await replaceSlot(choice, song.id, `Swapped for ${song.title} after an audition.`, verdict?.lines[0] ?? 'Chosen after an audition.');
    go(`/song/${song.id}`);
  };

  const decline = async () => {
    await addEvent({ type: 'audition', text: `Auditioned ${song.title} and kept your five as it was.`, songIds: [song.id] });
    go('/');
  };

  return (
    <div className="wrap">
      <Back to={replaceId ? `/change/${replaceId}` : '/change'}>Back to the options</Back>
      <div className="kicker mt8">Audition</div>
      <h2 className="mt8">{song.title}</h2>
      {!current && <p className="lead mt16">Sing it once. We’ll tell you what it would bring to your five.</p>}

      <section className="mt24">
        {!current ? (
          <SingPanel song={song} kind="audition" shift={shift} onShift={setShiftOverride} onTake={onTake} />
        ) : (
          <TakeReview song={song} take={current} askFeeling>
            <button className="btn" onClick={() => setCurrent(null)}>
              Sing it again
            </button>
          </TakeReview>
        )}
      </section>

      {current && verdict && (
        <section className="card fade-in">
          <div className="kicker">What it would bring</div>
          <ul className="note-list mt8">
            {verdict.lines.map((l) => (
              <li key={l} style={{ gridTemplateColumns: '1fr' }}>
                {l}
              </li>
            ))}
          </ul>
          {current.analysis?.matched && (
            <>
              <h3 className="mt24">Which place should it take?</h3>
              {verdict.suggestReplace && verdict.reason && (
                <p className="small mt8">
                  Your coach would let go of <strong>{getSong(verdict.suggestReplace).title}</strong>: {verdict.reason} The choice is yours.
                </p>
              )}
              <div className="chips mt16">
                {activeSlots(slots).map((s) => (
                  <button key={s.id} className="chip" aria-pressed={choice === s.songId} onClick={() => setOut(s.songId)}>
                    {getSong(s.songId).title}
                  </button>
                ))}
              </div>
              <div className="row mt24">
                <button className="btn primary" disabled={!choice} onClick={accept}>
                  {choice ? `Put ${song.title} in place of ${getSong(choice).title}` : 'Choose a place'}
                </button>
                <button className="btn quiet" onClick={decline}>
                  Keep my five as it is
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
