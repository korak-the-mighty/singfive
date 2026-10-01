// YIN fundamental-frequency estimation (de Cheveigné & Kawahara, 2002),
// with parabolic interpolation for sub-sample precision.

export interface PitchFrames {
  sampleRate: number;
  hopSec: number;
  /** Fundamental frequency in Hz, 0 where no pitch was found. */
  f0: Float32Array;
  /** Periodicity, 1 − CMNDF minimum (1 = perfectly periodic). */
  clarity: Float32Array;
  /** Frame RMS level in dBFS. */
  db: Float32Array;
}

export interface YinOptions {
  fMin?: number;
  fMax?: number;
  hop?: number; // samples
  window?: number; // integration window, samples
  threshold?: number;
  /** Frames quieter than this (dBFS) are skipped as silence. */
  silenceDb?: number;
}

export function yin(signal: Float32Array, sampleRate: number, opts: YinOptions = {}): PitchFrames {
  const fMin = opts.fMin ?? 65;
  const fMax = opts.fMax ?? 1050;
  const hop = opts.hop ?? Math.round(sampleRate * 0.01);
  const W = opts.window ?? Math.round(sampleRate * 0.032);
  const threshold = opts.threshold ?? 0.15;
  const silenceDb = opts.silenceDb ?? -62;
  const tauMax = Math.min(Math.ceil(sampleRate / fMin), W);
  const tauMin = Math.max(2, Math.floor(sampleRate / fMax));
  const frameLen = W + tauMax + 2;
  const nFrames = Math.max(0, Math.floor((signal.length - frameLen) / hop) + 1);

  const f0 = new Float32Array(nFrames);
  const clarity = new Float32Array(nFrames);
  const db = new Float32Array(nFrames);
  const d = new Float64Array(tauMax + 2);
  const cmnd = new Float64Array(tauMax + 2);

  for (let fi = 0; fi < nFrames; fi++) {
    const off = fi * hop;
    // Level over the integration window.
    let e = 0;
    for (let j = 0; j < W; j++) {
      const v = signal[off + j];
      e += v * v;
    }
    const rms = Math.sqrt(e / W);
    const level = rms > 1e-9 ? 20 * Math.log10(rms) : -120;
    db[fi] = level;
    if (level < silenceDb) continue;

    // Difference function.
    for (let tau = 1; tau <= tauMax + 1; tau++) {
      let sum = 0;
      for (let j = 0; j < W; j++) {
        const diff = signal[off + j] - signal[off + j + tau];
        sum += diff * diff;
      }
      d[tau] = sum;
    }
    // Cumulative mean normalised difference.
    cmnd[0] = 1;
    let running = 0;
    for (let tau = 1; tau <= tauMax + 1; tau++) {
      running += d[tau];
      cmnd[tau] = running > 0 ? (d[tau] * tau) / running : 1;
    }
    // First dip under the threshold, then walk to its local minimum.
    let best = -1;
    for (let tau = tauMin; tau <= tauMax; tau++) {
      if (cmnd[tau] < threshold) {
        while (tau + 1 <= tauMax && cmnd[tau + 1] < cmnd[tau]) tau++;
        best = tau;
        break;
      }
    }
    if (best < 0) {
      // No clear dip: take the global minimum but report its (low) clarity.
      let m = Infinity;
      for (let tau = tauMin; tau <= tauMax; tau++) {
        if (cmnd[tau] < m) {
          m = cmnd[tau];
          best = tau;
        }
      }
    }
    // Parabolic interpolation around the minimum.
    let tauExact = best;
    if (best > tauMin && best < tauMax) {
      const a = cmnd[best - 1];
      const b = cmnd[best];
      const c = cmnd[best + 1];
      const denom = a - 2 * b + c;
      if (denom > 1e-12) tauExact = best + (0.5 * (a - c)) / denom;
    }
    f0[fi] = sampleRate / tauExact;
    clarity[fi] = Math.max(0, 1 - cmnd[best]);
  }

  return { sampleRate, hopSec: hop / sampleRate, f0, clarity, db };
}

export const hzToMidi = (hz: number) => 69 + 12 * Math.log2(hz / 440);
export const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
