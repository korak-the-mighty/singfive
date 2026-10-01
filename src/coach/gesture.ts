// Each of YOUR FIVE SONGS has a hand gesture. Before you sing it, the gesture
// shows how the song feels. After, it shows how you sing it.

import type { GestureId, Song, Take } from '../types';
import { findingsForTake } from './findings';

export const GESTURE_MEANING: Record<GestureId, string> = {
  frame: 'Your five songs',
  open: 'Open',
  sway: 'Floating',
  mic: 'Performing',
  cup: 'Projecting',
  lips: 'Close and soft',
  pinch: 'Precise',
  cover: 'Holding back',
  push: 'Confident',
  release: 'Letting go',
  reach: 'Reaching',
  tight: 'Tight',
};

export function gestureFor(song: Song, take: Take | null, improved = false): { gesture: GestureId; why: string } {
  const a = take?.analysis;
  if (!a || !a.matched || !a.measures) return { gesture: song.gesture, why: song.feel };
  const m = a.measures;
  const keys = new Set(findingsForTake(song, a, take?.feeling).map((f) => f.key));
  if (improved) return { gesture: 'release', why: 'Letting go: your latest take is better than the one before.' };
  if (m.missedShare >= 0.2 || (keys.has('late-in') && a.quality.issues.includes('quiet')))
    return { gesture: 'cover', why: 'Holding back: notes go missing, as if part of you isn’t singing yet.' };
  if (keys.has('pushing')) return { gesture: 'tight', why: 'Tight: the top of this song gets forced.' };
  if (keys.has('high-flat') || keys.has('leaps-short') || keys.has('octave-switch'))
    return { gesture: 'reach', why: 'Reaching: the high notes are just beyond where you land them.' };
  if (keys.has('interval-miss')) return { gesture: 'reach', why: 'Reaching: one jump still lands short of its note.' };
  if (keys.has('long-waver') || keys.has('long-sag') || keys.has('drift-down') || keys.has('drift-up'))
    return { gesture: 'sway', why: 'Floating: the line moves, but the long notes aren’t anchored yet.' };
  if (keys.has('rushing') || keys.has('dragging') || keys.has('uneven-beat') || keys.has('late-in'))
    return { gesture: 'sway', why: 'Floating: the tune is there, the beat isn’t settled yet.' };
  if (keys.has('in-tune') && keys.has('long-steady')) {
    if (m.vibrato.present || (m.loudnessRangeDb ?? 0) >= 10) return { gesture: 'open', why: 'Open: in tune, steady, and free on the long notes.' };
    return { gesture: 'pinch', why: 'Precise: almost every note lands where it should.' };
  }
  if (keys.has('steady-beat') && (keys.has('clean-in') || m.entranceMs == null)) return { gesture: 'mic', why: 'Performing: on the beat and right on time.' };
  if (take?.feeling?.includes('like-me') && keys.has('in-tune')) return { gesture: 'push', why: 'Confident: it felt like you, and it sounded settled.' };
  if (keys.has('in-tune')) return { gesture: 'pinch', why: 'Precise: you’re in tune nearly all the way through.' };
  return { gesture: song.gesture, why: song.feel };
}
