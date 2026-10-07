// Kayıt: localStorage, sürüm numaralı ve göç (migration) destekli.

import { CURRENT_SAVE_VERSION, newGameState, OLD_WORLD_W, OLD_WORLD_H, V2_WORLD_W, V2_WORLD_H, type GameState } from './state';
import { newGuildState } from './guild';
import { newQuestLog, startQuest, type QuestLog } from './quests';
import { questDef, rankupQuest } from '../data/quests';
import { BOARD_TEMPLATES } from '../data/sidequests';
import { STAT_POINTS_PER_LEVEL, zeroStats } from './formulas';
import { normalizeWallet, emptyWallet } from './money';
import { normalizeSkillExp, ownedTechniques, sanitizeSlots } from './skills';
import { SKILLS, REMOVED_TECHNIQUES } from '../data/skills';

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
  // v4 → v5 (0.4.0): level başına 6 stat puanı, normalize cüzdan.
  (d) => migrateV4toV5(d),
  // v5 → v6 (0.5.0): "kayıtlar yarın işlenir" kalktı; bekleyen terfi Terfi görevine dönüşür.
  (d) => migrateV5toV6(d),
  // v6 → v7 (0.6.0): İlk Kadeh'e "masaya otur" amacı eklendi (ilerleme dizileri tanımla eşitlenir); kayıttaki pano
  // ilanlarına yönlendirme (where) eklenir. Eksik ana görev ve bekleme adımları oyunda ensureMainQuest ile açılır.
  (d) => migrateV6toV7(d),
  // v7 → v8 (0.9.0): yeni skill sistemi — yetenek slotları, yeni EXP eşikleri, kaldırılan teknikler.
  (d) => migrateV7toV8(d),
  // v8 → v9 (0.10.0): 5 stat (puanlar yeniden dağıtılır), Bertram'ın işi 2 gün, Tokluk, Ansiklopedi, kitaplar…
  (d) => migrateV8toV9(d),
];

/** 0.10.0'da çıkarılan statlar (kayıttan temizlenir). */
const REMOVED_STATS = ['DEX', 'MNA'];

/**
 * 0.9.0 kaydını 0.10.0'a taşır (tests/g6.test.ts):
 * - B9: 7 stat → 5 stat. Oyuncunun dağıttığı puanlar sıfırlanır, `unspent = 4 × level`; DEX/MNA alanları silinir;
 *   bir kez "Stat sistemi değişti" bildirimi (`stat_reset_notice` bayrağı). HP/MP/dayanıklılık yüklenince yeni
 *   tavanlara kırpılır (G.invalidate).
 * - B12: Bertram'ın işi 3 → 2 vardiya: 1/3 → 1/2; 2/3 ya da üstü → iş bitmiş sayılır, ücret sahnesi bir sonraki
 *   Bertram konuşmasında oynar (`bertram_pay_pending`; ödeme bir kez).
 * - Görev ilerleme dizileri tanımla eşitlenir (0.10.0: "Hana Git"e Appraisal amacı eklendi).
 */
export function migrateV8toV9(d: any): any {
  d.flags ??= {};
  d.counters ??= {};
  const p = d.player;
  if (p) {
    const lv = p.level ?? 0;
    const spent = Object.values<number>(p.alloc ?? {}).reduce((a, b) => a + (b || 0), 0);
    p.alloc = zeroStats();
    p.unspent = STAT_POINTS_PER_LEVEL * lv;
    if (lv > 0 || spent > 0) d.flags.stat_reset_notice = true;
    for (const k of REMOVED_STATS) delete p.alloc[k];
  }
  // Bertram: 2 vardiya
  const f = d.flags;
  if (f.bertram_deal && !f.bertram_done) {
    const work = d.counters.workDays ?? 0;
    if (work >= 2) {
      d.counters.workDays = 2;
      f.bertram_pay_pending = true;
    }
    const st = d.quests?.quests?.m_bertram;
    if (st && st.status === 'active' && Array.isArray(st.progress)) st.progress[0] = Math.min(2, st.progress[0] ?? 0);
  }
  padQuestProgress(d.quests);
  d.saveVersion = 9;
  return d;
}

