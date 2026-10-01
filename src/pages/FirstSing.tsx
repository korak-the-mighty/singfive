import { useMemo, useState } from 'react';
import { Redirect, useLocation } from 'wouter';
import { suggestShift, buildVoiceMap } from '../coach/voice';
import { SingPanel } from '../components/SingPanel';
import { TakeReview } from '../components/TakeReview';
import { PlayButton, when } from '../components/ui';
import { activeSlots, useStore } from '../data/store';
import { getSong, SONGS } from '../songs/catalog';
import type { Take } from '../types';

export function FirstSing({ index }: { index: number }) {
  const slots = useStore((s) => s.slots);
  const takes = useStore((s) => s.takes);
  const settings = useStore((s) => s.settings);
  const { commitTake, discardUncommitted, setGuideShift, refreshProfile, addEvent, replaceSlot } = useStore.getState();
  const [, go] = useLocation();
  const five = activeSlots(slots);
  const slot = five[index];
  const [current, setCurrent] = useState<Take | null>(null);
  const [swapping, setSwapping] = useState(false);
  const committedTakes = useMemo(() => takes.filter((t) => t.committed && t.kind !== 'practice'), [takes]);

  if (!slot) return <Redirect to="/" replace />;
  const song = getSong(slot.songId);
  const attempts = takes.filter((t) => t.songId === song.id && t.kind === 'first' && !t.committed);
  const alreadyKept = takes.some((t) => t.songId === song.id && t.committed);
  const map = buildVoiceMap(committedTakes);
  const shift = slot.guideShift ?? suggestShift(song, map) ?? settings.guideOctave * 12;

  const keep = async (t: Take) => {
    await commitTake(t.id);
    await discardUncommitted(song.id, t.id);
    setCurrent(null);
    if (index >= 4 || five.every((s, i) => i === index || takes.some((x) => x.songId === s.songId && x.committed))) {
      await refreshProfile();
      await addEvent({ type: 'first-profile', text: 'FIVE listened to your first five songs.', songIds: five.map((s) => s.songId) });
      go('/first-read');
    } else {
      go(`/first/${index + 1}`);
    }
  };

  const swapTo = async (id: string) => {
    for (const t of attempts) await useStore.getState().deleteTake(t.id);
    await replaceSlot(song.id, id, 'Swapped before singing it.', 'One of the five songs you believed you could sing.');
    await useStore.getState().swapFirstFive(song.id, id);
    setSwapping(false);
    setCurrent(null);
  };

  return (
    <div className="wrap">
      <div className="row" style={{ gap: 8 }} aria-label="Your five songs">
        {five.map((s, i) => {
          const done = takes.some((t) => t.songId === s.songId && t.committed);
          return (
            <span key={s.id} className={`tag ${i === index ? 'heard' : done ? 'soft' : 'unsure'}`} style={i === index ? { background: 'var(--ink)', color: 'var(--paper)' } : undefined}>
              {i + 1}. {getSong(s.songId).title}
              {done && i !== index ? ' ✓' : ''}
            </span>
          );
        })}
      </div>

      <div className="mt24">
        <div className="kicker">
          Song {index + 1} of 5 · {song.section.label}
        </div>
        <h2 className="mt8">{song.title}</h2>
        {index === 0 && !current && attempts.length === 0 && (
          <p className="lead mt16">
            Sing it the way you’d sing it in your kitchen. No warm-up, no performance. We’ll play your first note, count you in, and listen.
          </p>
        )}
        {index > 0 && !current && attempts.length === 0 && <p className="lead mt16">{song.feel}</p>}
      </div>

      <section className="mt24">
        {!current ? (
          <SingPanel
            song={song}
            kind="first"
            shift={shift}
            onShift={(n) => setGuideShift(song.id, n)}
            onTake={(t) => setCurrent(t)}
          />
        ) : (
          <TakeReview song={song} take={current}>
            <button className="btn primary big" onClick={() => keep(current)}>
              {index >= 4 ? 'Keep this one. Show me what you heard' : 'Keep this one. Next song →'}
            </button>
            <button className="btn" onClick={() => setCurrent(null)}>
              Sing it again
            </button>
          </TakeReview>
        )}
      </section>

      {attempts.length > 1 && (
        <section>
          <h3>Your tries at {song.title}</h3>
          <p className="small">Keep the one you like best. The others are deleted.</p>
          <ul className="takes">
            {attempts.map((t, i) => (
              <li key={t.id}>
                <PlayButton takeId={t.id} />
                <div>
                  Try {i + 1} <span className="tiny">· {when(t.createdAt)}</span>
                  {t.analysis && !t.analysis.matched && <div className="tiny">We couldn’t follow the melody in this one.</div>}
                </div>
                <button className="btn small" onClick={() => keep(t)}>
                  Keep this one
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!alreadyKept && (
        <section>
          {!swapping ? (
            <button className="btn quiet small" onClick={() => setSwapping(true)}>
              Not this song after all? Choose another for this place
            </button>
          ) : (
            <div className="card">
              <div className="spread">
                <h3>Choose another song</h3>
                <button className="btn quiet small" onClick={() => setSwapping(false)}>
                  Cancel
                </button>
              </div>
              <div className="chips mt16">
                {SONGS.filter((s) => !five.some((f) => f.songId === s.id)).map((s) => (
                  <button key={s.id} className="chip" onClick={() => swapTo(s.id)}>
                    {s.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
