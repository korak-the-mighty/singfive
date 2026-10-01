// Design review page for the hand gestures (development only).
import { Emblem } from '../components/hand/Emblem';
import { GESTURE_MEANING } from '../coach/gesture';
import type { GestureId } from '../types';

export function Gallery() {
  const ids = Object.keys(GESTURE_MEANING) as GestureId[];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: 16 }}>
      {ids.map((g) => (
        <figure key={g} style={{ margin: 0, textAlign: 'center' }}>
          <Emblem gesture={g} size="100%" still />
          <figcaption>{g} — {GESTURE_MEANING[g]}</figcaption>
        </figure>
      ))}
    </div>
  );
}
