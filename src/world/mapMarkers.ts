// Harita işaretleri (B16, 0.10.0): toplama noktaları, yaratık bölgeleri ve takip edilen görevin hedefi — yalnızca
// keşfedilmiş (sis açılmış) alanlarda. Ansiklopedide bilinmiyorsa "?", tükenmişse soluk ve dönüş saatiyle.
// Saf: tests/g6.test.ts.
import type { SpawnDef, Gather } from './types';
import { spawnAlive, spawnReturn } from './sources';
import { clockLabel, fromAbsMinute } from '../core/time';

export type MarkerKind = 'gather' | 'spawn' | 'quest';

export interface MapMarker {
  kind: MarkerKind;
  x: number;
  y: number;
  /** Bilinen ad ya da "?". */
  label: string;
  known: boolean;
  /** Tükenmiş (bugün toplandı / yaratık kalmadı). */
  faded: boolean;
  /** "yarın", "dönüş 14:20" */
  note: string | null;
  /** Yaratık türü ya da bitki kimliği (simge için). */
  ref: string;
  /** Kümedeki nokta / gruptaki yaratık sayısı. */
  count: number;
}

export interface MarkerCtx {
  spawns: SpawnDef[];
  gathers: Gather[];
  /** Karo keşfedilmiş mi? */
  seen: (x: number, y: number) => boolean;
  gathered: (id: string) => boolean;
  respawns: Record<string, number>;
  now: number;
  monsterKnown: (id: string) => boolean;
  monsterName: (id: string) => string;
  plantKnown: (plant: string) => boolean;
  plantName: (plant: string) => string;
  /** Toplama noktasının bitki kimliği (elma ağacı → 'apple'). */
  plantOf: (g: Gather) => string;
  quest: { x: number; y: number; label: string } | null;
}

/** Aynı türden yakın toplama noktaları tek işaret (yarıçap karo). */
export const GATHER_CLUSTER_R = 5;

export function mapMarkers(c: MarkerCtx): MapMarker[] {
  const out: MapMarker[] = [];
  // toplama noktaları: kümeler
  const left = c.gathers.filter((g) => c.seen(g.x, g.y));
  const used = new Set<string>();
  for (const g of left) {
    if (used.has(g.id)) continue;
    const plant = c.plantOf(g);
    const group = left.filter((o) => !used.has(o.id) && c.plantOf(o) === plant && Math.hypot(o.x - g.x, o.y - g.y) <= GATHER_CLUSTER_R);
    for (const o of group) used.add(o.id);
    const avail = group.filter((o) => !c.gathered(o.id)).length;
    const known = c.plantKnown(plant);
    const x = group.reduce((a, o) => a + o.x, 0) / group.length, y = group.reduce((a, o) => a + o.y, 0) / group.length;
    out.push({ kind: 'gather', x, y, label: known ? c.plantName(plant) : '?', known, faded: avail === 0, note: avail === 0 ? 'yarın' : null, ref: plant, count: group.length });
  }
  // yaratık bölgeleri
  for (const s of c.spawns) {
    if (!c.seen(s.x, s.y)) continue;
    const known = c.monsterKnown(s.monster);
    const alive = spawnAlive(s, c.respawns, c.now);
    const back = alive ? null : spawnReturn(s, c.respawns, c.now);
    out.push({
      kind: 'spawn', x: s.x, y: s.y, label: known ? c.monsterName(s.monster) : '?', known, faded: !alive,
      note: back !== null ? `dönüş ${clockLabel(fromAbsMinute(back))}` : null, ref: s.monster, count: s.count,
    });
  }
  if (c.quest) out.push({ kind: 'quest', x: c.quest.x, y: c.quest.y, label: c.quest.label, known: true, faded: false, note: null, ref: 'quest', count: 1 });
  return out;
}
