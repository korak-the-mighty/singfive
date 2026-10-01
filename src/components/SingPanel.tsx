// Singing: hear how it goes, find your note, sing. One big button.

import { useEffect, useRef, useState } from 'react';
import { analyze, subSection } from '../audio/analyze';
import { guideContext, playCountIn, playMelody, playStartingNote, type Scheduled } from '../audio/guide';
import { MicUnavailable, Recorder } from '../audio/recorder';
import { toWav } from '../audio/wav';
import { lineText } from '../coach/practice';
import { useStore } from '../data/store';
import { countInClicks, sectionSeconds } from '../songs/traits';
import type { Song, Take, TakeKind } from '../types';
import { Emblem } from './hand/Emblem';
import { MelodyLine } from './MelodyLine';
import { stopPlayback } from './ui';

type Phase = 'ready' | 'opening' | 'note' | 'count' | 'singing' | 'listening' | 'error';

interface Props {
  song: Song;
  kind: TakeKind;
  shift: number;
  onShift?: (shift: number) => void;
  range?: [number, number];
  practiceId?: string;
  onTake: (take: Take) => void;
  /** Words above the button, e.g. "Song 2 of 5". */
  label?: string;
}

const levelOf = (rms: number) => Math.max(0, Math.min(1, (20 * Math.log10(rms + 1e-9) + 52) / 36));

