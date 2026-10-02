// Kayıt: localStorage, sürüm numaralı ve göç (migration) destekli.

import { CURRENT_SAVE_VERSION, newGameState, type GameState } from './state';

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export const SLOT_KEYS = ['auto', 'manual1', 'manual2', 'manual3'] as const;
export type SlotKey = (typeof SLOT_KEYS)[number];
const PREFIX = 'elonth.save.';

export interface SaveEnvelope {
  v: number;
  savedAt: number;
  summary: string;
  data: unknown;
}

/** Göçler: index i, sürüm i+1'den i+2'ye geçirir. */
const MIGRATIONS: ((d: any) => any)[] = [
  // v1 → v2: gathered ve respawns alanları eklendi, appraised alanı tarih tutuyor.
  (d) => {
    d.gathered ??= {};
    d.respawns ??= {};
    d.appraised ??= {};
    d.pendingDiscoveries ??= [];
    d.saveVersion = 2;
    return d;
  },
];

export function migrate(raw: any, fromVersion: number): GameState {
  let d = raw;
  for (let v = fromVersion; v < CURRENT_SAVE_VERSION; v++) {
    const m = MIGRATIONS[v - 1];
    if (!m) throw new Error(`Göç bulunamadı: v${v}`);
    d = m(d);
  }
  // Eksik alanları yeni oyundan tamamla (ileriye dönük güvenlik).
  const base = newGameState() as any;
  for (const k of Object.keys(base)) if (d[k] === undefined) d[k] = base[k];
  d.saveVersion = CURRENT_SAVE_VERSION;
  return d as GameState;
}

export function summaryOf(s: GameState): string {
  return `Joseph · Lv${s.player.level} · ${s.time.day}. gün`;
}

export function writeSave(storage: StorageLike, slot: SlotKey, s: GameState): void {
  s.savedAt = Date.now();
  const env: SaveEnvelope = { v: CURRENT_SAVE_VERSION, savedAt: s.savedAt, summary: summaryOf(s), data: s };
  storage.setItem(PREFIX + slot, JSON.stringify(env));
}

export function readSave(storage: StorageLike, slot: SlotKey): GameState | null {
  const raw = storage.getItem(PREFIX + slot);
  if (!raw) return null;
  try {
    const env = JSON.parse(raw) as SaveEnvelope;
    if (typeof env.v !== 'number') return null;
    if (env.v > CURRENT_SAVE_VERSION) return null; // gelecekten gelen kayıt
    return migrate(env.data, env.v);
  } catch {
    return null;
  }
}

export function slotInfo(storage: StorageLike, slot: SlotKey): { savedAt: number; summary: string } | null {
  const raw = storage.getItem(PREFIX + slot);
  if (!raw) return null;
  try {
    const env = JSON.parse(raw) as SaveEnvelope;
    return { savedAt: env.savedAt, summary: env.summary };
  } catch {
    return null;
  }
}

/** En son kaydedilen slot (Devam için). */
export function latestSlot(storage: StorageLike): SlotKey | null {
  let best: SlotKey | null = null;
  let t = -1;
  for (const k of SLOT_KEYS) {
    const i = slotInfo(storage, k);
    if (i && i.savedAt > t) {
      t = i.savedAt;
      best = k;
    }
  }
  return best;
}

export function deleteSave(storage: StorageLike, slot: SlotKey) {
  storage.removeItem(PREFIX + slot);
}

export class MemoryStorage implements StorageLike {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}
