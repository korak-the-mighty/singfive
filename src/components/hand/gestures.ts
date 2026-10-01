import type { GestureId } from '../../types';
import type { FingerPose, HandPose, ThumbPose } from './rig';

const f = (spread: number, a: number, b: number, c: number): FingerPose => ({ spread, curl: [a, b, c] });
const t = (spread: number, opposition: number, a: number, b: number, c: number): ThumbPose => ({ spread, opposition, curl: [a, b, c] });

const base: HandPose = {
  x: 300,
  y: 330,
  scale: 1,
  roll: 0,
  yaw: 0,
  pitch: 0,
  index: f(6, 6, 6, 4),
  middle: f(1, 6, 6, 4),
  ring: f(-4, 6, 6, 4),
  pinky: f(-10, 6, 6, 4),
  thumb: t(38, 0.15, 6, 8, 6),
  arm: 260,
};

const P = (p: Partial<HandPose>): HandPose => ({ ...base, ...p });

// The mouth sits at about (200, 210) in the 400×400 emblem.
export const GESTURES: Record<GestureId, HandPose> = {
  // Fingers framing the mouth — YOUR FIVE SONGS.
  frame: P({
    x: 338,
    y: 318,
    scale: 1.08,
    roll: 24,
    index: f(12, 4, 6, 4),
    middle: f(3, 3, 4, 3),
    ring: f(-6, 4, 5, 3),
    pinky: f(-16, 5, 5, 3),
    thumb: t(40, 0.08, 4, 6, 4),
  }),
  // Open palm — openness, release.
  open: P({
    x: 312,
    y: 338,
    scale: 1.05,
    roll: 12,
    pitch: -18,
    index: f(9, 10, 8, 4),
    middle: f(2, 8, 8, 4),
    ring: f(-6, 10, 8, 4),
    pinky: f(-14, 12, 8, 4),
    thumb: t(44, 0.1, 6, 6, 4),
  }),
  // Hand swaying — feeling, phrasing.
  sway: P({
    x: 305,
    y: 335,
    scale: 1.05,
    roll: -8,
    yaw: 35,
    index: f(5, 18, 18, 10),
    middle: f(1, 24, 20, 10),
    ring: f(-4, 30, 24, 12),
    pinky: f(-9, 36, 26, 14),
    thumb: t(30, 0.2, 10, 12, 10),
  }),
  // Invisible microphone grip — performance.
  mic: P({
    x: 188,
    y: 392,
    scale: 1.05,
    roll: -12,
    yaw: 18,
    pitch: -10,
    index: f(0, 62, 78, 38),
    middle: f(0, 66, 80, 38),
    ring: f(-1, 70, 80, 38),
    pinky: f(-2, 74, 80, 38),
    thumb: t(16, 0.65, 20, 24, 12),
  }),
  // Cupped hand — projection.
  cup: P({
    x: 312,
    y: 300,
    scale: 1.05,
    roll: 6,
    yaw: 70,
    index: f(1, 22, 18, 10),
    middle: f(0, 22, 18, 10),
    ring: f(-1, 22, 18, 10),
    pinky: f(-2, 22, 18, 10),
    thumb: t(18, 0.3, 14, 14, 8),
  }),
  // Fingers near the lips — intimacy, softness.
  lips: P({
    x: 236,
    y: 370,
    scale: 1.05,
    roll: 18,
    yaw: 150,
    index: f(2, 4, 6, 4),
    middle: f(0, 80, 90, 50),
    ring: f(-2, 85, 90, 50),
    pinky: f(-4, 90, 90, 50),
    thumb: t(15, 0.75, 30, 40, 20),
    arm: 260,
  }),
  // Pinched fingers — precision.
  pinch: P({
    x: 318,
    y: 322,
    scale: 1.05,
    roll: 14,
    yaw: 72,
    index: f(4, 38, 58, 38),
    middle: f(0, 12, 10, 6),
    ring: f(-5, 10, 8, 4),
    pinky: f(-10, 8, 6, 4),
    thumb: t(30, 0.55, 16, 18, 8),
  }),
  // Hand covering the mouth — hesitation, hiding.
  cover: P({
    x: 336,
    y: 232,
    scale: 1.2,
    roll: 92,
    yaw: 180,
    index: f(2, 8, 10, 6),
    middle: f(0, 8, 10, 6),
    ring: f(-2, 8, 10, 6),
    pinky: f(-4, 10, 10, 6),
    thumb: t(18, 0.3, 10, 10, 6),
    arm: 260,
  }),
  // Palm pushing outward — confidence.
  push: P({
    x: 300,
    y: 350,
    scale: 1.25,
    roll: -4,
    pitch: -12,
    index: f(2, -4, 0, 0),
    middle: f(0, -4, 0, 0),
    ring: f(-2, -4, 0, 0),
    pinky: f(-5, -2, 0, 0),
    thumb: t(32, 0.05, 2, 2, 2),
  }),
  // Fingers opening — release.
  release: P({
    x: 312,
    y: 332,
    scale: 1.08,
    roll: 20,
    pitch: -10,
    index: f(16, -6, 0, 0),
    middle: f(4, -6, 0, 0),
    ring: f(-9, -6, 0, 0),
    pinky: f(-22, -6, 0, 0),
    thumb: t(56, 0, -4, 0, 0),
  }),
  // Reaching up and out.
  reach: P({
    x: 318,
    y: 260,
    scale: 1.0,
    roll: 32,
    pitch: 10,
    index: f(9, 4, 4, 2),
    middle: f(2, 4, 4, 2),
    ring: f(-5, 6, 4, 2),
    pinky: f(-12, 8, 4, 2),
    thumb: t(45, 0.2, 4, 6, 2),
    arm: 260,
  }),
  // A closed, tense hand — tension.
  tight: P({
    x: 300,
    y: 345,
    scale: 1.05,
    roll: 4,
    yaw: 10,
    index: f(0, 90, 100, 60),
    middle: f(0, 92, 100, 60),
    ring: f(0, 95, 100, 60),
    pinky: f(0, 95, 100, 60),
    thumb: t(20, 0.85, 30, 40, 20),
  }),
};

/** A closed bunch the "release" gesture opens from. */
export const CLOSED: HandPose = {
  ...GESTURES.release,
  index: f(0, 40, 50, 30),
  middle: f(0, 42, 50, 30),
  ring: f(0, 44, 50, 30),
  pinky: f(0, 46, 50, 30),
  thumb: t(15, 0.8, 20, 25, 15),
};
