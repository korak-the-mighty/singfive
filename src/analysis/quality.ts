import type { QualityIssue, TakeQuality } from '../types';
import type { VoiceTrack } from './track';

/** Is this recording good enough to say anything about the voice? */
export function checkQuality(pcm: Float32Array, track: VoiceTrack, minVoicedSec = 3): TakeQuality {
  let peak = 0;
  let clipped = 0;
  for (let i = 0; i < pcm.length; i++) {
    const a = Math.abs(pcm[i]);
    if (a > peak) peak = a;
    if (a >= 0.985) clipped++;
  }
  let voicedFrames = 0;
  for (let i = 0; i < track.midi.length; i++) if (!Number.isNaN(track.midi[i])) voicedFrames++;
  const voicedSec = voicedFrames * track.hopSec;
  const peakDb = peak > 0 ? 20 * Math.log10(peak) : -120;
  const issues: QualityIssue[] = [];
  if (voicedSec < Math.min(1, minVoicedSec * 0.5)) issues.push('no-voice');
  else if (voicedSec < minVoicedSec) issues.push('short');
  if (track.levelDb < -46) issues.push('quiet');
  if (clipped / Math.max(1, pcm.length) > 0.001) issues.push('clipping');
  if (voicedSec >= 1 && track.levelDb - track.noiseDb < 14) issues.push('noisy');
  return {
    ok: !issues.includes('no-voice') && !issues.includes('short'),
    issues,
    peakDb: Math.round(peakDb * 10) / 10,
    levelDb: Math.round(track.levelDb * 10) / 10,
    noiseDb: Math.round(track.noiseDb * 10) / 10,
    voicedSec: Math.round(voicedSec * 10) / 10,
  };
}
