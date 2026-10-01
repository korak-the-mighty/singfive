// Optional AI layer. The local coach always writes the first draft from real
// measurements; if an AI coach is configured on the server and you've allowed
// it, the draft is rewritten in a warmer voice. Only text and numbers are
// sent, never audio. Any failure falls back to the local draft.

import type { SingerProfile } from '../types';
import type { TakeNote } from './takeNote';

let statusPromise: Promise<{ ai: boolean; model: string | null }> | null = null;

export function aiStatus(): Promise<{ ai: boolean; model: string | null }> {
  if (!statusPromise) {
    statusPromise = fetch('/api/coach/status')
      .then((r) => (r.ok ? r.json() : { ai: false, model: null }))
      .catch(() => ({ ai: false, model: null }));
  }
  return statusPromise;
}

interface Draft {
  headline: string;
  items: { id: string; text: string; evidence: 'heard' | 'think' | 'unsure' }[];
}

async function rewrite(task: 'take' | 'profile', draft: Draft, evidence: Record<string, unknown>, song?: { title: string; feel: string }) {
  const res = await fetch('/api/coach/rewrite', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ task, draft, evidence, song }),
  });
  if (!res.ok) throw new Error(`AI coach unavailable (${res.status})`);
  return (await res.json()) as { headline: string; items: { id: string; text: string }[] };
}

export async function polishProfile(p: SingerProfile, evidence: Record<string, unknown>): Promise<SingerProfile> {
  const items = p.sections.flatMap((s) => s.items.map((it, i) => ({ id: `${s.id}:${i}`, text: it.text, evidence: it.evidence })));
  const out = await rewrite('profile', { headline: p.headline, items }, evidence);
  const byId = new Map(out.items.map((i) => [i.id, i.text]));
  return {
    ...p,
    headline: out.headline,
    sections: p.sections.map((s) => ({ ...s, items: s.items.map((it, i) => ({ ...it, text: byId.get(`${s.id}:${i}`) ?? it.text })) })),
    source: 'ai',
    updatedAt: Date.now(),
  };
}

export async function polishTakeNote(n: TakeNote, song: { title: string; feel: string }, evidence: Record<string, unknown>): Promise<TakeNote> {
  if (n.problem) return n;
  const items = n.lines.map((l, i) => ({ id: String(i), text: l.text, evidence: l.evidence }));
  const out = await rewrite('take', { headline: n.headline, items }, evidence, song);
  return { ...n, headline: out.headline, lines: n.lines.map((l, i) => ({ ...l, text: out.items[i]?.text ?? l.text })) };
}
