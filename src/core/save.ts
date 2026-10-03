// Kayıt: localStorage, sürüm numaralı ve göç (migration) destekli.

import { CURRENT_SAVE_VERSION, newGameState, OLD_WORLD_W, OLD_WORLD_H, V2_WORLD_W, V2_WORLD_H, type GameState } from './state';
import { newGuildState } from './guild';
import { newQuestLog, type QuestLog } from './quests';
import { questDef } from '../data/quests';

/** 0.3.0'daki dünya boyutu (worldgen.ts WORLD_W/H ile aynı olmalı; testle doğrulanır). */
export const NEW_WORLD_W = 169;
export const NEW_WORLD_H = 120;
/** Orman (köprünün batısı) 0.3.0'da aynı koordinatlarda kaldı; köy yeniden yerleşti. */
export const FOREST_MAX_X = 56;

/** Bit dizisi olarak saklanan sis haritasını yeni genişliğe taşır (eski kareler aynı koordinatta kalır). */
export function remapFog(b64: string, oldW: number, oldH: number, newW: number, newH: number, maxX = Infinity): string {
  const bin = atob(b64);
  const out = new Uint8Array(Math.ceil((newW * newH) / 8));
  for (let y = 0; y < Math.min(oldH, newH); y++)
    for (let x = 0; x < Math.min(oldW, newW, maxX); x++) {
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
  // v3 → v4 (0.3.0): köy küçüldü (sis: yalnızca orman korunur, köy konumları meydana taşınır),
  // Bertram'ın işi 3 güne indi, görev sistemi, lonca puanı, giriş kartları, uyku saati, yoldaşlar.
  (d) => migrateV3toV4(d),
];

/** 0.2.0 kaydını 0.3.0'a taşır (testli: tests/save.test.ts). */
export function migrateV3toV4(d: any): any {
  d.flags ??= {};
  d.counters ??= {};
  const f = d.flags;
  // --- harita: orman aynı, köy yeni yerleşimde
  if (d.fog?.world) {
    try {
      d.fog.world = remapFog(d.fog.world, V2_WORLD_W, V2_WORLD_H, NEW_WORLD_W, NEW_WORLD_H, FOREST_MAX_X);
    } catch {
      delete d.fog.world;
    }
  }
  const PLAZA = { x: 84, y: 62 };
  if (d.pos?.map === 'world' && (d.pos.x >= FOREST_MAX_X || d.pos.y >= NEW_WORLD_H)) d.pos = { ...d.pos, x: PLAZA.x, y: PLAZA.y };
  if (d.spawn?.map === 'world' && d.spawn.x && (d.spawn.x >= FOREST_MAX_X || d.spawn.y >= NEW_WORLD_H)) d.spawn = { map: 'world', x: PLAZA.x, y: PLAZA.y };
  // köy içindeki yeniden doğma ve toplama kayıtları geçersiz (koordinatlar değişti)
  d.respawns = Object.fromEntries(Object.entries(d.respawns ?? {}).filter(([k]) => !/^rat5|^rabbit[356]/.test(k)));
  d.gathered = Object.fromEntries(Object.entries(d.gathered ?? {}).filter(([k]) => k.startsWith('herb')));
  // --- Bertram'ın işi: 4 vardiya → 3 vardiya. Son vardiyayı (ödeme) kaçırmasın: 3/4 bitirdiyse 2/3 sayılır.
  const work = d.counters.workDays ?? 0;
  if (!f.bertram_done && f.bertram_deal) d.counters.workDays = Math.min(work, 2);
  // --- yeni alanlar
  d.guild ??= newGuildState();
  if (f.guild_registered) {
    d.guild.member = true;
    d.player.guildRank ??= 0;
  }
  d.cards ??= [];
  d.party ??= [];
  d.board ??= { day: 0, ids: [] };
  d.awakeSince ??= ((d.time?.day ?? 1) - 1) * 1440 + (d.time?.minute ?? 420);
  // --- görev günlüğü: bayraklardan hikâyenin neresinde olduğunu çıkar
  d.quests = questsFromFlags(f, d.counters, d.time?.day ?? 1, d.player);
  // 0.2.0'daki bitiş kartı kaldırıldı: hikâye Bölüm II ile sürüyor
  if (f.ending_shown || f.guild_registered) {
    f.ch2_start_day = d.time?.day ?? 1;
    delete f.ending_shown;
  }
  d.saveVersion = 4;
  return d;
}

/** Bayraklardan görev günlüğü kurar (0.2.0 → 0.3.0). */
export function questsFromFlags(f: Record<string, any>, counters: Record<string, number>, day: number, player?: any): QuestLog {
  const log = newQuestLog();
  const put = (id: string, status: 'active' | 'done', progress?: number[]) => {
    const def = questDef(id);
    if (!def) return;
    log.quests[id] = { id, status, progress: progress ?? def.objectives.map((o) => (status === 'done' ? o.count ?? 1 : 0)), startedDay: day, endedDay: status === 'done' ? day : undefined };
    log.order.push(id);
    if (status === 'active' && (!log.tracked || def.kind === 'main')) log.tracked = id;
  };
  if (!f.woke) return log;
  if (!f.inn_met) {
    put('m_inn', 'active');
    return log;
  }
  put('m_inn', 'done');
  if (!f.bertram_deal) return log;
  if (!f.bertram_done) {
    put('m_bertram', 'active', [Math.min(2, counters.workDays ?? 0)]);
    return log;
  }
  put('m_bertram', 'done');
  if (!f.farm_done) {
    put('m_harvest', 'active', [f.farm_offered ? 1 : 0, 0]);
    return log;
  }
  put('m_harvest', 'done');
  if (!f.guild_registered) {
    const money = player?.wallet ? player.wallet.bronze + player.wallet.silver * 100 + player.wallet.platinum * 10000 : 0;
    put('m_register', 'active', [money >= 100 ? 1 : 0, 0]);
    return log;
  }
  put('m_register', 'done');
  // Bölüm II başlangıcı: kayıttan sonraki sabah pano açılır, Bertram silah verir
  put('m_weapon', 'active');
  return log;
}

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
  return `Joseph · Level ${s.player.level} · ${s.time.day}. gün`;
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
