import { useState } from 'react';
import { Link } from 'wouter';
import { judgeSixth, proposeSixth, readiness } from '../coach/sixth';
import { Emblem } from '../components/hand/Emblem';
import { SingPanel } from '../components/SingPanel';
import { TakeReview } from '../components/TakeReview';
import { Back, Tag } from '../components/ui';
import { bestIds, fiveSongs, useStore } from '../data/store';
import { getSong, SONGS } from '../songs/catalog';
import type { Take } from '../types';
import { buildVoiceMap, suggestShift } from '../coach/voice';

export function Sixth() {
  const slots = useStore((s) => s.slots);
  const takes = useStore((s) => s.takes);
  const sixth = useStore((s) => s.sixth);
  const { setSixth, commitTake, addEvent } = useStore.getState();
  const [current, setCurrent] = useState<Take | null>(null);
  const five = fiveSongs(slots);
  const committed = takes.filter((t) => t.committed);
  const ready = readiness(five, committed, bestIds(slots));
  const everIn = new Set(slots.map((s) => s.songId));
  const candidates = SONGS.filter((s) => !five.some((f) => f.id === s.id));

  const propose = async () => {
    const p = proposeSixth(five, everIn, committed, candidates);
    if (p) await setSixth(p);
  };

  const onTake = async (t: Take) => {
    setCurrent(t);
    await commitTake(t.id);
    if (sixth && t.analysis?.matched) {
      const verdict = judgeSixth(sixth, t.analysis);
      await setSixth({ ...sixth, takeId: t.id, verdict });
      await addEvent({ type: 'sixth', text: `You sang the Sixth: ${getSong(sixth.songId).title}.`, songIds: [sixth.songId] });
    }
  };

  const song = sixth ? getSong(sixth.songId) : null;
  const map = buildVoiceMap(committed.filter((t) => t.kind !== 'practice'));
  const right = sixth?.verdict?.filter((v) => v.right).length ?? 0;
  const sixthTake = sixth?.takeId ? takes.find((t) => t.id === sixth.takeId) : null;
  const inTune = sixthTake?.analysis?.measures?.inTuneShare ?? 0;

  return (
    <div className="wrap fade-in">
      <Back to="/">Your five songs</Back>
      <div className="hero" style={{ paddingTop: 8 }}>
        <div>
          <div className="kicker">Graduation</div>
          <h1 className="mt8">The Sixth</h1>
          <p className="lead mt24">
            One day the coach will say: <em>if I really understand your voice, I think you can sing this.</em> A song you’ve never sung here. It tests you, and it tests the coach.
          </p>
        </div>
        <div className="emblem">
          <Emblem gesture={sixth?.verdict ? 'release' : 'reach'} size="100%" />
        </div>
      </div>

      <section>
        <h3>{ready.ready ? 'You’re ready.' : 'Not yet. Here’s what it takes.'}</h3>
        <ul className="criteria mt16">
          {ready.criteria.map((c) => (
            <li key={c.text}>
              <span className={`mark${c.met ? ' met' : ''}`} aria-label={c.met ? 'Done' : 'Not yet'}>
                {c.met ? '✓' : ''}
              </span>
              <div>
                {c.text}
                <div className="tiny">{c.detail}</div>
              </div>
            </li>
          ))}
        </ul>
        {!ready.ready && (
          <p className="muted mt16">
            Keep singing YOUR FIVE SONGS. Every take moves one of these forward. <Link href="/">Back to your five</Link>
          </p>
        )}
      </section>

      {ready.ready && !sixth && (
        <section>
          <button className="btn red big" onClick={propose}>
            Ask the coach for the Sixth
          </button>
        </section>
      )}

      {sixth && song && (
        <section className="card">
          <div className="kicker">The coach’s hypothesis</div>
          <p className="verdict mt8">{sixth.hypothesis}</p>
          <h3 className="mt24">What the coach predicts</h3>
          <ul className="note-list mt8">
            {sixth.predictions.map((p) => {
              const v = sixth.verdict?.find((x) => x.key === p.key);
              return (
                <li key={p.key}>
                  {v ? <Tag kind={v.right ? 'better' : 'worse'} /> : <Tag kind="think" />}
                  <div>
                    {p.text} {v && <strong>{v.right ? 'The coach was right.' : 'The coach was wrong.'}</strong>}
                  </div>
                </li>
              );
            })}
          </ul>
          {sixth.verdict && sixthTake && (
            <div className="mt24">
              <p className="verdict">
                The coach was right about {right} of {sixth.predictions.length}.{' '}
                {inTune >= 0.75
                  ? 'And you sang a song you’d never sung here, mostly in tune, the first time. That’s what your five taught you.'
                  : 'The new song was harder than your five. That’s information, not failure: it shows what your five haven’t taught yet.'}
              </p>
            </div>
          )}
        </section>
      )}

      {sixth && song && !sixth.verdict && (
        <section>
          {!current ? (
            <SingPanel song={song} kind="sixth" shift={suggestShift(song, map) ?? 0} onTake={onTake} label="The Sixth" />
          ) : (
            <TakeReview song={song} take={current} askFeeling={false}>
              <button className="btn" onClick={() => setCurrent(null)}>
                Try again
              </button>
            </TakeReview>
          )}
        </section>
      )}
      {sixth?.verdict && current && (
        <section>
          <TakeReview song={song!} take={current} askFeeling={false} />
        </section>
      )}
    </div>
  );
}
