// Veriyle tanımlanan görev sistemi (C2). Görev türleri: ana, yan, pano.
// Amaç türleri: konuş, git, topla, öldür, teslim et. Saf kurallar — tests/quests.test.ts.
import type { Letter } from './ranks';

export type QuestKind = 'main' | 'side' | 'board';
export type ObjectiveType = 'talk' | 'go' | 'collect' | 'kill' | 'deliver' | 'custom';
export type QuestStatus = 'active' | 'done' | 'failed' | 'abandoned';

/** Hedef konumu: yön oku ve harita işareti için. point: harita noktası adı; npc: NPC kimliği. */
export interface QuestTarget {
  map: string;
  x?: number;
  y?: number;
  point?: string;
  npc?: string;
  /** "git" amacı için yarıçap (karo). */
  radius?: number;
  /** Öldürme amacı: bu yaratığın doğduğu bölgelerden oyuncuya en yakını (0.6.0). */
  monster?: string;
  /** Toplama amacı: bu eşyanın toplama noktası ya da onu düşüren yaratığın bölgesi, oyuncuya en yakını (0.6.0). */
  item?: string;
}

export interface ObjectiveDef {
  type: ObjectiveType;
  label: string;
  /** konuş/teslim: NPC; topla/teslim: eşya; öldür: canavar türü. */
  target?: string;
  count?: number;
  where?: QuestTarget;
  /** Gizli amaç: önceki amaçlar bitmeden listede görünmez. */
  sequential?: boolean;
}

export interface QuestReward {
  money?: number;
  items?: { id: string; qty: number }[];
  /** Lonca Puanı (pano/lonca görevleri). */
  points?: number;
  /**
   * Karakter EXP'si (0.5.0 kuralı): ana görevler EXP vermez; yan ve pano görevleri az verir. EXP'nin asıl ve en hızlı
   * yolu canavar avlamaktır (tests/systems.test.ts sınırları denetler).
   */
  exp?: number;
  text?: string;
}

export interface QuestDef {
  id: string;
  kind: QuestKind;
  title: string;
  desc: string;
  giver?: string;
  /** Lonca görevi ise harfi. */
  rank?: Letter;
  /** Lonca görevi mi (puan, ceza ve borç kuralları uygulanır)? */
  guild?: boolean;
  /** Yoldaşlarla yapılan grup görevi (puanın %50'si). */
  group?: boolean;
  objectives: ObjectiveDef[];
  reward: QuestReward;
  /** Süre (oyun günü): dolarsa başarısız. */
  days?: number;
  chapter?: number;
}

export interface QuestState {
  id: string;
  status: QuestStatus;
  progress: number[];
  startedDay: number;
  endedDay?: number;
  /** Dinamik görevler (pano) tanımlarını kayıtta taşır. */
  def?: QuestDef;
  /** Görevin kendi durumu (hikâye için serbest alan). */
  data?: Record<string, number | string | boolean>;
}

export interface QuestLog {
  quests: Record<string, QuestState>;
  tracked: string | null;
  /** Bitiş sırasına göre (görevler sekmesi). */
  order: string[];
}

export function newQuestLog(): QuestLog {
  return { quests: {}, tracked: null, order: [] };
}

export type DefLookup = (id: string) => QuestDef | undefined;

export function defOf(log: QuestLog, id: string, lookup: DefLookup): QuestDef | undefined {
  return log.quests[id]?.def ?? lookup(id);
}

/** Görevi başlatır. Ana görevler otomatik takip edilir. Zaten başlamışsa false. */
export function startQuest(log: QuestLog, def: QuestDef, day: number, dynamic = false): boolean {
  if (log.quests[def.id]) return false;
  log.quests[def.id] = { id: def.id, status: 'active', progress: def.objectives.map(() => 0), startedDay: day, def: dynamic ? def : undefined };
  log.order.push(def.id);
  if (def.kind === 'main' || !log.tracked || !isActive(log, log.tracked)) log.tracked = def.id;
  return true;
}

export function isActive(log: QuestLog, id: string): boolean {
  return log.quests[id]?.status === 'active';
}

export function isDone(log: QuestLog, id: string): boolean {
  return log.quests[id]?.status === 'done';
}

export function objectiveDone(def: QuestDef, st: QuestState, i: number): boolean {
  return st.progress[i] >= (def.objectives[i].count ?? 1);
}

export function allObjectivesDone(def: QuestDef, st: QuestState): boolean {
  return def.objectives.every((_, i) => objectiveDone(def, st, i));
}

/** Şu an üzerinde çalışılan ilk tamamlanmamış amaç (indeks) ya da -1. */
export function currentObjective(def: QuestDef, st: QuestState): number {
  for (let i = 0; i < def.objectives.length; i++) if (!objectiveDone(def, st, i)) return i;
  return -1;
}

/**
 * B3 (0.8.0): aktif görevlerin toplama amacındaki eşyalar — teslim edilene kadar (sonraki amaç bitene kadar)
 * yenemez/kullanılamaz. Toplama sayısı dolmuş olsa da teslimden önce gereklidir.
 */
export function questNeededItems(log: QuestLog, lookup: DefLookup): Set<string> {
  const out = new Set<string>();
  for (const id of Object.keys(log.quests)) {
    const st = log.quests[id];
    if (st.status !== 'active') continue;
    const def = defOf(log, id, lookup);
    if (!def) continue;
    def.objectives.forEach((o, i) => {
      if (o.type !== 'collect' || !o.target) return;
      if (def.objectives.some((_, j) => j > i && objectiveDone(def, st, j))) return;
      out.add(o.target);
    });
  }
  return out;
}