/** Kayıttaki görev ilerleme dizilerini tanımla eşitler (yeni eklenen amaçlar: bitmiş görevde dolu, aktifte 0). */
function padQuestProgress(log: any) {
  if (!log?.quests) return;
  for (const st of Object.values<any>(log.quests)) {
    const def = st.def ?? questDef(st.id);
    if (!def || !Array.isArray(st.progress)) continue;
    const n = def.objectives.length;
    while (st.progress.length < n) {
      const o = def.objectives[st.progress.length];
      st.progress.push(st.status === 'done' ? o.count ?? 1 : 0);
    }
    if (st.progress.length > n) st.progress.length = n;
  }
}

/**
 * 0.8.0 kaydını 0.9.0'a taşır (tests/g5b.test.ts):
 * - Yeni alanlar: skillSlots (ilk sıradaki aktif yetenek takılı gelir), onceADay.
 * - Birikmiş skill EXP'si yeni (daha düşük) eşiklere göre rütbe atlatır.
 * - Kaldırılan teknikler (Çift Ok, Alev Püskürtmesi, Alev Duvarı): bekleme süreleri ve slot kayıtları silinir.
 */
export function migrateV7toV8(d: any): any {
  const p = d.player;
  if (p?.skills) p.skills = p.skills.map((s: any) => (SKILLS[s.id] ? normalizeSkillExp({ id: s.id, rank: s.rank ?? 0, exp: s.exp ?? 0 }) : s));
  const owned = p?.skills ? ownedTechniques(p.skills.filter((s: any) => SKILLS[s.id])) : [];
  const prev = Array.isArray(d.skillSlots) ? d.skillSlots.filter((t: any) => t && !REMOVED_TECHNIQUES.includes(t)) : [];
  d.skillSlots = sanitizeSlots(prev.length ? prev : owned.slice(0, 1), owned);
  d.onceADay ??= {};
  d.gatheredAt ??= {};
  d.saveVersion = 8;
  return d;
}

/** 0.5.x kaydını 0.6.0'a taşır (tests/g4a.test.ts). */
export function migrateV6toV7(d: any): any {
  const log = d.quests;
  if (log?.quests) {
    for (const st of Object.values<any>(log.quests)) {
      // kayıttaki dinamik pano ilanı: şablondan yönlendirmeyi al
      const m = /^b\d+_(.+)$/.exec(st.id);
      if (st.def && m) {
        const t = BOARD_TEMPLATES.find((x) => x.key === m[1]);
        const fresh = t?.make(st.id).objectives;
        if (fresh) st.def.objectives.forEach((o: any, i: number) => { if (!o.where && fresh[i]?.where) o.where = fresh[i].where; });
      }
      const def = st.def ?? questDef(st.id);
      if (!def || !Array.isArray(st.progress)) continue;
      const n = def.objectives.length;
      while (st.progress.length < n) {
        const o = def.objectives[st.progress.length];
        st.progress.push(st.status === 'done' ? o.count ?? 1 : 0);
      }
      if (st.progress.length > n) st.progress.length = n;
    }
  }
  d.saveVersion = 7;
  return d;
}

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
  d.partyHp ??= {};
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

/**
 * v4 → v5 (0.4.0, denge): level başına stat puanı 4 → 6. Önceki levellerin farkı dağıtılmamış puan olarak verilir;
 * cüzdan normalize edilir (100 bronz → 1 gümüş …).
 */
export function migrateV4toV5(d: any): any {
  if (d.player) {
    // 0.4.0'daki kural (6 − 4); 0.10.0'da puanlar yeniden dağıtılır (migrateV8toV9)
    d.player.unspent = (d.player.unspent ?? 0) + (6 - 4) * (d.player.level ?? 0);
    if (d.player.wallet) d.player.wallet = normalizeWallet({ ...emptyWallet(), ...d.player.wallet });
  }
  d.saveVersion = 5;
  return d;
}

/**
 * v5 → v6 (0.5.0, arayüz): guild.pending (ertesi gün işlenecek terfi) kaldırıldı. Bekleyen terfi kaybolmasın:
 * Terfi görevine dönüştürülür; Celeste'yle konuşunca o anda işlenir.
 */
export function migrateV5toV6(d: any): any {
  const g = d.guild;
  if (g && 'pending' in g) {
    const p = g.pending;
    delete g.pending;
    const cur = d.player?.guildRank;
    if (p && typeof p.rank === 'number' && g.member && typeof cur === 'number' && p.rank > cur) {
      d.quests ??= newQuestLog();
      d.quests.order ??= [];
      startQuest(d.quests, rankupQuest(p.rank), d.time?.day ?? 1, true);
    }
  }
  d.saveVersion = 6;
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
