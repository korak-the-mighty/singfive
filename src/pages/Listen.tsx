// Listen blind: two of your takes, unlabelled. Which do you prefer?
// Then we show which was which, and what we measured. Training your ear is
// part of singing; your preference is evidence too.

import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { compareTakes } from '../coach/compare';
import { Back, NoteLines, PlayButton, when } from '../components/ui';
import { useStore } from '../data/store';
import { findSong } from '../songs/catalog';

export function Listen({ songId }: { songId: string }) {
  const song = findSong(songId);
  const takes = useStore((s) => s.takes);
  const [choice, setChoice] = useState<'A' | 'B' | null>(null);
  const [seed] = useState(() => Math.random());
  const matched = takes.filter((t) => t.songId === songId && t.committed && t.kind !== 'practice' && t.analysis?.matched).sort((a, b) => a.createdAt - b.createdAt);
  const pair = useMemo(() => {
    if (matched.length < 2) return null;
    const first = matched[0];
    const last = matched[matched.length - 1];
    return seed < 0.5 ? { A: first, B: last } : { A: last, B: first };
  }, [matched.length, seed]);

  if (!song || !pair) {
    return (
      <div className="wrap narrow">
        <Back to={`/song/${songId}`}>Back</Back>
        <h2 className="mt16">You need two takes of this song to compare.</h2>
      </div>
    );
  }
  const earlier = pair.A.createdAt < pair.B.createdAt ? 'A' : 'B';
  const later = earlier === 'A' ? 'B' : 'A';
  const cmp = compareTakes(song, pair[later].analysis!, pair[earlier].analysis!);
  const measuredBetter = cmp.verdict === 'better' ? later : cmp.verdict === 'worse' ? earlier : null;

  return (
    <div className="wrap narrow">
      <Back to={`/song/${song.id}`}>{song.title}</Back>
      <div className="kicker mt8">Listen blind</div>
      <h2 className="mt8">Which do you prefer?</h2>
      <p className="lead mt16">Two of your takes of {song.title}. We won’t say which is which until you choose. Listen to both, all the way through.</p>

      <div className="two mt24">
        {(['A', 'B'] as const).map((k) => (
          <div key={k} className="card center" style={{ display: 'grid', justifyItems: 'center', gap: 12 }}>
            <div className="display" style={{ fontSize: 56 }}>
              {k}
            </div>
            <PlayButton takeId={pair[k].id} label={`Play take ${k}`} />
            <button className="btn" aria-pressed={choice === k} disabled={!!choice} onClick={() => setChoice(k)}>
              I prefer {k}
            </button>
            {choice && (
              <div className="small">
                {k === earlier ? 'Your first take' : 'Your latest take'} · {when(pair[k].createdAt)}
              </div>
            )}
          </div>
        ))}
      </div>

      {choice && (
        <section className="fade-in">
          <div className="verdict">
            {measuredBetter == null
              ? `You chose ${choice}. We measured them as about the same, so your ear is the judge here.`
              : measuredBetter === choice
                ? `You chose ${choice}, and the measurements agree.`
                : `You chose ${choice}. The measurements prefer ${measuredBetter}.`}
          </div>
          {measuredBetter != null && measuredBetter !== choice && (
            <p className="muted mt16">
              That’s worth noticing, not correcting. You may be hearing something we can’t measure, like feeling or ease. Or your ear may still be learning what “in tune” sounds like for you.
            </p>
          )}
          <div className="mt16">
            <NoteLines lines={cmp.changes.map((c) => ({ text: c.text, evidence: 'heard', tone: c.tone, proof: c.proof }))} />
          </div>
          <Link href={`/song/${song.id}`} className="btn mt24">
            Back to {song.title}
          </Link>
        </section>
      )}
    </div>
  );
}