/** Görünür amaçlar: sıralı (sequential) amaçlar öncekiler bitene kadar gizli. */
export function visibleObjectives(def: QuestDef, st: QuestState): number[] {
  const out: number[] = [];
  for (let i = 0; i < def.objectives.length; i++) {
    if (def.objectives[i].sequential && i > 0 && !objectiveDone(def, st, i - 1)) break;
    out.push(i);
  }
  return out;
}

/**
 * Bir amacı ilerletir (ör. öldürme, toplama). Sıralı amaçlar öncekiler bitmeden ilerlemez.
 * Döner: ilerleme değişti mi.
 */
export function advance(log: QuestLog, id: string, idx: number, n = 1, lookup?: DefLookup): boolean {
  const st = log.quests[id];
  if (!st || st.status !== 'active') return false;
  const def = st.def ?? lookup?.(id);
  if (!def) return false;
  const o = def.objectives[idx];
  if (!o) return false;
  if (o.sequential && idx > 0 && !objectiveDone(def, st, idx - 1)) return false;
  const max = o.count ?? 1;
  const before = st.progress[idx];
  st.progress[idx] = Math.min(max, before + n);
  return st.progress[idx] !== before;
}

/** Bir amacı mutlak değere ayarlar (topla: envanterdeki sayı). */
export function setProgress(log: QuestLog, id: string, idx: number, value: number, lookup?: DefLookup): boolean {
  const st = log.quests[id];
  if (!st || st.status !== 'active') return false;
  const def = st.def ?? lookup?.(id);
  if (!def?.objectives[idx]) return false;
  const v = Math.max(0, Math.min(def.objectives[idx].count ?? 1, value));
  if (st.progress[idx] === v) return false;
  st.progress[idx] = v;
  return true;
}

/** Olay tabanlı ilerleme: tüm aktif görevlerde uyan amaçları ilerletir. Değişen görev kimliklerini döndürür. */
export function notify(log: QuestLog, type: ObjectiveType, target: string, n: number, lookup: DefLookup): string[] {
  const changed: string[] = [];
  for (const st of Object.values(log.quests)) {
    if (st.status !== 'active') continue;
    const def = st.def ?? lookup(st.id);
    if (!def) continue;
    def.objectives.forEach((o, i) => {
      if (o.type === type && o.target === target && advance(log, st.id, i, n, lookup)) changed.push(st.id);
    });
  }
  return changed;
}

export function finishQuest(log: QuestLog, id: string, status: Exclude<QuestStatus, 'active'>, day: number): boolean {
  const st = log.quests[id];
  if (!st || st.status !== 'active') return false;
  st.status = status;
  st.endedDay = day;
  if (log.tracked === id) log.tracked = pickNextTracked(log);
  return true;
}

/** Takip edilecek bir sonraki görev: önce aktif ana görev, sonra en yeni aktif görev. */
export function pickNextTracked(log: QuestLog, lookup?: DefLookup): string | null {
  const act = log.order.filter((id) => log.quests[id]?.status === 'active');
  const main = act.find((id) => (log.quests[id].def ?? lookup?.(id))?.kind === 'main' || id.startsWith('m_'));
  return main ?? act[act.length - 1] ?? null;
}

/** Süresi dolan görevler (days alanı olan). */
export function expired(log: QuestLog, day: number, lookup: DefLookup): string[] {
  const out: string[] = [];
  for (const st of Object.values(log.quests)) {
    if (st.status !== 'active') continue;
    const def = st.def ?? lookup(st.id);
    if (def?.days && day - st.startedDay >= def.days) out.push(st.id);
  }
  return out;
}

export function activeQuests(log: QuestLog): string[] {
  return log.order.filter((id) => log.quests[id]?.status === 'active');
}

/** HUD kategorisi: ana görevler ve yan görevler (pano görevleri yan görevlerle aynı kategoride). */
export type QuestCategory = 'main' | 'side';

export function questCategory(kind: QuestKind): QuestCategory {
  return kind === 'main' ? 'main' : 'side';
}

export interface QuestHudPrefs {
  main: boolean;
  side: boolean;
}

/**
 * HUD görev kutusunun grupları: önce Ana Görevler, sonra Yan Görevler. Gizlenen ya da boş kategori listede yer almaz
 * (başlığı da çizilmez). Sıra günlükteki başlama sırasıdır.
 */
export function hudQuestGroups(ids: string[], kindOf: (id: string) => QuestKind | undefined, prefs: QuestHudPrefs): { cat: QuestCategory; ids: string[] }[] {
  const out: { cat: QuestCategory; ids: string[] }[] = [];
  for (const cat of ['main', 'side'] as const) {
    if (!prefs[cat]) continue;
    const list = ids.filter((id) => {
      const k = kindOf(id);
      return k !== undefined && questCategory(k) === cat;
    });
    if (list.length) out.push({ cat, ids: list });
  }
  return out;
}

/** Görevin verdiği karakter EXP'si: ana görevler hiç vermez (tanımda yazsa bile). */
export function questExp(def: QuestDef): number {
  if (def.kind === 'main') return 0;
  return Math.max(0, def.reward.exp ?? 0);
}
