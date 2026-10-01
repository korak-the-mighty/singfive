import { useEffect, useRef, useState } from 'react';
import { Redirect, useLocation } from 'wouter';
import { guideContext, playMelody, type Scheduled } from '../audio/guide';
import { Emblem } from '../components/hand/Emblem';
import { activeSlots, useStore } from '../data/store';
import { SONGS } from '../songs/catalog';
import { songTags } from '../songs/traits';

export function Start() {
  const slots = useStore((s) => s.slots);
  const chooseFive = useStore((s) => s.chooseFive);
  const [picked, setPicked] = useState<string[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const [, go] = useLocation();
  const sched = useRef<Scheduled | null>(null);
  const timer = useRef(0);

  useEffect(
    () => () => {
      sched.current?.stop();
      clearTimeout(timer.current);
    },
    [],
  );

  if (activeSlots(slots).length === 5) return <Redirect to="/" replace />;

  const toggle = (id: string) => {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 5 ? [...p, id] : p));
  };

  const hear = (id: string) => {
    sched.current?.stop();
    clearTimeout(timer.current);
    if (playing === id) {
      setPlaying(null);
      return;
    }
    const song = SONGS.find((s) => s.id === id)!;
    const ctx = guideContext();
    ctx.resume();
    sched.current = playMelody(ctx, song.section, { shift: 0 });
    setPlaying(id);
    timer.current = window.setTimeout(() => setPlaying(null), (sched.current.endTime - ctx.currentTime + 0.2) * 1000);
  };

  const confirm = async () => {
    sched.current?.stop();
    await chooseFive(picked);
    go('/first/0');
  };

  const left = 5 - picked.length;

  return (
    <>
      <div className="wrap">
        <div className="hero">
          <div>
            <h1>
              What are <span className="it">your five songs?</span>
            </h1>
            <p className="lead mt24">
              Choose five songs you believe you can sing. You’ll sing a short part of each, and FIVE starts learning your voice by listening.
            </p>
            <p className="lead">These five songs become your course.</p>
          </div>
          <div className="emblem">
            <Emblem gesture="frame" size="100%" title="A mouth, and a hand framing it" />
          </div>
        </div>

        <section>
          <div className="spread">
            <h3>Pick five</h3>
            <span className="small">All ten are free to sing and share. Each asks something different of a voice.</span>
          </div>
          <div className="picker mt16">
            {SONGS.map((s) => {
              const n = picked.indexOf(s.id);
              const tags = songTags(s).slice(0, 3);
              return (
                <div key={s.id} className="song-card" role="button" tabIndex={0} aria-pressed={n >= 0} onClick={() => toggle(s.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggle(s.id))}>
                  <span className="pick" aria-hidden>
                    {n >= 0 ? n + 1 : ''}
                  </span>
                  <span className="title">{s.title}</span>
                  <span className="feel">{s.feel}</span>
                  <span className="meta">
                    {tags.map((t) => (
                      <span key={t} className="tag soft">
                        {t}
                      </span>
                    ))}
                  </span>
                  <button
                    className="btn quiet small listen"
                    onClick={(e) => {
                      e.stopPropagation();
                      hear(s.id);
                    }}
                  >
                    {playing === s.id ? '■ Stop' : '▶ Hear how it goes'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="tray" aria-live="polite">
        <div className="wrap spread">
          <div className="slots" data-count={`${picked.length} of 5 chosen`}>
            {[0, 1, 2, 3, 4].map((i) => {
              const s = SONGS.find((x) => x.id === picked[i]);
              return (
                <span key={i} className={`slot${s ? ' full' : ''}`}>
                  {i + 1}. {s ? s.title : '—'}
                </span>
              );
            })}
          </div>
          <button className="btn primary big" disabled={left > 0} onClick={confirm}>
            {left > 0 ? `Pick ${left} more` : 'These are my five'}
          </button>
        </div>
      </div>
    </>
  );
}
