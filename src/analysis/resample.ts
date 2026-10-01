// Band-limited resampling: windowed-sinc low-pass, then linear interpolation.
// Good enough for pitch analysis of a singing voice (we keep everything below ~7 kHz).

export function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  let x = input;
  if (toRate < fromRate) {
    const cutoff = (0.45 * toRate) / fromRate; // normalised to fromRate
    const taps = 63;
    const half = (taps - 1) / 2;
    const h = new Float32Array(taps);
    let sum = 0;
    for (let i = 0; i < taps; i++) {
      const n = i - half;
      const sinc = n === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * n) / (Math.PI * n);
      const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (taps - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (taps - 1));
      h[i] = sinc * w;
      sum += h[i];
    }
    for (let i = 0; i < taps; i++) h[i] /= sum;
    const y = new Float32Array(input.length);
    for (let i = 0; i < input.length; i++) {
      let acc = 0;
      for (let k = 0; k < taps; k++) {
        const j = i + k - half;
        if (j >= 0 && j < input.length) acc += input[j] * h[k];
      }
      y[i] = acc;
    }
    x = y;
  }
  const ratio = fromRate / toRate;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const j = Math.floor(pos);
    const frac = pos - j;
    const a = x[j] ?? 0;
    const b = x[j + 1] ?? a;
    out[i] = a + (b - a) * frac;
  }
  return out;
}

/** Second-order Butterworth high-pass, to remove rumble and hum below the voice. */
export function highpass(x: Float32Array, rate: number, cutoff: number): Float32Array {
  const w0 = (2 * Math.PI * cutoff) / rate;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / Math.SQRT2;
  const a0 = 1 + alpha;
  const b0 = (1 + cos) / 2 / a0;
  const b1 = -(1 + cos) / a0;
  const b2 = (1 + cos) / 2 / a0;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha) / a0;
  const y = new Float32Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x[i];
    y2 = y1;
    y1 = v;
    y[i] = v;
  }
  return y;
}
