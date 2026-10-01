// The FIVE emblem: the mouth is the constant (voice); the hand is the expression.

import { useEffect, useRef, useState } from 'react';
import type { GestureId } from '../../types';
import { CLOSED, GESTURES } from './gestures';
import { lerpPose, project, type HandPose, type Projected } from './rig';

const INK = 'var(--ink)';
const SKIN = 'var(--hand)';

function pathOf(pts: [number, number][], closed = false): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ') + (closed ? ' Z' : '');
}

/** Smooth closed curve through points (Catmull–Rom as cubic Béziers). */
function smoothClosed(pts: [number, number][]): string {
  const n = pts.length;
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + ' Z';
}

function Part({ part, line }: { part: Projected; line: number }) {
  if (part.kind === 'palm') {
    const d = smoothClosed(part.pts);
    const r = part.widths[0];
    return (
      <g>
        <path d={d} fill={INK} stroke={INK} strokeWidth={r * 2 + line * 2} strokeLinejoin="round" />
        <path d={d} fill={SKIN} stroke={SKIN} strokeWidth={r * 2} strokeLinejoin="round" />
      </g>
    );
  }
  if (part.kind === 'arm') {
    const d = pathOf(part.pts);
    return (
      <g>
        <path d={d} stroke={INK} strokeWidth={part.widths[0] + line * 2} strokeLinecap="butt" fill="none" />
        <path d={d} stroke={SKIN} strokeWidth={part.widths[0]} strokeLinecap="butt" fill="none" />
      </g>
    );
  }
  // Finger: outline pass for all segments, then fill pass, so joints stay seamless.
  const segs = part.pts.slice(1).map((p, i) => ({ d: pathOf([part.pts[i], p]), w: part.widths[i] }));
  return (
    <g>
      {segs.map((s, i) => (
        <path key={`o${i}`} d={s.d} stroke={INK} strokeWidth={s.w + line * 2} strokeLinecap="round" fill="none" />
      ))}
      {segs.map((s, i) => (
        <path key={`f${i}`} d={s.d} stroke={SKIN} strokeWidth={s.w} strokeLinecap="round" fill="none" />
      ))}
    </g>
  );
}

export function HandDrawing({ pose, line = 2.2 }: { pose: HandPose; line?: number }) {
  const parts = project(pose);
  return (
    <g className="hand">
      {parts.map((p) => (
        <Part key={p.name} part={p} line={line} />
      ))}
    </g>
  );
}

/** Lips. `open` 0…1 opens the mouth. */
export function Mouth({ open = 0, cx = 172, cy = 206, w = 218 }: { open?: number; cx?: number; cy?: number; w?: number }) {
  const h = w / 2;
  const o = Math.max(0, Math.min(1, open));
  const gapTop = -o * 16;
  const gapBottom = o * 40;
  const up = (x: number, y: number) => `${(cx + x).toFixed(1)} ${(cy + y).toFixed(1)}`;
  const upper = [
    `M${up(-h, 2)}`,
    `C${up(-h * 0.72, -8)} ${up(-h * 0.45, -40)} ${up(-h * 0.2, -38)}`,
    `C${up(-h * 0.1, -37)} ${up(-h * 0.04, -28)} ${up(0, -27)}`,
    `C${up(h * 0.04, -28)} ${up(h * 0.1, -37)} ${up(h * 0.2, -38)}`,
    `C${up(h * 0.45, -40)} ${up(h * 0.72, -8)} ${up(h, 2)}`,
    `C${up(h * 0.6, 2 + gapTop * 0.7)} ${up(h * 0.2, 8 + gapTop)} ${up(0, 6 + gapTop)}`,
    `C${up(-h * 0.2, 8 + gapTop)} ${up(-h * 0.6, 2 + gapTop * 0.7)} ${up(-h, 2)} Z`,
  ].join(' ');
  const lower = [
    `M${up(-h, 2)}`,
    `C${up(-h * 0.6, 4 + gapBottom * 0.7)} ${up(-h * 0.2, 8 + gapBottom)} ${up(0, 7 + gapBottom)}`,
    `C${up(h * 0.2, 8 + gapBottom)} ${up(h * 0.6, 4 + gapBottom * 0.7)} ${up(h, 2)}`,
    `C${up(h * 0.75, 30 + gapBottom * 0.8)} ${up(h * 0.35, 54 + gapBottom)} ${up(0, 54 + gapBottom)}`,
    `C${up(-h * 0.35, 54 + gapBottom)} ${up(-h * 0.75, 30 + gapBottom * 0.8)} ${up(-h, 2)} Z`,
  ].join(' ');
  const cavity =
    o > 0.02
      ? [
          `M${up(-h * 0.98, 2)}`,
          `C${up(-h * 0.6, 2 + gapTop * 0.7)} ${up(-h * 0.2, 8 + gapTop)} ${up(0, 6 + gapTop)}`,
          `C${up(h * 0.2, 8 + gapTop)} ${up(h * 0.6, 2 + gapTop * 0.7)} ${up(h * 0.98, 2)}`,
          `C${up(h * 0.6, 4 + gapBottom * 0.7)} ${up(h * 0.2, 8 + gapBottom)} ${up(0, 7 + gapBottom)}`,
          `C${up(-h * 0.2, 8 + gapBottom)} ${up(-h * 0.6, 4 + gapBottom * 0.7)} ${up(-h * 0.98, 2)} Z`,
        ].join(' ')
      : null;
  return (
    <g className="mouth">
      {cavity && <path d={cavity} fill="var(--mouth-inside)" />}
      <path d={upper} fill="var(--lips)" />
      <path d={lower} fill="var(--lips)" />
      <path
        d={`M${up(-h * 0.25, 30 + gapBottom * 0.95)} C${up(-h * 0.1, 36 + gapBottom)} ${up(h * 0.1, 36 + gapBottom)} ${up(h * 0.25, 30 + gapBottom * 0.95)}`}
        stroke="var(--lips-light)"
        strokeWidth={5}
        strokeLinecap="round"
        fill="none"
        opacity={0.55}
      />
    </g>
  );
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Mouth + hand. The hand eases between gestures; "sway" keeps moving;
 * "release" opens from a closed bunch. `level` (0…1) opens the mouth.
 */
export function Emblem({
  gesture,
  level = 0,
  size = 320,
  title,
  className,
  still = false,
}: {
  gesture: GestureId;
  level?: number;
  size?: number | string;
  title?: string;
  className?: string;
  still?: boolean;
}) {
  const target = GESTURES[gesture];
  const [pose, setPose] = useState<HandPose>(gesture === 'release' && !still ? CLOSED : target);
  const from = useRef(pose);
  const raf = useRef(0);

  useEffect(() => {
    if (still) {
      setPose(target);
      return;
    }
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = performance.now();
    const fromPose = from.current;
    const dur = reduce ? 1 : 750;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      let p = lerpPose(fromPose, target, ease(t));
      if (gesture === 'sway' && !reduce) {
        const s = Math.sin((now - start) / 900);
        p = { ...p, roll: p.roll + s * 9, x: p.x + s * 4 };
      }
      from.current = p;
      setPose(p);
      if (t < 1 || (gesture === 'sway' && !reduce)) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [gesture, target, still]);

  return (
    <svg
      viewBox="0 0 400 400"
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <Mouth open={0.08 + Math.min(1, level) * 0.9} />
      <HandDrawing pose={pose} line={typeof size === 'number' && size < 200 ? 3.6 : 2.3} />
    </svg>
  );
}
