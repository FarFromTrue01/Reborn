// Kayıt: localStorage, sürüm numaralı ve göç (migration) destekli.

import { CURRENT_SAVE_VERSION, newGameState, OLD_WORLD_W, OLD_WORLD_H, type GameState } from './state';

/** 0.2.0'daki dünya boyutu (worldgen.ts WORLD_W/H ile aynı olmalı; testle doğrulanır). */
export const NEW_WORLD_W = 230;
export const NEW_WORLD_H = 150;

/** Bit dizisi olarak saklanan sis haritasını yeni genişliğe taşır (eski kareler aynı koordinatta kalır). */
export function remapFog(b64: string, oldW: number, oldH: number, newW: number, newH: number): string {
  const bin = atob(b64);
  const out = new Uint8Array(Math.ceil((newW * newH) / 8));
  for (let y = 0; y < Math.min(oldH, newH); y++)
    for (let x = 0; x < Math.min(oldW, newW); x++) {
      const i = y * oldW + x;
      if ((bin.charCodeAt(i >> 3) >> (i & 7)) & 1) {
        const j = y * newW + x;
        out[j >> 3] |= 1 << (j & 7);
      }
    }
  let s = '';
  for (let i = 0; i < out.length; i++) s += String.fromCharCode(out[i]);
  return btoa(s);
}

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
  // v2 → v3 (0.2.0): köy büyüdü (sis haritası yeni genişliğe), Bertram'ın işi 4 güne bölündü, hızlı yemek.
  (d) => {
    if (d.fog?.world) {
      try {
        d.fog.world = remapFog(d.fog.world, OLD_WORLD_W, OLD_WORLD_H, NEW_WORLD_W, NEW_WORLD_H);
      } catch {
        delete d.fog.world;
      }
    }
    d.quickFood ??= null;
    d.flags ??= {};
    d.counters ??= {};
    // Eski sistemde lonca kaydını tamamlamış oyuncular yeni işleri bitirmiş sayılır.
    if (d.flags.guild_registered || (d.counters.workDays ?? 0) >= 4) {
      d.flags.bertram_done = true;
      d.flags.farm_done = true;
    }
    d.saveVersion = 3;
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
