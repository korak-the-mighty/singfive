import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { getAudio } from '../data/store';
import type { Evidence } from '../types';

export const EVIDENCE_LABEL: Record<Evidence, string> = { heard: 'We heard', think: 'We think', unsure: 'Not sure yet' };
const TONE_LABEL = { better: 'Better', worse: 'Weaker', same: 'Still' } as const;

export function Tag({ kind }: { kind: Evidence | 'better' | 'worse' | 'same' }) {
  const label = kind in EVIDENCE_LABEL ? EVIDENCE_LABEL[kind as Evidence] : TONE_LABEL[kind as keyof typeof TONE_LABEL];
  return <span className={`tag ${kind}`}>{label}</span>;
}

export interface Line {
  text: string;
  evidence: Evidence;
  tone?: string;
  proof?: string[];
  meta?: string;
}

export function NoteLines({ lines }: { lines: Line[] }) {
  if (!lines.length) return null;
  return (
    <ul className="note-list">
      {lines.map((l, i) => {
        const kind = l.tone === 'better' || l.tone === 'worse' || l.tone === 'same' ? l.tone : l.evidence;
        return (
          <li key={i}>
            <Tag kind={kind} />
            <div>
              {l.text}
              {l.meta && <div className="tiny">{l.meta}</div>}
              {l.proof && l.proof.length > 0 && (
                <details className="proof">
                  <summary>What we measured</summary>
                  <ul>
                    {l.proof.map((p, j) => (
                      <li key={j}>{p}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// One shared audio element so only one take plays at a time.
let current: HTMLAudioElement | null = null;
let currentId: string | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function stopPlayback() {
  if (current) {
    current.pause();
    current = null;
    currentId = null;
    notify();
  }
}

async function playTake(id: string) {
  stopPlayback();
  const blob = await getAudio(id);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = new Audio(url);
  current = a;
  currentId = id;
  a.onended = () => {
    URL.revokeObjectURL(url);
    if (current === a) {
      current = null;
      currentId = null;
      notify();
    }
  };
  notify();
  await a.play().catch(() => {
    current = null;
    currentId = null;
    notify();
  });
}

export function usePlaying(id: string | null): boolean {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return !!id && currentId === id;
}

export function PlayButton({ takeId, label }: { takeId: string; label?: string }) {
  const playing = usePlaying(takeId);
  return (
    <button
      className="play"
      aria-label={playing ? 'Stop' : label ?? 'Play this take'}
      title={playing ? 'Stop' : label ?? 'Play this take'}
      onClick={() => (playing ? stopPlayback() : playTake(takeId))}
    >
      {playing ? (
        <svg viewBox="0 0 16 16">
          <rect x="3" y="3" width="10" height="10" rx="1.5" fill="currentColor" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16">
          <path d="M4 2.5v11l9.5-5.5z" fill="currentColor" />
        </svg>
      )}
    </button>
  );
}

export function Back({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link href={to} className="btn quiet small" style={{ paddingLeft: 0 }}>
      ← {children}
    </Link>
  );
}

export function when(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Today, ${time}`;
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `Yesterday, ${time}`;
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + `, ${time}`;
}
