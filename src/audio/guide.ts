// The guide: a soft, voice-like tone that plays the melody, the starting note,
// and a gentle count-in. Synthesised on the fly; nothing is downloaded.

import type { SongSection } from '../types';
import { midiToHz } from '../analysis/yin';
import { countInClicks, countInSeconds } from '../songs/traits';

let shared: AudioContext | null = null;
export function guideContext(): AudioContext {
  if (!shared || shared.state === 'closed') shared = new AudioContext({ latencyHint: 'interactive' });
  return shared;
}

export interface Scheduled {
  stop(): void;
  /** Seconds (AudioContext time) when the first melody note starts. */
  firstNoteTime: number;
  endTime: number;
}

function tone(ctx: AudioContext, out: AudioNode, midi: number, when: number, dur: number, gain = 0.22) {
  const f = midiToHz(midi);
  const o1 = ctx.createOscillator();
  o1.type = 'triangle';
  o1.frequency.value = f;
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = f * 2;
  const g2 = ctx.createGain();
  g2.gain.value = 0.18;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = Math.min(2400, f * 5);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, when);
  env.gain.linearRampToValueAtTime(gain, when + 0.035);
  env.gain.setTargetAtTime(gain * 0.75, when + 0.06, 0.25);
  const end = when + Math.max(0.08, dur - 0.03);
  env.gain.setTargetAtTime(0, end, 0.035);
  o1.connect(lp);
  o2.connect(g2).connect(lp);
  lp.connect(env).connect(out);
  o1.start(when);
  o2.start(when);
  o1.stop(end + 0.3);
  o2.stop(end + 0.3);
  return [o1, o2];
}

function click(ctx: AudioContext, out: AudioNode, when: number, accent: boolean) {
  // Filtered noise: a soft "tick" with no pitch, so it can't be mistaken for singing.
  const len = Math.round(ctx.sampleRate * 0.03);
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len / 6));
  const src = ctx.createBufferSource();
  src.buffer = b;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = accent ? 2600 : 1900;
  bp.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.value = accent ? 0.9 : 0.55;
  src.connect(bp).connect(g).connect(out);
  src.start(when);
  return src;
}

export interface PlayOptions {
  /** Semitones from the reference key. */
  shift: number;
  /** Only these note indices (inclusive). */
  range?: [number, number];
  /** Play at this fraction of the written tempo. */
  tempo?: number;
}

/** Play the melody (or part of it). */
export function playMelody(ctx: AudioContext, section: SongSection, opts: PlayOptions, when = ctx.currentTime + 0.08): Scheduled {
  const out = ctx.createGain();
  out.connect(ctx.destination);
  const beat = 60 / (section.bpm * (opts.tempo ?? 1));
  const [a, b] = opts.range ?? [0, section.notes.length - 1];
  const notes = section.notes.slice(a, b + 1);
  const t0 = notes[0].start;
  const nodes: AudioScheduledSourceNode[] = [];
  let end = when;
  for (const n of notes) {
    if (n.rest) continue;
    const at = when + (n.start - t0) * beat;
    const dur = n.beats * beat;
    nodes.push(...tone(ctx, out, n.midi + opts.shift, at, dur));
    end = Math.max(end, at + dur);
  }
  return {
    firstNoteTime: when,
    endTime: end,
    stop() {
      out.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      setTimeout(() => {
        nodes.forEach((n) => {
          try {
            n.stop();
          } catch {
            /* already stopped */
          }
        });
        out.disconnect();
      }, 120);
    },
  };
}

/** The first note of the section, held, so you can find your starting pitch. */
export function playStartingNote(ctx: AudioContext, section: SongSection, shift: number, from = 0, when = ctx.currentTime + 0.05): Scheduled {
  const first = section.notes.slice(from).find((n) => !n.rest)!;
  const out = ctx.createGain();
  out.connect(ctx.destination);
  const nodes = tone(ctx, out, first.midi + shift, when, 1.1, 0.24);
  return {
    firstNoteTime: when,
    endTime: when + 1.15,
    stop() {
      out.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      nodes.forEach((n) => {
        try {
          n.stop(ctx.currentTime + 0.1);
        } catch {
          /* already stopped */
        }
      });
    },
  };
}

/** Count-in clicks; returns when the first sung note is due. */
export function playCountIn(ctx: AudioContext, section: SongSection, when = ctx.currentTime + 0.1): Scheduled {
  const out = ctx.createGain();
  out.connect(ctx.destination);
  const nodes = countInClicks(section).map((c) => click(ctx, out, when + c.t, c.accent));
  const first = when + countInSeconds(section);
  return {
    firstNoteTime: first,
    endTime: first,
    stop() {
      nodes.forEach((n) => {
        try {
          n.stop();
        } catch {
          /* already stopped */
        }
      });
    },
  };
}
