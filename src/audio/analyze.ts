import type { AnalyzeOptions } from '../analysis';
import { analyzeTake } from '../analysis';
import type { SongSection, TakeAnalysis } from '../types';

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (a: TakeAnalysis) => void; reject: (e: Error) => void }>();

function getWorker(): Worker | null {
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.error) p.reject(new Error(e.data.error));
      else p.resolve(e.data.result);
    };
    return worker;
  } catch {
    return null;
  }
}

/** Analyse a take in a background thread (falls back to the main thread). */
export function analyze(pcm: Float32Array, sampleRate: number, opts: AnalyzeOptions): Promise<TakeAnalysis> {
  const w = getWorker();
  if (!w) return Promise.resolve(analyzeTake(pcm, sampleRate, opts));
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, pcm, sampleRate, opts });
  });
}

/** A section cut down to a few notes, for practice. */
export function subSection(section: SongSection, range: [number, number]): SongSection {
  const notes = section.notes.slice(range[0], range[1] + 1);
  while (notes.length && notes[notes.length - 1].rest) notes.pop();
  const t0 = notes[0].start;
  return {
    ...section,
    pickupBeats: 0,
    notes: notes.map((n) => ({ ...n, start: n.start - t0 })),
  };
}
