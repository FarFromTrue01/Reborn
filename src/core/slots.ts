// 0.11.0 (D): kayıt yuvaları. 3 yuva; her yuvanın kendi kaydı oyun sırasında otomatik olarak (ve "Kaydet" ile)
// oynanan yuvaya yazılır. Başlık: "Devam" son oynanan yuvayı açar, "Yeni Oyun" yuva seçtirir (dolu yuvada onay),
// "Yükle" istenen yuvayı açar. Phaser'sız; StorageLike üstünde çalışır (testler MemoryStorage ile).
//
// Göç (bir kez): eski `auto` → Yuva 1, `manual1` → Yuva 2, `manual2` → Yuva 3. `manual3` doluysa silinmez: Yükle
// ekranında "Eski kayıt" olarak listelenir; yüklenince bir yuvaya kaydedilmesi istenir. Hiçbir eski kayıt silinmez
// (eski anahtarlar yerinde kalır; yalnızca kopyalanır).
import { CURRENT_SAVE_VERSION, type GameState } from './state';
import { migrate, type StorageLike } from './save';
import { subRankToString } from './ranks';

export const SLOT_COUNT = 3;
export type SlotId = 1 | 2 | 3;
export const SLOT_IDS: SlotId[] = [1, 2, 3];

const NEW_PREFIX = 'elonth.slot.';
const LEGACY_KEY = 'elonth.slot.legacy';
const LAST_KEY = 'elonth.slot.last';
const MIGRATED_KEY = 'elonth.slot.migrated';
const OLD_PREFIX = 'elonth.save.';

export interface SlotMeta {
  level: number;
  /** Lonca rütbesi ("G-", kayıtlı değilse null). */
  rank: string | null;
  day: number;
  savedAt: number;
}

export interface SlotEnvelope {
  v: number;
  savedAt: number;
  meta: SlotMeta;
  /** Eski zarflarla uyum (özet metni). */
  summary: string;
  data: unknown;
}

const keyOf = (slot: SlotId | 'legacy') => (slot === 'legacy' ? LEGACY_KEY : NEW_PREFIX + slot);

export function metaOf(s: GameState): SlotMeta {
  const p = s.player;
  return {
    level: p.level,
    rank: s.guild?.member && p.guildRank !== null && p.guildRank !== undefined ? subRankToString(p.guildRank) : null,
    day: s.time.day,
    savedAt: s.savedAt,
  };
}

/** Yuvanın özet satırı: "Level 3 · F- · 12. gün". */
export function metaLabel(m: SlotMeta): string {
  return `Level ${m.level} · ${m.rank ?? 'Rütbesiz'} · ${m.day}. gün`;
}

/** Eski kayıt sisteminden bir kez taşı (kopyala; eski anahtarlar silinmez). Taşındıysa true. */
export function migrateSlots(st: StorageLike): boolean {
  if (st.getItem(MIGRATED_KEY)) return false;
  const map: [string, SlotId | 'legacy'][] = [['auto', 1], ['manual1', 2], ['manual2', 3], ['manual3', 'legacy']];
  let any = false;
  for (const [old, slot] of map) {
    const raw = st.getItem(OLD_PREFIX + old);
    if (!raw || st.getItem(keyOf(slot))) continue;
    try {
      const env = JSON.parse(raw);
      const data = env.data;
      const meta: SlotMeta = data?.player ? metaOfLoose(data, env.savedAt) : { level: 0, rank: null, day: 1, savedAt: env.savedAt ?? 0 };
      st.setItem(keyOf(slot), JSON.stringify({ ...env, meta }));
      any = true;
    } catch {
      /* bozuk eski kayıt: dokunma */
    }
  }
  st.setItem(MIGRATED_KEY, '1');
  if (any && !st.getItem(LAST_KEY)) {
    // son oynanan: en yeni kaydı olan yuva
    const best = SLOT_IDS.map((id) => ({ id, i: slotMeta(st, id) })).filter((x) => x.i).sort((a, b) => b.i!.savedAt - a.i!.savedAt)[0];
    if (best) st.setItem(LAST_KEY, String(best.id));
  }
  return any;
}

