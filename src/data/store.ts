import { create } from 'zustand';
import { aiStatus, polishProfile } from '../coach/ai';
import { findingsForTake } from '../coach/findings';
import { mergeFindings } from '../coach/memory';
import { practiceFromFinding } from '../coach/practice';
import { buildProfile } from '../coach/profile';
import { buildVoiceMap } from '../coach/voice';
import { findSong, getSong, SONGS } from '../songs/catalog';
import type { FiveEvent, FiveSlot, Observation, Practice, Settings, SingerProfile, Sixth, Song, Take } from '../types';
import { db, uid, wipe } from './db';

const DEFAULT_SETTINGS: Settings = { aiCoach: true, guideOctave: 0, guideWhileSinging: false };

export interface State {
  loaded: boolean;
  settings: Settings;
  slots: FiveSlot[];
  takes: Take[];
  observations: Observation[];
  practices: Practice[];
  events: FiveEvent[];
  profile: SingerProfile | null;
  firstFive: string[];
  sixth: Sixth | null;
  aiAvailable: boolean;
  profileBusy: boolean;

  init(): Promise<void>;
  chooseFive(songIds: string[]): Promise<void>;
  addTake(t: Omit<Take, 'id' | 'createdAt'>, audio: Blob): Promise<Take>;
  setFeeling(takeId: string, feeling: Take['feeling']): Promise<void>;
  commitTake(takeId: string): Promise<void>;
  deleteTake(takeId: string): Promise<void>;
  discardUncommitted(songId: string, keep: string): Promise<void>;
  setBest(songId: string, takeId: string): Promise<void>;
  setGuideShift(songId: string, shift: number): Promise<void>;
  replaceSlot(outSongId: string, inSongId: string, reasonOut: string, reasonIn: string): Promise<void>;
  addEvent(e: Omit<FiveEvent, 'id' | 'at'>): Promise<void>;
  completePractice(id: string, result: string): Promise<void>;
  refreshProfile(): Promise<void>;
  setSettings(s: Partial<Settings>): Promise<void>;
  setSixth(s: Sixth | null): Promise<void>;
  swapFirstFive(outId: string, inId: string): Promise<void>;
  resetAll(): Promise<void>;
}

export const activeSlots = (slots: FiveSlot[]) => slots.filter((s) => !s.removedAt).sort((a, b) => a.position - b.position);
export const fiveSongs = (slots: FiveSlot[]): Song[] => activeSlots(slots).map((s) => getSong(s.songId));
export const songTakes = (takes: Take[], songId: string) => takes.filter((t) => t.songId === songId).sort((a, b) => a.createdAt - b.createdAt);
export const bestIds = (slots: FiveSlot[]) => Object.fromEntries(slots.map((s) => [s.songId, s.bestTakeId]));

