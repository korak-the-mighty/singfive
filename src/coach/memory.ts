// The coach accumulates evidence. A finding heard again is strengthened,
// a difficulty that stops showing up is marked as getting better, then gone.

import type { Observation } from '../types';
import type { Finding } from './findings';

export function mergeFindings(existing: Observation[], songId: string, findings: Finding[], now: number): Observation[] {
  const byKey = new Map(existing.map((o) => [o.key, { ...o }]));
  const seen = new Set<string>();
  for (const f of findings) {
    const key = `${songId}:${f.key}`;
    seen.add(key);
    const prev = byKey.get(key);
    if (prev) {
      byKey.set(key, {
        ...prev,
        text: f.text,
        proof: f.proof,
        evidence: f.evidence,
        lastSeen: now,
        timesSeen: prev.timesSeen + 1,
        status: 'open',
      });
    } else {
      byKey.set(key, {
        key,
        songId,
        evidence: f.evidence,
        text: f.text,
        proof: f.proof,
        firstSeen: now,
        lastSeen: now,
        timesSeen: 1,
        status: 'open',
        tone: f.tone,
      });
    }
  }
  for (const [key, o] of byKey) {
    if (o.songId !== songId || seen.has(key)) continue;
    if (o.status === 'open') byKey.set(key, { ...o, status: 'better' });
    else if (o.status === 'better') byKey.set(key, { ...o, status: 'gone' });
  }
  return [...byKey.values()];
}

/** The open understanding of one song: strongest first, difficulties ranked by how often we've heard them. */
export function songUnderstanding(obs: Observation[], songId: string) {
  const mine = obs.filter((o) => o.songId === songId);
  const open = mine.filter((o) => o.status === 'open' && !o.key.endsWith(':why'));
  return {
    strengths: open.filter((o) => o.tone === 'strength').sort((a, b) => b.timesSeen - a.timesSeen),
    difficulties: open.filter((o) => o.tone === 'difficulty').sort((a, b) => b.timesSeen - a.timesSeen),
    notes: open.filter((o) => o.tone === 'neutral'),
    improved: mine.filter((o) => o.tone === 'difficulty' && (o.status === 'better' || o.status === 'gone')),
  };
}
