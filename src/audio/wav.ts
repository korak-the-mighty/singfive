import { resample } from '../analysis/resample';

/** Encode mono PCM as a 16-bit WAV blob, downsampled to save space. */
export function toWav(pcm: Float32Array, sampleRate: number, targetRate = 24000): Blob {
  const rate = sampleRate > targetRate ? targetRate : sampleRate;
  const x = rate === sampleRate ? pcm : resample(pcm, sampleRate, rate);
  const buf = new ArrayBuffer(44 + x.length * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, 'RIFF');
  v.setUint32(4, 36 + x.length * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, x.length * 2, true);
  for (let i = 0; i < x.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x[i])) * 32767, true);
  return new Blob([buf], { type: 'audio/wav' });
}
