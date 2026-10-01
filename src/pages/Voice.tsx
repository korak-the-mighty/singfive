import { Link } from 'wouter';
import { buildVoiceMap } from '../coach/voice';
import { ProfileView } from '../components/ProfileView';
import { VoiceMapStrip } from '../components/VoiceMapStrip';
import { when } from '../components/ui';
import { activeSlots, useStore } from '../data/store';
import { getSong } from '../songs/catalog';

export function Voice() {
  const profile = useStore((s) => s.profile);
  const busy = useStore((s) => s.profileBusy);
  const takes = useStore((s) => s.takes);
  const slots = useStore((s) => s.slots);
  const events = useStore((s) => s.events);
  const firstFive = useStore((s) => s.firstFive);
  const refresh = useStore((s) => s.refreshProfile);
  const map = buildVoiceMap(takes.filter((t) => t.committed && t.kind !== 'practice'));
  const now = activeSlots(slots).map((s) => s.songId);

  return (
    <div className="wrap fade-in">
      <div className="kicker">Your voice</div>
      <h1 className="mt8" style={{ fontSize: 'clamp(40px, 6.4vw, 76px)' }}>
        What your five songs reveal
      </h1>
      {profile && (
        <p className="it mt16" style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(22px, 3vw, 30px)', maxWidth: '32ch', lineHeight: 1.25 }}>
          {profile.headline}
        </p>
      )}
      <div className="row mt16">
        <span className="small">
          {profile ? `Updated ${when(profile.updatedAt)} from ${map.notesHeard} notes. Written by ${profile.source === 'ai' ? 'the AI coach, from your measurements' : 'FIVE’s own coach, from your measurements'}.` : ''}
        </span>
        <button className="btn quiet small" onClick={() => refresh()} disabled={busy}>
          {busy ? 'Updating…' : 'Update'}
        </button>
      </div>

      <section>
        <VoiceMapStrip map={map} />
      </section>

      {profile && (
        <section>
          <ProfileView profile={profile} />
        </section>
      )}

      <section className="two">
        <div>
          <h3>Your first five</h3>
          <p className="small mt8">The songs you believed you could sing.</p>
          <ol className="mt8">
            {firstFive.map((id) => (
              <li key={id}>
                <Link href={`/song/${id}`}>{getSong(id).title}</Link> {now.includes(id) ? '' : <span className="tiny">· no longer in your five</span>}
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h3>Your five now</h3>
          <p className="small mt8">The songs that are teaching you now.</p>
          <ol className="mt8">
            {now.map((id) => (
              <li key={id}>
                <Link href={`/song/${id}`}>{getSong(id).title}</Link> {firstFive.includes(id) ? '' : <span className="tiny">· new</span>}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section>
        <h3>The story of your five</h3>
        <ul className="timeline mt16">
          {[...events].reverse().map((e) => (
            <li key={e.id}>
              <span className="small">{when(e.at)}</span>
              <span>{e.text}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
