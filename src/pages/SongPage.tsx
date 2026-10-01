import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { compareTakes } from '../coach/compare';
import { GESTURE_MEANING } from '../coach/gesture';
import { songState } from '../coach/songState';
import { noteForTake } from '../coach/takeNote';
import { Emblem } from '../components/hand/Emblem';
import { MelodyLine } from '../components/MelodyLine';
import { Back, NoteLines, PlayButton, Tag, when } from '../components/ui';
import { activeSlots, useStore } from '../data/store';
import { findSong } from '../songs/catalog';
import type { Take } from '../types';

const KIND: Record<Take['kind'], string> = { first: 'First take', again: 'Sang it again', practice: 'Practice', audition: 'Audition', sixth: 'The Sixth' };

export function SongPage({ songId }: { songId: string }) {
  const song = findSong(songId);
  const slots = useStore((s) => s.slots);
  const takes = useStore((s) => s.takes);
  const observations = useStore((s) => s.observations);
  const practices = useStore((s) => s.practices);
  const { setBest, deleteTake } = useStore.getState();
  const [picked, setPicked] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const five = activeSlots(slots);
  const slot = five.find((s) => s.songId === songId);
  const pastSlot = slots.filter((s) => s.songId === songId && s.removedAt).pop();
  const st = useMemo(() => (song ? songState(song, takes, observations, practices, slot?.bestTakeId) : null), [song, takes, observations, practices, slot?.bestTakeId]);
  const all = takes.filter((t) => t.songId === songId && t.committed && t.kind !== 'practice').sort((a, b) => b.createdAt - a.createdAt);
  const practiceTakes = takes.filter((t) => t.songId === songId && t.kind === 'practice');

  if (!song || !st) {
    return (
      <div className="wrap narrow">
        <h2>We don’t know that song.</h2>
        <Link href="/">Back to your five songs</Link>
      </div>
    );
  }

  const pair = picked.map((id) => all.find((t) => t.id === id)).filter((t): t is Take => !!t?.analysis?.matched);
  pair.sort((a, b) => a.createdAt - b.createdAt);
  const comparison = pair.length === 2 ? compareTakes(song, pair[1].analysis!, pair[0].analysis!) : null;
  const best = st.best;
  const u = st.understanding;
  const position = slot ? five.indexOf(slot) + 1 : null;

  const togglePick = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p.slice(-1), id]));

  return (
    <div className="wrap fade-in">
      <Back to="/">Your five songs</Back>
      <div className="hero" style={{ paddingTop: 8 }}>
        <div>
          <div className="kicker">{position ? `Song ${position} of your five` : 'From your history'}</div>
          <h1 className="mt8" style={{ fontSize: 'clamp(40px, 6.4vw, 76px)' }}>
            {song.title}
          </h1>
          <p className="it mt16" style={{ fontFamily: 'var(--serif)', fontSize: 24, lineHeight: 1.25, maxWidth: '30ch' }}>
            {st.gesture.why}
          </p>
          <p className="small">{song.origin}</p>
          {slot ? (
            <div className="row mt24">
              <Link href={`/song/${song.id}/sing`} className="btn red big">
                Sing it again
              </Link>
              {st.practice && (
                <Link href={`/song/${song.id}/practice/${st.practice.id}`} className="btn big">
                  Practice: {st.practice.title}
                </Link>
              )}
            </div>
          ) : (
            pastSlot && (
              <div className="notice calm mt24">
                This song was in your five until {new Date(pastSlot.removedAt!).toLocaleDateString()}. {pastSlot.reasonOut}
                <div className="mt8">
                  <Link href={`/audition/${song.id}`} className="btn small">
                    Audition it again
                  </Link>
                </div>
              </div>
            )
          )}
        </div>
        <div className="emblem">
          <Emblem gesture={st.gesture.gesture} size="100%" title={GESTURE_MEANING[st.gesture.gesture]} />
        </div>
      </div>

      {best?.analysis?.matched && (
        <section>
          <div className="spread">
            <h3>Your best take</h3>
            <div className="row">
              <span className="small">{when(best.createdAt)}</span>
              <PlayButton takeId={best.id} label="Play your best take" />
            </div>
          </div>
          <div className="mt16">
            <MelodyLine section={song.section} shift={Math.round(best.analysis.measures!.keyShift)} take={best.analysis} height={140} />
          </div>
          <div className="tiny">Bars: the melody, in the key you sang it. Line: you.</div>
        </section>
      )}

      <section className="two">
        <div>
          <h3>What we understand about this song</h3>
          {u.strengths.length + u.difficulties.length + u.notes.length === 0 ? (
            <p className="muted mt8">Nothing yet. Sing it and we’ll start listening.</p>
          ) : (
            <div className="mt8">
              <NoteLines
                lines={[...u.strengths, ...u.difficulties, ...u.notes].map((o) => ({
                  text: o.text,
                  meta: o.timesSeen > 1 ? `Heard in ${o.timesSeen} takes` : undefined,
                  evidence: o.evidence,
                  proof: o.proof,
                }))}
              />
            </div>
          )}
          {u.improved.length > 0 && (
            <>
              <h3 className="mt24">Getting better</h3>
              <ul className="note-list mt8">
                {u.improved.map((o) => (
                  <li key={o.key}>
                    <Tag kind="better" />
                    <div>
                      {o.status === 'gone' ? 'Gone: ' : 'Not heard last time: '}
                      <span className="muted">{o.text.charAt(0).toLowerCase() + o.text.slice(1)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div>
          <h3>Your focus</h3>
          {st.practice ? (
            <div className="card mt8">
              <div className="kicker">Practice</div>
              <h3 className="mt8">{st.practice.title}</h3>
              <p className="mt8">{st.practice.because}</p>
              <p className="small">{st.practice.howTo}</p>
              {slot && (
                <Link href={`/song/${song.id}/practice/${st.practice.id}`} className="btn primary">
                  Start
                </Link>
              )}
            </div>
          ) : (
            <p className="muted mt8">No practice right now. Singing the song again is the best practice.</p>
          )}
          {practiceTakes.length > 0 && <p className="tiny mt8">{practiceTakes.length} practice attempt{practiceTakes.length > 1 ? 's' : ''} so far.</p>}
        </div>
      </section>

      <section>
        <div className="spread">
          <h3>Every take</h3>
          {all.filter((t) => t.analysis?.matched).length >= 2 && (
            <Link href={`/song/${song.id}/listen`} className="btn small">
              Listen blind: which do you prefer?
            </Link>
          )}
        </div>
        <p className="small mt8">Pick two to compare them.</p>
        <ul className="takes">
          {all.map((t) => {
            const isBest = slot?.bestTakeId === t.id;
            const n = t.analysis ? noteForTake({ song, analysis: t.analysis }) : null;
            return (
              <li key={t.id}>
                <PlayButton takeId={t.id} />
                <div style={{ minWidth: 0 }}>
                  <div>
                    {KIND[t.kind]} <span className="tiny">· {when(t.createdAt)}</span> {isBest && <span className="tag heard">Best</span>}
                  </div>
                  <div className="small" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {n?.problem ? 'We couldn’t follow this one.' : n?.findings[0]?.text ?? ''}
                  </div>
                </div>
                <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                  {t.analysis?.matched && (
                    <button className="chip" aria-pressed={picked.includes(t.id)} onClick={() => togglePick(t.id)}>
                      Compare
                    </button>
                  )}
                  {slot && !isBest && t.analysis?.matched && (
                    <button className="btn quiet small" onClick={() => setBest(song.id, t.id)}>
                      Make best
                    </button>
                  )}
                  {confirmDelete === t.id ? (
                    <>
                      <button className="btn small" onClick={() => deleteTake(t.id).then(() => setConfirmDelete(null))}>
                        Delete for good
                      </button>
                      <button className="btn quiet small" onClick={() => setConfirmDelete(null)}>
                        Keep
                      </button>
                    </>
                  ) : (
                    <button className="btn quiet small" onClick={() => setConfirmDelete(t.id)} aria-label="Delete this take">
                      Delete
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {comparison && pair.length === 2 && (
          <div className="card mt16 fade-in">
            <div className="kicker">
              {when(pair[0].createdAt)} → {when(pair[1].createdAt)}
            </div>
            <div className="verdict mt8">{comparison.headline}</div>
            <div className="mt16">
              <NoteLines lines={comparison.changes.map((c) => ({ text: c.text, evidence: 'heard', tone: c.tone, proof: c.proof }))} />
            </div>
            <MelodyLine section={song.section} shift={Math.round(pair[1].analysis!.measures!.keyShift)} take={pair[1].analysis} compare={pair[0].analysis} height={130} />
            <div className="tiny">Solid: the later take. Dashed: the earlier one.</div>
          </div>
        )}
      </section>

      {slot && (
        <section>
          <hr className="rule" />
          <div className="spread">
            <div>
              <h3>Is this still one of your five?</h3>
              <p className="muted mt8">You can swap it for another song at any time. Its takes stay in your history.</p>
            </div>
            <Link href={`/change/${song.id}`} className="btn">
              Change this song
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
