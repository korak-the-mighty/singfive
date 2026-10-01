import { useEffect } from 'react';
import { Link } from 'wouter';
import { Emblem } from '../components/hand/Emblem';
import { ProfileView } from '../components/ProfileView';
import { useStore } from '../data/store';

export function FirstRead() {
  const profile = useStore((s) => s.profile);
  const busy = useStore((s) => s.profileBusy);
  const refresh = useStore((s) => s.refreshProfile);
  useEffect(() => {
    if (!profile) refresh();
  }, [profile, refresh]);

  if (!profile) return <div className="wrap"><p className="lead">Putting together what we heard…</p></div>;
  return (
    <div className="wrap fade-in">
      <div className="hero">
        <div>
          <div className="kicker">Your first five, heard</div>
          <h1 className="mt8" style={{ fontSize: 'clamp(40px, 6.4vw, 72px)' }}>
            Here’s what we heard.
          </h1>
          <p className="lead mt24 it" style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(24px, 3vw, 32px)', color: 'var(--ink)', maxWidth: '26ch' }}>
            {profile.headline}
          </p>
          {busy && <p className="small">The coach is still writing this up…</p>}
        </div>
        <div className="emblem">
          <Emblem gesture="open" size="100%" />
        </div>
      </div>

      <div className="notice calm mt24 small">
        <strong>How to read this.</strong> <em>We heard</em> means we measured it. <em>We think</em> is our interpretation. <em>Not sure yet</em> means we need to hear more. Open “What we measured” for the numbers.
      </div>

      <section>
        <ProfileView profile={profile} />
      </section>

      <section className="center">
        <p className="lead" style={{ margin: '0 auto' }}>
          From here, you have YOUR FIVE SONGS. Sing any of them again whenever you like, and we’ll tell you what changed.
        </p>
        <Link href="/" className="btn primary big mt24">
          Go to your five songs
        </Link>
      </section>
    </div>
  );
}
