/**
 * Preset Storage — two-tier persistence.
 *
 *   Factory presets:  embedded module (read-only via getFactoryPresets).
 *   User presets:     IndexedDB (full CRUD).
 *
 * In v1, IndexedDB is the only user store. When a backend arrives, swap
 * this adapter for an HTTP one — the Preset type and UI never change.
 */

import type { Preset, PresetData } from './preset';
import { cloneGroove } from './preset';

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

const DB_NAME = 'EuclideanGrooveLab';
const DB_VERSION = 1;
const STORE_NAME = 'userPresets';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('category', 'category', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---------------------------------------------------------------------------
// User preset CRUD
// ---------------------------------------------------------------------------

let idCounter = Date.now();
function generateId(): string {
  return `user-${(++idCounter).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function loadUserPresets(): Promise<Preset[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as Preset[]);
    request.onerror = () => reject(request.error);
  });
}

export async function saveUserPreset(data: PresetData): Promise<Preset> {
  const now = Date.now();
  const preset: Preset = {
    id: generateId(),
    kind: 'user',
    name: data.name,
    category: data.category,
    description: data.description,
    tags: data.tags,
    groove: cloneGroove(data.groove),
    createdAt: now,
    updatedAt: now,
  };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(preset);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  return preset;
}

export async function updateUserPreset(
  id: string,
  data: Partial<PresetData>,
): Promise<Preset | undefined> {
  const db = await openDb();
  const existing = await new Promise<Preset | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result as Preset | undefined);
    request.onerror = () => reject(request.error);
  });
  if (!existing) return undefined;
  const updated: Preset = {
    ...existing,
    ...data,
    groove: data.groove ? cloneGroove(data.groove) : existing.groove,
    updatedAt: Date.now(),
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(updated);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  return updated;
}

export async function deleteUserPreset(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function duplicateUserPreset(
  id: string,
  newName?: string,
): Promise<Preset | undefined> {
  const db = await openDb();
  const existing = await new Promise<Preset | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result as Preset | undefined);
    request.onerror = () => reject(request.error);
  });
  if (!existing) return undefined;
  const now = Date.now();
  const dup: Preset = {
    ...existing,
    id: generateId(),
    name: newName ?? `${existing.name} (copy)`,
    createdAt: now,
    updatedAt: now,
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(dup);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  return dup;
}