/** Eski (göç edilmemiş) veriden özet: alanlar eksik olabilir. */
function metaOfLoose(d: any, savedAt: number): SlotMeta {
  const p = d.player ?? {};
  return {
    level: p.level ?? 0,
    rank: d.guild?.member && typeof p.guildRank === 'number' ? subRankToString(p.guildRank) : null,
    day: d.time?.day ?? 1,
    savedAt: savedAt ?? d.savedAt ?? 0,
  };
}

export function slotMeta(st: StorageLike, slot: SlotId | 'legacy'): SlotMeta | null {
  const raw = st.getItem(keyOf(slot));
  if (!raw) return null;
  try {
    const env = JSON.parse(raw) as SlotEnvelope;
    return env.meta ?? metaOfLoose(env.data, env.savedAt);
  } catch {
    return null;
  }
}

export function writeSlot(st: StorageLike, slot: SlotId, s: GameState): void {
  s.savedAt = Date.now();
  const meta = metaOf(s);
  const env: SlotEnvelope = { v: CURRENT_SAVE_VERSION, savedAt: s.savedAt, meta, summary: metaLabel(meta), data: s };
  st.setItem(keyOf(slot), JSON.stringify(env));
  st.setItem(LAST_KEY, String(slot));
}

export function readSlot(st: StorageLike, slot: SlotId | 'legacy'): GameState | null {
  const raw = st.getItem(keyOf(slot));
  if (!raw) return null;
  try {
    const env = JSON.parse(raw) as SlotEnvelope;
    if (typeof env.v !== 'number' || env.v > CURRENT_SAVE_VERSION) return null;
    return migrate(env.data, env.v);
  } catch {
    return null;
  }
}

/** Ham JSON'u (dışa aktarılmış kayıt ya da zarf) bir yuvaya yaz. Geçerliyse true. */
export function importToSlot(st: StorageLike, slot: SlotId, json: string): boolean {
  try {
    const o = JSON.parse(json);
    const env = o && typeof o.v === 'number' && o.data ? o : { v: o?.saveVersion ?? CURRENT_SAVE_VERSION, savedAt: Date.now(), data: o };
    if (!env.data?.player || env.v > CURRENT_SAVE_VERSION) return false;
    const s = migrate(env.data, env.v);
    writeSlot(st, slot, s);
    return true;
  } catch {
    return false;
  }
}

export function deleteSlot(st: StorageLike, slot: SlotId | 'legacy') {
  st.removeItem(keyOf(slot));
}

/** Son oynanan yuva (yoksa en yeni kaydı olan; o da yoksa null). */
export function lastSlot(st: StorageLike): SlotId | null {
  const v = Number(st.getItem(LAST_KEY));
  if ((SLOT_IDS as number[]).includes(v) && slotMeta(st, v as SlotId)) return v as SlotId;
  const best = SLOT_IDS.map((id) => ({ id, i: slotMeta(st, id) })).filter((x) => x.i).sort((a, b) => b.i!.savedAt - a.i!.savedAt)[0];
  return best?.id ?? null;
}

export function setLastSlot(st: StorageLike, slot: SlotId) {
  st.setItem(LAST_KEY, String(slot));
}

/** Yeni Oyun: boş yuva doğrudan başlar, dolu yuvada onay sorulur. */
export function newGameNeedsConfirm(st: StorageLike, slot: SlotId): string | null {
  const ek = slot === 3 ? "'teki" : "'deki";
  return slotMeta(st, slot) ? `Yuva ${slot}${ek} kayıt silinecek ve yerine yeni oyun yazılacak. Emin misin?` : null;
}

/** Bir yuvanın gösterimi: "Boş" ya da özet + son kayıt zamanı. */
export function slotLine(m: SlotMeta | null, locale = 'tr-TR'): string {
  if (!m) return 'Boş';
  return `${metaLabel(m)} · ${new Date(m.savedAt).toLocaleString(locale)}`;
}
