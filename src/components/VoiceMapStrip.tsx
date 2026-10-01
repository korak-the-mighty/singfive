// Every note we've heard you sing, low to high. Darker = heard more often;
// green = in tune and steady there.

import { midiToName } from '../songs/notation';
import type { VoiceMap } from '../coach/voice';

export function VoiceMapStrip({ map }: { map: VoiceMap }) {
  if (!map.bins.length) return null;
  const lo = map.bins[0].midi - 1;
  const hi = map.bins[map.bins.length - 1].midi + 1;
  const n = hi - lo + 1;
  const max = Math.max(...map.bins.map((b) => b.n));
  const W = 800;
  const H = 120;
  const cw = W / n;
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="melody" role="img" aria-label="Notes heard across your songs">
        {map.steady && (
          <rect x={(map.steady.low - lo) * cw} y={0} width={(map.steady.high - map.steady.low + 1) * cw} height={H - 22} fill="var(--good-soft)" rx={8} />
        )}
        {map.bins.map((b) => {
          const h = 12 + (b.n / max) * (H - 50);
          const good = b.n >= 2 && b.meanOff <= 22 && (b.wander == null || b.wander <= 11);
          return (
            <rect
              key={b.midi}
              x={(b.midi - lo) * cw + cw * 0.18}
              y={H - 26 - h}
              width={cw * 0.64}
              height={h}
              rx={Math.min(6, cw * 0.3)}
              fill={good ? 'var(--good)' : 'var(--ink-3)'}
              opacity={0.35 + 0.65 * (b.n / max)}
            >
              <title>{`${midiToName(b.midi)}: ${b.n} notes, ${Math.round(b.meanOff)} cents off on average`}</title>
            </rect>
          );
        })}
        {Array.from({ length: n }, (_, i) => lo + i)
          .filter((m) => m % 12 === 0 || m % 12 === 7)
          .map((m) => (
            <text key={m} x={(m - lo) * cw + cw / 2} y={H - 8} textAnchor="middle">
              {midiToName(m)}
            </text>
          ))}
      </svg>
      <figcaption className="tiny">
        Every note we’ve heard you sing, low to high. Taller: heard more often. Green: in tune and steady.{map.steady ? ' The shaded band is where you’re steadiest.' : ''}
      </figcaption>
    </figure>
  );
}
