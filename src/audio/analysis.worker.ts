/// <reference lib="webworker" />
// Runs the listening engine off the main thread.
import { analyzeTake, type AnalyzeOptions } from '../analysis';

self.onmessage = (e: MessageEvent<{ id: number; pcm: Float32Array; sampleRate: number; opts: AnalyzeOptions }>) => {
  const { id, pcm, sampleRate, opts } = e.data;
  try {
    const result = analyzeTake(pcm, sampleRate, opts);
    (self as unknown as Worker).postMessage({ id, result });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
