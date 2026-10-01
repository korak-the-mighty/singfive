import { useState } from 'react';
import { useLocation } from 'wouter';
import { db } from '../data/db';
import { useStore } from '../data/store';
import { SONGS } from '../songs/catalog';

export function About() {
  const settings = useStore((s) => s.settings);
  const aiAvailable = useStore((s) => s.aiAvailable);
  const takes = useStore((s) => s.takes);
  const { setSettings, resetAll } = useStore.getState();
  const [confirm, setConfirm] = useState(false);
  const [, go] = useLocation();

  const exportData = async () => {
    const d = await db();
    const data = {
      exportedAt: new Date().toISOString(),
      note: 'Everything FIVE knows about your singing, except the audio recordings themselves.',
      settings: await d.get('kv', 'settings'),
      firstFive: await d.get('kv', 'firstFive'),
      profile: await d.get('kv', 'profile'),
      sixth: await d.get('kv', 'sixth'),
      slots: await d.getAll('slots'),
      takes: await d.getAll('takes'),
      observations: await d.getAll('observations'),
      practices: await d.getAll('practices'),
      events: await d.getAll('events'),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `five-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="wrap narrow fade-in">
      <div className="kicker">Privacy</div>
      <h2 className="mt8">Your voice stays here.</h2>
      <div className="stack mt24">
        <p>
          <strong>Recordings</strong> are saved only in this browser, on this device ({takes.length} take{takes.length === 1 ? '' : 's'} so far). They are never uploaded. Clearing your browser’s site data, or the button below, deletes them.
        </p>
        <p>
          <strong>Listening</strong> happens in your browser too. FIVE measures pitch, timing, steadiness and loudness on your device.
        </p>
        <p>
          <strong>The AI coach</strong>{' '}
          {aiAvailable
            ? 'is available. When it’s on, the coach’s written notes and the numbers behind them (never audio) are sent to Anthropic’s Claude to be rewritten in a warmer voice. Turn it off and FIVE’s own coach does all the writing.'
            : 'isn’t set up on this server, so FIVE’s own coach writes every note from your measurements. Nothing leaves your device.'}
        </p>
        {aiAvailable && (
          <label className="row" style={{ gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={settings.aiCoach} onChange={(e) => setSettings({ aiCoach: e.target.checked })} />
            Use the AI coach for written notes (sends text and numbers, never audio)
          </label>
        )}
      </div>

      <section>
        <h3>Your data</h3>
        <div className="row mt16">
          <button className="btn" onClick={exportData}>
            Download my data (JSON)
          </button>
          {!confirm ? (
            <button className="btn quiet" onClick={() => setConfirm(true)}>
              Delete everything
            </button>
          ) : (
            <span className="row">
              <span className="small">All recordings, notes and your five. This can’t be undone.</span>
              <button
                className="btn red small"
                onClick={async () => {
                  await resetAll();
                  go('/');
                }}
              >
                Yes, delete everything
              </button>
              <button className="btn quiet small" onClick={() => setConfirm(false)}>
                Cancel
              </button>
            </span>
          )}
        </div>
      </section>

      <section>
        <h3>How FIVE listens</h3>
        <ul className="mt16">
          <li>We track the pitch of your voice every hundredth of a second.</li>
          <li>We find the key you chose to sing in, then match your singing to the melody note by note.</li>
          <li>From that we measure what we can honestly measure: how close each note is, how steady long notes are, timing against your own beat, where you breathe, and how loud the high notes get.</li>
          <li>We don’t pretend to hear what audio can’t tell us, like whether you sound like yourself. Those notes say “Not sure yet”.</li>
          <li>Two takes are only called different when the change is bigger than the normal difference between takes.</li>
        </ul>
      </section>

      <section>
        <h3>The songs</h3>
        <p className="small mt8">All ten are in the public domain. Melodies were transcribed for FIVE and checked against published sources; folk songs have variants, so if you know a different version, the coach will say so rather than mark you wrong.</p>
        <ul className="small">
          {SONGS.map((s) => (
            <li key={s.id}>
              <strong>{s.title}</strong>: {s.origin}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
