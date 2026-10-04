// NPC'ye ulaşılabilirlik (0.6.0): NPC hedefli görev amaçları için. Program (data/schedules) NPC'nin nerede
// olduğunu söyler; oyuncu oraya gidebiliyor mu (dünya haritası ya da açık, girilebilir bir bina)? Gidemiyorsa
// bir sonraki erişilebilir saat ve yer. Yön oku ve görev metni bundan beslenir; uyku menüsü de bu saate kadar
// uyutabilir. Saf: harita bilgisi ReachCtx ile gelir (tests/g4a.test.ts).
import { scheduleAt, type NpcDef, type ScheduleEntry } from '../data/npcs';
import { fromAbsMinute, whenLabel } from '../core/time';
import { absMinute } from '../core/sleep';

export interface ReachCtx {
  /** Bu iç mekâna bu saatte girilebilir mi (dünyada kapısı var ve açık)? */
  open(map: string, hour: number): boolean;
}

export interface Reach {
  /** Mutlak oyun dakikası (şimdi ya da bir sonraki saat başı). */
  abs: number;
  entry: ScheduleEntry;
  now: boolean;
}

export function entryReachable(e: ScheduleEntry, hour: number, ctx: ReachCtx): boolean {
  if (e.map === 'hidden') return false;
  if (e.map === 'world') return true;
  return ctx.open(e.map, hour);
}

/** NPC'ye şimdi ya da en geç `horizonH` saat içinde nerede/ne zaman ulaşılır? Yoksa null. */
export function nextReach(def: NpcDef, day: number, minute: number, ctx: ReachCtx, horizonH = 48): Reach | null {
  const h = Math.floor(minute / 60);
  const e = scheduleAt(def, h, day);
  if (entryReachable(e, h, ctx)) return { abs: absMinute(day, minute), entry: e, now: true };
  const base = absMinute(day, h * 60);
  for (let k = 1; k <= horizonH; k++) {
    const abs = base + k * 60;
    const t = fromAbsMinute(abs);
    const hh = t.minute / 60;
    const ek = scheduleAt(def, hh, t.day);
    if (entryReachable(ek, hh, ctx)) return { abs, entry: ek, now: false };
  }
  return null;
}

/** İç mekânlar ve dünya noktaları için "-de" hâli (görev metinleri). */
const MAP_LOC: Record<string, string> = {
  inn: 'handa', inn_attic: 'handa', guild: 'loncada', healer: 'şifa evinde', smithy: 'demirhanede', shop: 'dükkânda',
  bakery: 'fırında', tailor: 'terzide', tannery: 'tabakhanede', lodge: 'avcı kulübesinde', farmhouse: 'çiftlik evinde',
  mill_cellar: 'değirmen bodrumunda',
};
const POINT_LOC: [RegExp, string][] = [
  [/^(haldor_field|field_)/, 'tarlada'], [/^pasture/, 'otlakta'], [/^mill_yard/, 'değirmende'], [/^training/, 'antrenman alanında'],
  [/^plaza/, 'meydanda'], [/^(ep_|fountain|east_plaza)/, 'Doğu Meydanı\'nda'], [/^checkpoint/, 'kontrol noktasında'],
  [/^lodge_yard/, 'avcı kulübesinin önünde'], [/^manor_front/, 'konağın önünde'], [/^smithy_yard/, 'demirhanenin önünde'],
  [/^inn_front/, 'hanın önünde'], [/^riverbank/, 'nehir kıyısında'], [/^(oak|farm_yard|stable_yard|south_road)/, 'güney çiftliklerinde'],
  [/^(pond|wash_line)/, 'gölet kıyısında'], [/^(barn_yard)/, 'ahırda'], [/^(bakery_front)/, 'fırının önünde'], [/^(tailor_front)/, 'terzinin önünde'],
  [/^(tannery_yard)/, 'tabakhanenin önünde'], [/^(beggar_spot|bench)/, 'meydanda'], [/^(guardpost)/, 'karakolun önünde'],
];

export function placeLoc(e: ScheduleEntry): string {
  if (e.map !== 'world') return MAP_LOC[e.map] ?? 'içeride';
  if (typeof e.at === 'string') for (const [re, s] of POINT_LOC) if (re.test(e.at)) return s;
  return 'köyde';
}

/** Kısa ad: "Yaşlı Haldor" → "Haldor". */
export function shortName(def: NpcDef): string {
  return def.name.split(' ').pop() ?? def.name;
}

/** "Haldor 14:00'te tarlada olur — o saate kadar bekle." */
export function waitText(def: NpcDef, nowAbs: number, r: Reach | null): string {
  if (!r) return `${shortName(def)} bugünlerde ortalıkta yok.`;
  return `${shortName(def)} ${whenLabel(nowAbs, r.abs)} ${placeLoc(r.entry)} olur — o saate kadar bekle`;
}
