// Görev kaynakları (A7.6, B10, B16): bir yaratığın ya da eşyanın dünyadaki kaynakları — doğma grupları ve toplama
// noktaları — yalnızca **şu an** dolu olanlar; hepsi tükendiyse en erken dönüş zamanı. Saf: tests/g6.test.ts.
import type { SpawnDef, Gather } from './types';
import { MONSTERS } from '../data/monsters';
import { ITEMS } from '../data/items';
import { whenLabelExact } from '../core/time';

/** Doğma grubunun anahtarları (`s.id#i`, bkz. WorldScene.spawnEnemies). */
export function spawnKeys(s: SpawnDef): string[] {
  return Array.from({ length: s.count }, (_, i) => `${s.id}#${i}`);
}

/** Grupta yaşayan (ya da dönmüş) en az bir yaratık var mı? respawns[key]: dönüş zamanı (mutlak dakika). */
export function spawnAlive(s: SpawnDef, respawns: Record<string, number>, now: number): boolean {
  return spawnKeys(s).some((k) => (respawns[k] ?? 0) <= now);
}

/** Tükenmiş grubun ilk dönüş zamanı (yaşıyorsa null). */
export function spawnReturn(s: SpawnDef, respawns: Record<string, number>, now: number): number | null {
  if (spawnAlive(s, respawns, now)) return null;
  return Math.min(...spawnKeys(s).map((k) => respawns[k] ?? 0));
}

export interface SourceCtx {
  spawns: SpawnDef[];
  gathers: Gather[];
  respawns: Record<string, number>;
  now: number;
  /** Bu eşyayı düşüren yaratık türleri. */
  droppersOf: (item: string) => string[];
  /** Toplama noktası şu an toplanmış mı (bugün)? */
  gathered: (id: string) => boolean;
  /** Toplanmış noktanın yeniden toplanabileceği zaman (varsayılan: ertesi gün 00:00). */
  regrowAt?: (id: string) => number;
}

export interface SourceSpot {
  x: number;
  y: number;
  kind: 'spawn' | 'gather';
  /** Doğma grubunun yaratığı ya da toplama noktasının eşyası. */
  what: string;
}

export interface SourceResult {
  /** Şu an dolu kaynaklar. */
  live: SourceSpot[];
  /** Hiç kaynak tanımı var mı (yoksa görev hedefi başka türden: nokta). */
  any: boolean;
  /** Hepsi tükendiyse en erken dönüş zamanı (mutlak dakika) ve neyin döndüğü. */
  next: { at: number; kind: 'spawn' | 'gather'; what: string } | null;
}

/** Bir hedefin (yaratık ya da eşya) kaynakları: yaşayan gruplar ve toplanmamış noktalar; hepsi tükendiyse ilk dönüş. */
export function questSources(t: { monster?: string; item?: string }, c: SourceCtx): SourceResult {
  const live: SourceSpot[] = [];
  let any = false;
  let next: SourceResult['next'] = null;
  const consider = (at: number, kind: 'spawn' | 'gather', what: string) => {
    if (!next || at < next.at) next = { at, kind, what };
  };
  const monsters = new Set<string>();
  if (t.monster) monsters.add(t.monster);
  if (t.item) for (const m of c.droppersOf(t.item)) monsters.add(m);
  for (const s of c.spawns) {
    if (!monsters.has(s.monster)) continue;
    any = true;
    if (spawnAlive(s, c.respawns, c.now)) live.push({ x: s.x, y: s.y, kind: 'spawn', what: s.monster });
    else consider(spawnReturn(s, c.respawns, c.now)!, 'spawn', s.monster);
  }
  if (t.item) {
    for (const g of c.gathers) {
      if (g.item !== t.item) continue;
      any = true;
      if (!c.gathered(g.id)) live.push({ x: g.x, y: g.y, kind: 'gather', what: g.item });
      else consider(c.regrowAt ? c.regrowAt(g.id) : (Math.floor(c.now / 1440) + 1) * 1440, 'gather', g.item);
    }
  }
  return { live, any, next: live.length ? null : next };
}

/** En yakın nokta (karo koordinatı). */
export function nearestSpot<T extends { x: number; y: number }>(spots: T[], x: number, y: number): T | null {
  let best: T | null = null, bd = Infinity;
  for (const s of spots) {
    const d = Math.hypot(s.x - x, s.y - y);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

/**
 * Kaynaklar tükendiğinde görevin altındaki bekleme metni (B10):
 * - yalnızca toplama noktası olan eşya: "Bugünlük elma kalmadı — yarın yeniden toplanır" (eski davranış);
 * - yaratık: "Fare kalmadı. Yeniden doğuş: bugün 14:37";
 * - karışık (toplama + düşüren yaratık): hangisi önce dönüyorsa onun saati.
 */
export function sourceWaitText(t: { monster?: string; item?: string }, r: SourceResult, now: number): string {
  const lower = (x: string) => x.toLocaleLowerCase('tr');
  const n = r.next;
  if (!n) return 'Kaynak kalmadı';
  const when = whenLabelExact(now, n.at);
  if (t.monster) return `${MONSTERS[t.monster]?.name ?? 'Yaratık'} kalmadı. Yeniden doğuş: ${when}`;
  const item = ITEMS[t.item!]?.name ?? 'Kaynak';
  if (n.kind === 'gather') {
    const day = Math.floor(now / 1440);
    if (Math.floor(n.at / 1440) === day + 1 && n.at % 1440 === 0) return `Bugünlük ${lower(item)} kalmadı — yarın yeniden toplanır`;
    return `${item} kalmadı. Yeniden toplanır: ${when}`;
  }
  return `${item} veren ${lower(MONSTERS[n.what]?.name ?? 'yaratık')} kalmadı. Yeniden doğuş: ${when}`;
}
