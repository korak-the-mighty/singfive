import { useEffect } from 'react';
import { Link } from 'wouter';
import { fiveSuggestions } from '../coach/five';
import { readiness } from '../coach/sixth';
import { songState } from '../coach/songState';
import { Emblem } from '../components/hand/Emblem';
import { activeSlots, bestIds, fiveSongs, useStore } from '../data/store';
import { getSong, SONGS } from '../songs/catalog';

export function Home() {
  const slots = useStore((s) => s.slots);
  const takes = useStore((s) => s.takes);
  const observations = useStore((s) => s.observations);
  const practices = useStore((s) => s.practices);
  const profile = useStore((s) => s.profile);
  const refresh = useStore((s) => s.refreshProfile);
  const five = activeSlots(slots);
  const songs = fiveSongs(slots);
  const committed = takes.filter((t) => t.committed);
  const candidates = SONGS.filter((s) => !songs.some((f) => f.id === s.id));
  const suggestions = fiveSuggestions(songs, committed, candidates);
  const ready = readiness(songs, committed, bestIds(slots));
  const met = ready.criteria.filter((c) => c.met).length;

  useEffect(() => {
    if (!profile) refresh();
  }, [profile, refresh]);

  return (
    <div className="wrap fade-in">
      <div className="kicker yfs" style={{ color: 'var(--ink)' }}>
        Your five songs
      </div>
      {profile && (
        <p className="it mt16" style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(24px, 3.2vw, 34px)', lineHeight: 1.2, maxWidth: '30ch' }}>
          “{profile.headline}”
        </p>
      )}

      <ol className="five-list mt24">
        {five.map((slot, i) => {
          const song = getSong(slot.songId);
          const st = songState(song, takes, observations, practices, slot.bestTakeId);
          return (
            <li key={slot.id} className="five-row">
              <span className="n">{i + 1}</span>
              <Link href={`/song/${song.id}`} aria-label={`${song.title}: ${st.gesture.why}`}>
                <Emblem gesture={st.gesture.gesture} size={120} still />
              </Link>
              <div style={{ minWidth: 0 }}>
                <Link href={`/song/${song.id}`} className="t">
                  {song.title}
                </Link>
                <div className="line">{st.line}</div>
                {st.practice && (
                  <div className="tiny mt8">
                    Practice waiting: <Link href={`/song/${song.id}/practice/${st.practice.id}`}>{st.practice.title}</Link>
                  </div>
                )}
              </div>
              <div className="act">
                <Link href={`/song/${song.id}/sing`} className="btn red">
                  Sing again
                </Link>
              </div>
            </li>
          );
        })}
      </ol>

      {suggestions.length > 0 && (
        <section>
          <div className="kicker">From your coach</div>
          <div className="stack mt16">
            {suggestions.slice(0, 2).map((s) => (
              <div key={s.id} className="card spread">
                <p className="mt0 grow" style={{ margin: 0, minWidth: 240 }}>
                  {s.text}
                </p>
                <Link href={s.songId ? `/change/${s.songId}` : '/change'} className="btn small">
                  See the options
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="two">
        <div>
          <h3>Your five can always change</h3>
          <p className="muted mt8">Found a song that might be more yours, or more useful? Try it out. Nothing you’ve sung is lost.</p>
          <Link href="/change" className="btn">
            Try a new song
          </Link>
        </div>
        <div>
          <h3>The Sixth</h3>
          <p className="muted mt8">
            {ready.ready
              ? 'You’re ready. The coach has a song it thinks you can sing, first time.'
              : `Graduation comes when your five prove what you can do. ${met} of ${ready.criteria.length} things are true so far.`}
          </p>
          <Link href="/sixth" className="btn">
            {ready.ready ? 'Meet the Sixth' : 'What it takes'}
          </Link>
        </div>
      </section>
    </div>
  );
}
