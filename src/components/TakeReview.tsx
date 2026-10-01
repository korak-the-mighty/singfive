// Right after you sing: hear it back, and hear what the coach heard.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { polishTakeNote } from '../coach/ai';
import { noteForTake, softQualityHints, type TakeNote } from '../coach/takeNote';
import { useStore } from '../data/store';
import type { Feeling, Song, Take, TakeAnalysis } from '../types';
import { MelodyLine } from './MelodyLine';
import { NoteLines, PlayButton } from './ui';

export const FEELINGS: { id: Feeling; label: string }[] = [
  { id: 'easy', label: 'Easy' },
  { id: 'pushing', label: 'I was pushing' },
  { id: 'holding-back', label: 'Holding back' },
  { id: 'copying', label: 'Like the record' },
  { id: 'like-me', label: 'Like me' },
];

export function TakeReview({
  song,
  take,
  before,
  beforeLabel,
  children,
  askFeeling = true,
}: {
  song: Song;
  take: Take;
  before?: TakeAnalysis | null;
  beforeLabel?: string;
  children?: ReactNode;
  askFeeling?: boolean;
}) {
  const setFeeling = useStore((s) => s.setFeeling);
  const observations = useStore((s) => s.observations);
  const { aiCoach } = useStore((s) => s.settings);
  const aiAvailable = useStore((s) => s.aiAvailable);
  const live = useStore((s) => s.takes.find((t) => t.id === take.id)) ?? take;
  const a = live.analysis!;
  const local = useMemo(
    () => noteForTake({ song, analysis: a, feeling: live.feeling, before, beforeLabel, history: observations.filter((o) => o.firstSeen < live.createdAt) }),
    [song.id, live.id, live.feeling?.join(','), before],
  );
  const [note, setNote] = useState<TakeNote>(local);
  useEffect(() => {
    setNote(local);
    if (!aiCoach || !aiAvailable || local.problem) return;
    let cancelled = false;
    polishTakeNote(local, { title: song.title, feel: song.feel }, { measures: a.measures, matched: a.matched })
      .then((n) => !cancelled && setNote(n))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [local, aiCoach, aiAvailable, song, a]);

  const hints = softQualityHints(a);
  const toggle = (f: Feeling) => {
    const cur = new Set(live.feeling ?? []);
    if (cur.has(f)) cur.delete(f);
    else cur.add(f);
    setFeeling(live.id, [...cur]);
  };

  return (
    <div className="fade-in stack">
      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <PlayButton takeId={live.id} label="Hear your take" />
        <div className="verdict" style={{ marginTop: 2 }}>
          {note.headline}
        </div>
      </div>
      {note.problem ? (
        <p className="muted">Nothing was saved to your coach’s notes from this take.</p>
      ) : (
        <>
          {note.comparison && beforeLabel && <div className="small">Compared with {beforeLabel}.</div>}
          <NoteLines lines={note.lines} />
          <MelodyLine section={song.section} shift={a.measures ? Math.round(a.measures.keyShift) : 0} take={a} compare={before ?? null} height={130} />
          {before && (
            <div className="tiny">
              Solid line: this take. Dashed: {beforeLabel ?? 'before'}. Bars: the melody.
            </div>
          )}
        </>
      )}
      {hints.map((h) => (
        <div key={h} className="notice calm small">
          {h}
        </div>
      ))}
      {askFeeling && !note.problem && (
        <div>
          <div className="small" style={{ marginBottom: 8 }}>
            How did it feel? <span className="tiny">Optional. It helps us compare what you feel with what we hear.</span>
          </div>
          <div className="chips">
            {FEELINGS.map((f) => (
              <button key={f.id} className="chip" aria-pressed={live.feeling?.includes(f.id) ?? false} onClick={() => toggle(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {children && <div className="row mt16">{children}</div>}
    </div>
  );
}
