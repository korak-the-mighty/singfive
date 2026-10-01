// A small 3D rig for a left hand, projected flat for drawing.
//
// Hand space: origin at the wrist, +y along the hand toward the fingers,
// +z out of the palm. With the palm facing the viewer and the fingers up,
// the thumb of a left hand points toward the singer's face: −x on screen.

export interface FingerPose {
  spread: number; // degrees, + toward the thumb
  curl: [number, number, number]; // degrees at the three joints, + toward the palm
}

export interface ThumbPose {
  spread: number; // degrees away from the index finger
  opposition: number; // 0 = flat beside the palm, 1 = across in front of it
  curl: [number, number, number];
}

export interface HandPose {
  x: number; // wrist position in the 400×400 emblem space
  y: number;
  scale: number;
  roll: number; // degrees, in the picture plane (+ = counter-clockwise)
  yaw: number; // degrees, 0 = palm to viewer, 180 = back of hand
  pitch: number; // degrees, + = fingertips toward the viewer
  index: FingerPose;
  middle: FingerPose;
  ring: FingerPose;
  pinky: FingerPose;
  thumb: ThumbPose;
  /** Length of forearm to draw (0 = none). */
  arm: number;
}

type V3 = [number, number, number];

const rad = (d: number) => (d * Math.PI) / 180;
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

interface FingerSpec {
  base: V3;
  lengths: [number, number, number];
  widths: [number, number, number];
}

const FINGERS: Record<'index' | 'middle' | 'ring' | 'pinky', FingerSpec> = {
  index: { base: [-21, 83, 0], lengths: [38, 24, 19], widths: [21, 19.5, 17.5] },
  middle: { base: [-4.5, 87, 0], lengths: [42, 27, 20], widths: [21.5, 20, 18] },
  ring: { base: [11, 84, 0], lengths: [39, 25, 19], widths: [20.5, 19, 17] },
  pinky: { base: [25, 76, 0], lengths: [30, 19, 16], widths: [17.5, 16.5, 15] },
};
const THUMB = { base: [-19, 26, 5] as V3, lengths: [34, 28, 23] as [number, number, number], widths: [25, 20.5, 17.5] as [number, number, number] };

export const PALM: V3[] = [
  [22, 0, -1],
  [28, 30, 0],
  [30, 60, 0],
  [27, 77, 0],
  [12, 86, 0],
  [-5, 89, 0],
  [-21, 85, 0],
  [-29, 70, 0],
  [-33, 47, 1],
  [-29, 22, 2],
  [-21, 3, 0],
];

function fingerJoints(spec: FingerSpec, pose: FingerPose): V3[] {
  const s = rad(pose.spread);
  const d0: V3 = [-Math.sin(s), Math.cos(s), 0];
  const n: V3 = [0, 0, 1];
  const pts: V3[] = [spec.base];
  let angle = 0;
  let p = spec.base;
  for (let k = 0; k < 3; k++) {
    angle += rad(pose.curl[k]);
    const dir = add(mul(d0, Math.cos(angle)), mul(n, Math.sin(angle)));
    p = add(p, mul(dir, spec.lengths[k]));
    pts.push(p);
  }
  return pts;
}

function thumbJoints(pose: ThumbPose): V3[] {
  const s = rad(pose.spread);
  // Resting direction: up and out toward −x, lifted toward the palm side by opposition.
  const out: V3 = [-Math.sin(s), Math.cos(s), 0];
  const lift = rad(pose.opposition * 55);
  const t0 = norm(add(mul(out, Math.cos(lift)), [0, 0, Math.sin(lift)]));
  // Bending plane: between "toward the palm" and "across the palm".
  const across: V3 = [Math.cos(s), Math.sin(s), 0];
  const b = norm(add(mul([0, 0, 1], 1 - pose.opposition * 0.6), mul(across, 0.4 + pose.opposition * 0.6)));
  const pts: V3[] = [THUMB.base];
  let angle = 0;
  let p = THUMB.base;
  for (let k = 0; k < 3; k++) {
    angle += rad(pose.curl[k]);
    const dir = add(mul(t0, Math.cos(angle)), mul(b, Math.sin(angle)));
    p = add(p, mul(dir, THUMB.lengths[k]));
    pts.push(p);
  }
  return pts;
}

