// Yan görev verenlerin iş yerleri (0.6.0). Bir yan görev veren yalnızca kendi iş yerindeyken görev verir, teslim
// alır ve görevden bahseder; başka yerde karakterine uygun kısa bir yönlendirme söyler. Dükkânı olanlar dükkânlarında
// ve çalışma saatinde (data/shops); olmayanlar sabit bir "görev yeri" noktasının yakınında.
// Mavi işaretler (başın üstünde "!", "?" ve haritalardaki ışık) da yalnızca kişi o anda iş yerindeyse görünür.
import { SHOPS } from '../data/shops';
import { scheduleAt, type NpcDef, type ScheduleEntry } from '../data/npcs';
import { SIDE_QUESTS } from '../data/sidequests';
import type { QuestDef, QuestStatus } from '../core/quests';

export interface SidePost {
  /** Dükkân (data/shops): dükkânın haritası ve saatleri. */
  shop?: string;
  /** Ya da harita + adlandırılmış nokta + yarıçap (karo). */
  map?: string;
  point?: string;
  radius?: number;
}

export interface GiverPost {
  posts: SidePost[];
  /** İş yeri dışında söylediği yönlendirme. */
  away: string;
}

export const SIDE_POSTS: Record<string, GiverPost> = {
  baker: { posts: [{ shop: 'bakery' }], away: 'Akşamları iş konuşmam, köksüz. Fırına gel; tezgâhın başında, hamurun yanında konuşuruz.' },
  tanner: { posts: [{ shop: 'tannery' }], away: 'Burada mı? Kokum bile yanımda değil. Tabakhaneye gel, iş orada.' },
  smith: { posts: [{ shop: 'smith' }], away: 'İş konuşacaksan demirhaneye gel. Burada içiyorum.' },
  healer: { posts: [{ shop: 'healer' }], away: 'Şimdi değil, yavrum. Şifa evine uğra; otlarım da orada, aklım da.' },
  tailor: { posts: [{ shop: 'tailor' }], away: 'Sokakta kumaş konuşulmaz, toz olur. Dükkânıma buyur, köksüz. Kapıyı kapatarak.' },
  hunter: { posts: [{ shop: 'lodge' }], away: 'İş mi? Kulübemdeyken gel. Kuzeydoğuda, korunun kenarında. Öğleden sonra.' },
  merchant: { posts: [{ map: 'world', point: 'manor_front', radius: 4 }], away: 'Sokakta pazarlık yapmam. Sabahları konağımın önündeyim; orada konuşuruz. Belki.' },
  oswin: { posts: [{ map: 'world', point: 'mill_yard', radius: 5 }], away: 'Değirmenden uzakta iş konuşmam. Taş döner, ben dönerim. Değirmene gel.' },
  pip: { posts: [{ map: 'world', point: 'plaza', radius: 7 }], away: 'Şşş! Annem burada! Oyun yerinde konuşalım. Meydanda! Kuyunun orada!' },
  vagrant: { posts: [{ map: 'world', point: 'inn_front', radius: 3 }, { map: 'inn', point: 'back_1', radius: 3 }], away: '...Burada değil. Herkes bakıyor. Hanın önünde otururum. Ya da arka köşede. Orada.' },
};

type Points = (map: string) => Record<string, { x: number; y: number }>;

function tileOf(e: ScheduleEntry, pts: Points): { x: number; y: number } | null {
  if (Array.isArray(e.at)) return { x: e.at[0], y: e.at[1] };
  return pts(e.map)[e.at] ?? null;
}

/** Program kaydı (o saat) kişiyi iş yerine koyuyor mu? */
export function entryAtPost(giver: string, e: ScheduleEntry, hour: number, pts: Points): boolean {
  const gp = SIDE_POSTS[giver];
  if (!gp) return true;
  for (const p of gp.posts) {
    if (p.shop) {
      const s = SHOPS[p.shop];
      if (s && e.map === s.map && hour >= s.hours[0] && hour < s.hours[1]) return true;
    } else if (p.map === e.map && p.point) {
      if (e.at === p.point) return true;
      const a = tileOf(e, pts), b = pts(p.map)[p.point];
      if (a && b && Math.hypot(a.x - b.x, a.y - b.y) <= (p.radius ?? 3)) return true;
    }
  }
  return false;
}

/** Kişi gerçekte (bu haritada, bu konumda, bu saatte) iş yerinde mi? */
export function atPostNow(giver: string, map: string, tile: { x: number; y: number }, hour: number, pts: Points): boolean {
  const gp = SIDE_POSTS[giver];
  if (!gp) return true;
  for (const p of gp.posts) {
    if (p.shop) {
      const s = SHOPS[p.shop];
      if (s && map === s.map && hour >= s.hours[0] && hour < s.hours[1]) return true;
    } else if (p.map === map && p.point) {
      const b = pts(map)[p.point];
      if (b && Math.hypot(tile.x - b.x, tile.y - b.y) <= (p.radius ?? 3)) return true;
    }
  }
  return false;
}

export type SideMark = 'offer' | 'turnin';

export interface SideQuestView {
  status(id: string): QuestStatus | null;
  /** Aktif görevin şu anki amaç indeksi (-1: yok). */
  objective(id: string): number;
  unlocked: boolean;
  declinedToday(id: string): boolean;
  has(item: string): boolean;
}

/** Bu yan görev için verenin üstünde hangi işaret olmalı (iş yerinde olup olmadığından bağımsız)? */
export function sideMarkOf(q: QuestDef, v: SideQuestView): SideMark | null {
  const st = v.status(q.id);
  if (st === null) return v.unlocked && !v.declinedToday(q.id) ? 'offer' : null;
  if (st !== 'active') return null;
  const i = v.objective(q.id);
  const o = q.objectives[i];
  if (!o || o.target !== q.giver) return null;
  if (o.type === 'talk') return 'turnin';
  // teslim (Nim'in ekmeği): elde ekmek varsa
  if (o.type === 'deliver' && q.id === 'sq_nim_bread') return v.has('bread') ? 'turnin' : null;
  return null;
}

/** Verenlerin işaretleri (teslim teklife üstün). */
export function giverMarks(v: SideQuestView): Record<string, SideMark> {
  const out: Record<string, SideMark> = {};
  for (const q of SIDE_QUESTS) {
    if (!q.giver) continue;
    const m = sideMarkOf(q, v);
    if (m === 'turnin' || (m === 'offer' && !out[q.giver])) out[q.giver] = m;
  }
  return out;
}

/** İşaretler yalnızca kişi şu an (programına göre) iş yerindeyse. */
export function visibleGiverMarks(v: SideQuestView, defs: Record<string, NpcDef>, day: number, hour: number, pts: Points): Record<string, SideMark> {
  const out: Record<string, SideMark> = {};
  for (const [id, m] of Object.entries(giverMarks(v))) {
    const def = defs[id];
    if (def && entryAtPost(id, scheduleAt(def, hour, day), hour, pts)) out[id] = m;
  }
  return out;
}
