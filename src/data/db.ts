// Local, private storage. Everything FIVE knows about you lives in this
// browser's IndexedDB: your takes (audio), their analysis and the coach's notes.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { FiveEvent, FiveSlot, Observation, Practice, Take } from '../types';

interface FiveDB extends DBSchema {
  kv: { key: string; value: unknown };
  slots: { key: string; value: FiveSlot };
  takes: { key: string; value: Take };
  audio: { key: string; value: Blob };
  observations: { key: string; value: Observation };
  practices: { key: string; value: Practice };
  events: { key: string; value: FiveEvent };
}

let dbp: Promise<IDBPDatabase<FiveDB>> | null = null;

export function db(): Promise<IDBPDatabase<FiveDB>> {
  if (!dbp) {
    dbp = openDB<FiveDB>('five', 1, {
      upgrade(d) {
        d.createObjectStore('kv');
        d.createObjectStore('slots', { keyPath: 'id' });
        d.createObjectStore('takes', { keyPath: 'id' });
        d.createObjectStore('audio');
        d.createObjectStore('observations', { keyPath: 'key' });
        d.createObjectStore('practices', { keyPath: 'id' });
        d.createObjectStore('events', { keyPath: 'id' });
      },
    });
  }
  return dbp;
}

export async function wipe(): Promise<void> {
  const d = await db();
  const names = ['kv', 'slots', 'takes', 'audio', 'observations', 'practices', 'events'] as const;
  const tx = d.transaction(names, 'readwrite');
  await Promise.all(names.map((n) => tx.objectStore(n).clear()));
  await tx.done;
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
