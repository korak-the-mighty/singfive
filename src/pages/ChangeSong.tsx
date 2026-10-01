import { Link } from 'wouter';
import { fiveSuggestions, whatItAdds } from '../coach/five';
import { Back } from '../components/ui';
import { activeSlots, fiveSongs, useStore } from '../data/store';
import { findSong, SONGS } from '../songs/catalog';

export function ChangeSong({ songId }: { songId: string | null }) {
  const slots = useStore((s) => s.slots);
  const takes = useStore((s) => s.takes);
  const songs = fiveSongs(slots);
  const target = songId ? findSong(songId) : null;
  const inFive = target && activeSlots(slots).some((s) => s.songId === target.id);
  const candidates = SONGS.filter((s) => !songs.some((f) => f.id === s.id));
  const suggestions = fiveSuggestions(songs, takes.filter((t) => t.committed), candidates);
  const suggested = new Set(suggestions.filter((s) => !songId || !s.songId || s.songId === songId).flatMap((s) => s.candidates));
  const relevant = suggestions.filter((s) => (songId ? s.songId === songId || !s.songId : true)).slice(0, 2);
  const everIn = new Set(slots.filter((s) => s.removedAt).map((s) => s.songId));

  return (
    <div className="wrap">
      <Back to={target ? `/song/${target.id}` : '/'}>{target ? target.title : 'Your five songs'}</Back>
      <div className="kicker mt8">Your five can always change</div>
      <h2 className="mt8">{target && inFive ? `Change ${target.title}?` : 'Try a new song'}</h2>
      <p className="lead mt16">
        {target && inFive
          ? `Audition another song first. If it earns the place, ${target.title} steps out, with every take kept in your history.`
          : 'Audition a song. If it’s more yours, or more useful, it can take one of your five places. You and the coach decide together.'}
      </p>

      {relevant.length > 0 && (
        <div className="stack mt24">
          {relevant.map((s) => (
            <div key={s.id} className="notice calm">
              <strong>Your coach: </strong>
              {s.text}
            </div>
          ))}
        </div>
      )}

      <section>
        <div className="picker">
          {candidates.map((c) => {
            const adds = whatItAdds(c, songs);
            return (
              <div key={c.id} className="song-card" style={{ cursor: 'default' }}>
                {suggested.has(c.id) && <span className="tag think" style={{ alignSelf: 'flex-start' }}>Coach suggests</span>}
                <span className="title">{c.title}</span>
                <span className="feel">{c.feel}</span>
                <span className="small">{adds.length ? `Would add: ${adds.join(', ')}` : 'Tests things your five already test.'}</span>
                {everIn.has(c.id) && <span className="tiny">Was in your five before.</span>}
                <span className="meta">
                  <Link href={`/audition/${c.id}${target && inFive ? `?replace=${target.id}` : ''}`} className="btn small primary">
                    Audition it
                  </Link>
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