export function SingPanel({ song, kind, shift, onShift, range, practiceId, onTake, label }: Props) {
  const section = range ? subSection(song.section, range) : song.section;
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const addTake = useStore((s) => s.addTake);
  const [phase, setPhase] = useState<Phase>('ready');
  const [error, setError] = useState<string | null>(null);
  const [beat, setBeat] = useState(-1);
  const [level, setLevel] = useState(0);
  const [hearing, setHearing] = useState<number | null>(null);
  const rec = useRef<Recorder | null>(null);
  const scheduled = useRef<Scheduled[]>([]);
  const timers = useRef<number[]>([]);
  const firstNoteCtxTime = useRef(0);
  const raf = useRef(0);
  const clicks = countInClicks(section);
  const guideOn = settings.guideWhileSinging;

  const clearAll = () => {
    scheduled.current.forEach((s) => s.stop());
    scheduled.current = [];
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
    cancelAnimationFrame(raf.current);
  };

  useEffect(
    () => () => {
      clearAll();
      rec.current?.close();
      rec.current = null;
    },
    [],
  );

  // --- Hear how it goes ------------------------------------------------------------
  const hear = () => {
    stopPlayback();
    clearAll();
    if (hearing != null) {
      setHearing(null);
      return;
    }
    const ctx = guideContext();
    ctx.resume();
    const s = playMelody(ctx, section, { shift });
    scheduled.current.push(s);
    const beatSec = 60 / section.bpm;
    const tick = () => {
      const t = ctx.currentTime - s.firstNoteTime;
      if (ctx.currentTime > s.endTime + 0.1) {
        setHearing(null);
        return;
      }
      setHearing(Math.max(0, t / beatSec));
      raf.current = requestAnimationFrame(tick);
    };
    setHearing(0);
    raf.current = requestAnimationFrame(tick);
  };

  // --- Sing ---------------------------------------------------------------------------
  const start = async () => {
    stopPlayback();
    clearAll();
    setHearing(null);
    setError(null);
    setPhase('opening');
    try {
      rec.current = await Recorder.open();
    } catch (e) {
      setError(e instanceof MicUnavailable ? e.message : 'The microphone couldn’t start.');
      setPhase('error');
      return;
    }
    const r = rec.current;
    const ctx = r.ctx;
    // 1. Your starting note (before recording, so the tone isn't analysed as singing).
    setPhase('note');
    const note = playStartingNote(ctx, section, shift);
    scheduled.current.push(note);
    const meter = () => {
      setLevel(levelOf(r.level));
      raf.current = requestAnimationFrame(meter);
    };
    raf.current = requestAnimationFrame(meter);
    timers.current.push(
      window.setTimeout(() => {
        // 2. Record, count in, sing.
        r.start();
        setPhase('count');
        const count = playCountIn(ctx, section, ctx.currentTime + 0.15);
        scheduled.current.push(count);
        firstNoteCtxTime.current = count.firstNoteTime;
        const startAt = ctx.currentTime + 0.15;
        clicks.forEach((c, i) => {
          timers.current.push(window.setTimeout(() => setBeat(i), (startAt - ctx.currentTime + c.t) * 1000));
        });
        timers.current.push(
          window.setTimeout(() => {
            setPhase('singing');
            setBeat(-1);
          }, (count.firstNoteTime - ctx.currentTime) * 1000),
        );
        if (guideOn) scheduled.current.push(playMelody(ctx, section, { shift }, count.firstNoteTime));
        // Safety stop well after the section should have ended.
        const maxSec = count.firstNoteTime - ctx.currentTime + sectionSeconds(section) * 1.8 + 6;
        timers.current.push(window.setTimeout(() => finish(), maxSec * 1000));
      }, 1250),
    );
  };

  const finishing = useRef(false);
  const finish = async () => {
    const r = rec.current;
    if (!r || finishing.current) return;
    finishing.current = true;
    clearAll();
    setPhase('listening');
    setLevel(0);
    try {
      const pcm = await r.stop();
      const sampleRate = r.sampleRate;
      const firstNoteAt = Math.max(0, firstNoteCtxTime.current - r.startedAt);
      r.close();
      rec.current = null;
      const analysis = await analyze(pcm, sampleRate, {
        notes: section.notes,
        firstNoteAt,
        strictTime: section.timeFeel === 'strict',
        minVoicedSec: range ? Math.min(3, sectionSeconds(section) * 0.5) : 3,
      });
      // Practice takes refer to notes of the full song.
      if (range) analysis.notes = analysis.notes.map((n) => ({ ...n, ref: n.ref + range[0] }));
      const take = await addTake(
        {
          songId: song.id,
          kind,
          durationSec: pcm.length / sampleRate,
          settings: { guideShift: shift, countIn: true, firstNoteAt, guideWhileSinging: guideOn, noteRange: range },
          analysis,
          practiceId,
        },
        toWav(pcm, sampleRate),
      );
      setPhase('ready');
      onTake(take);
    } catch (e) {
      console.error(e);
      setError('Something went wrong while listening. Your take wasn’t saved. Please try again.');
      setPhase('error');
      rec.current?.close();
      rec.current = null;
    } finally {
      finishing.current = false;
    }
  };

  const busy = phase !== 'ready' && phase !== 'error';
  const words = range ? [lineText(song, range)] : section.lines;
  const status =
    phase === 'opening'
      ? 'Opening your microphone…'
      : phase === 'note'
        ? 'Your first note. Hum it quietly if you like.'
        : phase === 'count'
          ? 'Get ready…'
          : phase === 'singing'
            ? 'Sing. Tap Done when you’ve finished.'
            : phase === 'listening'
              ? 'Listening back…'
              : hearing != null
                ? 'This is how it goes.'
                : '';

  return (
    <div className="sing-stage">
      <div className="sing-words">
        {label && <div className="kicker">{label}</div>}
        <div className="lyrics mt8" aria-live="polite">
          {words.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </div>
      </div>

      <div className="sing-main">
        <div className="sing-emblem">
          <Emblem gesture={phase === 'singing' ? song.gesture : phase === 'count' || phase === 'note' ? 'lips' : 'frame'} level={level} size="100%" />
        </div>
        <div className="sing-controls">
          <div className="beats" aria-hidden>
            {phase === 'count' && clicks.map((_, i) => <span key={i} className={i <= beat ? 'on' : ''} />)}
          </div>
          {phase === 'singing' || phase === 'count' || phase === 'note' ? (
            <button className="sing-btn stop" onClick={finish} disabled={phase !== 'singing'}>
              Done
            </button>
          ) : (
            <button className="sing-btn" onClick={start} disabled={phase === 'opening' || phase === 'listening'}>
              {phase === 'listening' ? '…' : 'Sing'}
            </button>
          )}
          <div className="status-line" role="status">
            {status}
          </div>
          {phase === 'singing' && (
            <div className="mic-meter" aria-hidden>
              <i style={{ width: `${Math.round(level * 100)}%` }} />
            </div>
          )}
          {phase === 'error' && error && (
            <div className="notice" role="alert" style={{ textAlign: 'left', maxWidth: 360 }}>
              {error}
            </div>
          )}
          {phase === 'ready' && <div className="tiny">Your voice stays on this device.</div>}
        </div>
      </div>

      <div className="sing-tools">
        <MelodyLine section={section} shift={shift} height={110} cursor={hearing} />
        <div className="row mt16">
          <button className="btn small" onClick={hear} disabled={busy}>
            {hearing != null ? 'Stop' : 'Hear how it goes'}
          </button>
          {onShift && (
            <span className="row" style={{ gap: 4 }}>
              <span className="small">Too high or low?</span>
              <button className="btn quiet small" onClick={() => onShift(shift - 1)} disabled={busy} aria-label="Lower the key by a semitone">
                Lower
              </button>
              <button className="btn quiet small" onClick={() => onShift(shift + 1)} disabled={busy} aria-label="Raise the key by a semitone">
                Higher
              </button>
            </span>
          )}
        </div>
        <label className="row mt8 small" style={{ gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={guideOn} disabled={busy} onChange={(e) => setSettings({ guideWhileSinging: e.target.checked })} />
          Play the tune while I sing (use headphones)
        </label>
      </div>
    </div>
  );
}