export const useStore = create<State>((set, get) => ({
  loaded: false,
  settings: DEFAULT_SETTINGS,
  slots: [],
  takes: [],
  observations: [],
  practices: [],
  events: [],
  profile: null,
  firstFive: [],
  sixth: null,
  aiAvailable: false,
  profileBusy: false,

  async init() {
    const d = await db();
    const [slots, takes, observations, practices, events, settings, profile, firstFive, sixth] = await Promise.all([
      d.getAll('slots'),
      d.getAll('takes'),
      d.getAll('observations'),
      d.getAll('practices'),
      d.getAll('events'),
      d.get('kv', 'settings'),
      d.get('kv', 'profile'),
      d.get('kv', 'firstFive'),
      d.get('kv', 'sixth'),
    ]);
    set({
      loaded: true,
      slots,
      takes: takes.sort((a, b) => a.createdAt - b.createdAt),
      observations,
      practices: practices.sort((a, b) => a.createdAt - b.createdAt),
      events: events.sort((a, b) => a.at - b.at),
      settings: { ...DEFAULT_SETTINGS, ...((settings as Settings) ?? {}) },
      profile: (profile as SingerProfile) ?? null,
      firstFive: (firstFive as string[]) ?? [],
      sixth: (sixth as Sixth) ?? null,
    });
    aiStatus().then((s) => set({ aiAvailable: s.ai }));
  },

  async chooseFive(songIds) {
    const d = await db();
    const now = Date.now();
    // Starting over: retire any current slots (history is kept).
    for (const s of activeSlots(get().slots)) await d.put('slots', { ...s, removedAt: now, reasonOut: 'Chose a new five.' });
    const slots: FiveSlot[] = songIds.map((songId, position) => ({
      id: uid(),
      songId,
      position,
      addedAt: now,
      reasonIn: 'One of the five songs you believed you could sing.',
    }));
    for (const s of slots) await d.put('slots', s);
    await d.put('kv', songIds, 'firstFive');
    const ev: FiveEvent = { id: uid(), at: now, type: 'chose-five', text: 'You chose your first five songs.', songIds };
    await d.put('events', ev);
    set({ slots: [...(await d.getAll('slots'))], firstFive: songIds, events: [...get().events, ev] });
  },

  async addTake(t, audio) {
    const d = await db();
    const take: Take = { ...t, id: uid(), createdAt: Date.now() };
    await d.put('audio', audio, take.id);
    await d.put('takes', take);
    set({ takes: [...get().takes, take] });
    return take;
  },

  async setFeeling(takeId, feeling) {
    const d = await db();
    const t = get().takes.find((x) => x.id === takeId);
    if (!t) return;
    const nt = { ...t, feeling };
    await d.put('takes', nt);
    set({ takes: get().takes.map((x) => (x.id === takeId ? nt : x)) });
  },

  async commitTake(takeId) {
    const d = await db();
    const t = get().takes.find((x) => x.id === takeId);
    if (!t || t.committed) return;
    const nt: Take = { ...t, committed: true };
    await d.put('takes', nt);
    let observations = get().observations;
    let practices = get().practices;
    const song = findSong(t.songId);
    if (song && t.analysis?.matched && (t.kind === 'first' || t.kind === 'again')) {
      const findings = findingsForTake(song, t.analysis, t.feeling);
      observations = mergeFindings(observations, song.id, findings, Date.now());
      for (const o of observations.filter((o) => o.songId === song.id)) await d.put('observations', o);
      // One open practice per song, built from the most important difficulty.
      // A practice retires once the thing it was for stops showing up.
      const keys = new Set(findings.map((f) => f.key));
      let open = practices.find((p) => p.songId === song.id && !p.doneAt);
      const top = findings.find((f) => f.tone === 'difficulty' && f.focus);
      if (open && (!open.findingKey || !keys.has(open.findingKey) || (top && top.key !== open.findingKey))) {
        const gone = !open.findingKey || !keys.has(open.findingKey);
        const closed = { ...open, doneAt: Date.now(), result: open.result ?? (gone ? 'Not needed now: it didn’t show up in your last take.' : 'Replaced by a newer focus.') };
        await d.put('practices', closed);
        practices = practices.map((x) => (x.id === closed.id ? closed : x));
        open = undefined;
      }
      if (!open && top) {
        const p = practiceFromFinding(song, top, uid(), Date.now());
        if (p) {
          await d.put('practices', p);
          practices = [...practices, p];
        }
      }
    }
    // Learn the key you actually sang in, so the starting note matches you next time.
    let slots = get().slots;
    const slot = activeSlots(slots).find((s) => s.songId === t.songId);
    if (slot && t.analysis?.matched && t.analysis.measures && t.kind !== 'practice') {
      const ns: FiveSlot = { ...slot, guideShift: Math.round(t.analysis.measures.keyShift), bestTakeId: slot.bestTakeId ?? t.id };
      await d.put('slots', ns);
      slots = slots.map((s) => (s.id === ns.id ? ns : s));
    }
    // First sing: the guide octave follows the singer's voice.
    if (t.analysis?.matched && t.analysis.measures && get().takes.filter((x) => x.committed).length === 0) {
      await get().setSettings({ guideOctave: t.analysis.measures.keyShift < -6 ? -1 : 0 });
    }
    set({ takes: get().takes.map((x) => (x.id === takeId ? nt : x)), observations, practices, slots });
  },

  async deleteTake(takeId) {
    const d = await db();
    await d.delete('takes', takeId);
    await d.delete('audio', takeId);
    const slots = get().slots;
    for (const s of slots.filter((s) => s.bestTakeId === takeId)) await d.put('slots', { ...s, bestTakeId: undefined });
    set({
      takes: get().takes.filter((t) => t.id !== takeId),
      slots: slots.map((s) => (s.bestTakeId === takeId ? { ...s, bestTakeId: undefined } : s)),
    });
  },

  async discardUncommitted(songId, keep) {
    for (const t of get().takes.filter((t) => t.songId === songId && !t.committed && t.id !== keep && t.kind === 'first')) {
      await get().deleteTake(t.id);
    }
  },

  async setBest(songId, takeId) {
    const d = await db();
    const slot = get().slots.find((s) => s.songId === songId && !s.removedAt);
    if (!slot) return;
    const ns = { ...slot, bestTakeId: takeId };
    await d.put('slots', ns);
    set({ slots: get().slots.map((s) => (s.id === ns.id ? ns : s)) });
  },

  async setGuideShift(songId, shift) {
    const d = await db();
    const slot = get().slots.find((s) => s.songId === songId && !s.removedAt);
    if (!slot) return;
    const ns = { ...slot, guideShift: shift };
    await d.put('slots', ns);
    set({ slots: get().slots.map((s) => (s.id === ns.id ? ns : s)) });
  },

  async replaceSlot(outSongId, inSongId, reasonOut, reasonIn) {
    const d = await db();
    const now = Date.now();
    const old = get().slots.find((s) => s.songId === outSongId && !s.removedAt);
    if (!old) return;
    const retired: FiveSlot = { ...old, removedAt: now, reasonOut };
    const audition = get()
      .takes.filter((t) => t.songId === inSongId && t.kind === 'audition' && t.analysis?.matched)
      .pop();
    const fresh: FiveSlot = {
      id: uid(),
      songId: inSongId,
      position: old.position,
      addedAt: now,
      reasonIn,
      bestTakeId: audition?.id,
      guideShift: audition?.analysis?.measures ? Math.round(audition.analysis.measures.keyShift) : undefined,
    };
    await d.put('slots', retired);
    await d.put('slots', fresh);
    const ev: FiveEvent = {
      id: uid(),
      at: now,
      type: 'replaced',
      text: `${getSong(inSongId).title} took the place of ${getSong(outSongId).title}.`,
      songIds: [outSongId, inSongId],
    };
    await d.put('events', ev);
    // The audition counts as the new song's first take.
    if (audition) {
      const t: Take = { ...audition, kind: 'first', committed: false };
      await d.put('takes', t);
      set({ takes: get().takes.map((x) => (x.id === t.id ? t : x)) });
      set({ slots: get().slots.map((s) => (s.id === old.id ? retired : s)).concat(fresh), events: [...get().events, ev] });
      await get().commitTake(t.id);
    } else {
      set({ slots: get().slots.map((s) => (s.id === old.id ? retired : s)).concat(fresh), events: [...get().events, ev] });
    }
    await get().refreshProfile();
  },

  async addEvent(e) {
    const d = await db();
    const ev: FiveEvent = { ...e, id: uid(), at: Date.now() };
    await d.put('events', ev);
    set({ events: [...get().events, ev] });
  },

  async completePractice(id, result) {
    const d = await db();
    const p = get().practices.find((x) => x.id === id);
    if (!p) return;
    const np = { ...p, result, doneAt: p.doneAt };
    await d.put('practices', np);
    set({ practices: get().practices.map((x) => (x.id === id ? np : x)) });
  },

  async refreshProfile() {
    const { slots, takes, firstFive } = get();
    const five = fiveSongs(slots);
    if (!five.length) return;
    const committed = takes.filter((t) => t.committed);
    let profile = buildProfile({
      five,
      firstFive: firstFive.map(getSong),
      takes: committed,
      bestTakeIds: bestIds(slots),
      candidates: SONGS.filter((s) => !five.some((f) => f.id === s.id)),
    });
    const prev = get().profile;
    if (prev) profile = { ...profile, createdAt: prev.createdAt };
    const d = await db();
    await d.put('kv', profile, 'profile');
    set({ profile });
    const { settings, aiAvailable } = get();
    if (settings.aiCoach && aiAvailable) {
      set({ profileBusy: true });
      try {
        const map = buildVoiceMap(committed);
        const evidence = {
          songs: five.map((s) => s.title),
          notesHeard: map.notesHeard,
          lowest: map.lowest,
          highest: map.highest,
          steady: map.steady,
        };
        const polished = await polishProfile(profile, evidence);
        await d.put('kv', polished, 'profile');
        set({ profile: polished });
      } catch {
        // Keep the local coach's profile.
      } finally {
        set({ profileBusy: false });
      }
    }
  },

  async setSettings(s) {
    const d = await db();
    const settings = { ...get().settings, ...s };
    await d.put('kv', settings, 'settings');
    set({ settings });
  },

  async setSixth(s) {
    const d = await db();
    if (s) await d.put('kv', s, 'sixth');
    else await d.delete('kv', 'sixth');
    set({ sixth: s });
  },

  async swapFirstFive(outId, inId) {
    const d = await db();
    const firstFive = get().firstFive.map((x) => (x === outId ? inId : x));
    await d.put('kv', firstFive, 'firstFive');
    set({ firstFive });
  },

  async resetAll() {
    await wipe();
    set({
      settings: DEFAULT_SETTINGS,
      slots: [],
      takes: [],
      observations: [],
      practices: [],
      events: [],
      profile: null,
      firstFive: [],
      sixth: null,
    });
  },
}));

export async function getAudio(takeId: string): Promise<Blob | undefined> {
  return (await db()).get('audio', takeId);
}