function rotate(p: V3, pose: HandPose): V3 {
  // Pitch about x, then yaw about y, then roll about z.
  const [px, py, pz] = p;
  const cp = Math.cos(rad(pose.pitch));
  const sp = Math.sin(rad(pose.pitch));
  // Pitch: + tilts fingertips (+y) toward the viewer (+z).
  const y1 = py * cp - pz * sp;
  const z1 = py * sp + pz * cp;
  const cy = Math.cos(rad(pose.yaw));
  const sy = Math.sin(rad(pose.yaw));
  const x2 = px * cy + z1 * sy;
  const z2 = -px * sy + z1 * cy;
  const cr = Math.cos(rad(pose.roll));
  const sr = Math.sin(rad(pose.roll));
  const x3 = x2 * cr - y1 * sr;
  const y3 = x2 * sr + y1 * cr;
  return [x3, y3, z2];
}

export interface Projected {
  kind: 'palm' | 'finger' | 'arm';
  name: string;
  pts: [number, number][];
  widths: number[];
  depth: number;
}

export function project(pose: HandPose): Projected[] {
  const toScreen = (p: V3): [number, number, number] => {
    const r = rotate(p, pose);
    return [pose.x + r[0] * pose.scale, pose.y - r[1] * pose.scale, r[2]];
  };
  const out: Projected[] = [];
  const meanZ = (ps: [number, number, number][]) => ps.reduce((s, p) => s + p[2], 0) / ps.length;

  const palm = PALM.map(toScreen);
  // The palm sits slightly behind the fingers so they read as attached in front.
  out.push({ kind: 'palm', name: 'palm', pts: palm.map((p) => [p[0], p[1]]), widths: [5 * pose.scale], depth: meanZ(palm) - 3 });

  if (pose.arm > 0) {
    const arm = [[0, 8, -2] as V3, [0, -pose.arm, -6] as V3].map(toScreen);
    out.push({ kind: 'arm', name: 'arm', pts: arm.map((p) => [p[0], p[1]]), widths: [44 * pose.scale, 50 * pose.scale], depth: -999 });
  }

  for (const name of ['index', 'middle', 'ring', 'pinky'] as const) {
    const spec = FINGERS[name];
    const j = fingerJoints(spec, pose[name]).map(toScreen);
    // Depth: weight toward the fingertip, which is what overlaps other parts.
    const depth = 0.3 * j[1][2] + 0.3 * j[2][2] + 0.4 * j[3][2];
    out.push({ kind: 'finger', name, pts: j.map((p) => [p[0], p[1]]), widths: spec.widths.map((w) => w * pose.scale), depth });
  }
  const t = thumbJoints(pose.thumb).map(toScreen);
  out.push({ kind: 'finger', name: 'thumb', pts: t.map((p) => [p[0], p[1]]), widths: THUMB.widths.map((w) => w * pose.scale), depth: 0.2 * t[1][2] + 0.3 * t[2][2] + 0.5 * t[3][2] + 1 });

  return out.sort((a, b) => a.depth - b.depth);
}

// --- Interpolation -----------------------------------------------------------

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lf = (a: FingerPose, b: FingerPose, t: number): FingerPose => ({
  spread: lerp(a.spread, b.spread, t),
  curl: [lerp(a.curl[0], b.curl[0], t), lerp(a.curl[1], b.curl[1], t), lerp(a.curl[2], b.curl[2], t)],
});

export function lerpPose(a: HandPose, b: HandPose, t: number): HandPose {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    scale: lerp(a.scale, b.scale, t),
    roll: lerp(a.roll, b.roll, t),
    yaw: lerp(a.yaw, b.yaw, t),
    pitch: lerp(a.pitch, b.pitch, t),
    index: lf(a.index, b.index, t),
    middle: lf(a.middle, b.middle, t),
    ring: lf(a.ring, b.ring, t),
    pinky: lf(a.pinky, b.pinky, t),
    thumb: {
      spread: lerp(a.thumb.spread, b.thumb.spread, t),
      opposition: lerp(a.thumb.opposition, b.thumb.opposition, t),
      curl: [lerp(a.thumb.curl[0], b.thumb.curl[0], t), lerp(a.thumb.curl[1], b.thumb.curl[1], t), lerp(a.thumb.curl[2], b.thumb.curl[2], t)],
    },
    arm: lerp(a.arm, b.arm, t),
  };
}
