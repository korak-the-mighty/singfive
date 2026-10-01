// What the coach currently understands about one of your five songs.

import type { Observation, Practice, Song, Take } from '../types';
import { compareTakes, type Comparison } from './compare';
import { gestureFor } from './gesture';
import { songUnderstanding } from './memory';
import { representativeTake } from './profile';

export interface SongState {
  takes: Take[];
  best: Take | null;
  last: Take | null;
  lastChange: Comparison | null;
  understanding: ReturnType<typeof songUnderstanding>;
  practice: Practice | null;
  gesture: ReturnType<typeof gestureFor>;
  line: string;
}

export function songState(song: Song, allTakes: Take[], observations: Observation[], practices: Practice[], bestId?: string): SongState {
  const takes = allTakes.filter((t) => t.songId === song.id && t.committed && (t.kind === 'first' || t.kind === 'again')).sort((a, b) => a.createdAt - b.createdAt);
  const matched = takes.filter((t) => t.analysis?.matched);
  const last = takes[takes.length - 1] ?? null;
  const best = representativeTake(song.id, allTakes.filter((t) => t.committed), bestId);
  let lastChange: Comparison | null = null;
  if (matched.length >= 2) {
    const a = matched[matched.length - 1];
    const b = matched[matched.length - 2];
    lastChange = compareTakes(song, a.analysis!, b.analysis!);
  }
  const understanding = songUnderstanding(observations, song.id);
  const practice = practices.filter((p) => p.songId === song.id && !p.doneAt).pop() ?? null;
  const gesture = gestureFor(song, best, lastChange?.verdict === 'better' && best?.id === last?.id);

  let line: string;
  if (!last) line = 'Not sung yet.';
  else if (!last.analysis?.matched) line = 'We couldn’t follow your last take. Try again with “Hear how it goes” first.';
  else if (lastChange && lastChange.verdict !== 'cant-tell') {
    const top = lastChange.changes[0];
    line =
      lastChange.verdict === 'better'
        ? `Last time: better. ${top?.text ?? ''}`
        : lastChange.verdict === 'same'
          ? `Last time: about the same.${understanding.difficulties[0] ? ` Still: ${lower(understanding.difficulties[0].text)}` : ''}`
          : lastChange.verdict === 'worse'
            ? `Last time: a weaker take. ${top?.text ?? ''}`
            : `Last time: some better, some worse. ${top?.text ?? ''}`;
  } else if (understanding.difficulties[0]) line = `Working on: ${lower(understanding.difficulties[0].text)}`;
  else if (understanding.strengths[0]) line = understanding.strengths[0].text;
  else line = 'Sing it again to see what changes.';
  return { takes, best, last, lastChange, understanding, practice, gesture, line };
}

function lower(s: string) {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}
