// Ortak durum etkileri (0.9.0, S6). Düşmanlara ve Joseph'e uygulanır; saf (tests/g5b.test.ts).
// Yanma: saniyede taban hasarın %20'si. Yavaşlatma: hız × (1 − oran). Dondurma: hareket ve saldırı yok (bosslarda %50
// yavaşlatmaya dönüşür). Sendeleme: kısa süre hareketsiz (bosslara ve kullanıcıdan yüksek leveldekilere işlemez).
// Felç: kısa süre hareketsiz. Korku: kaçma. Kışkırtma: hedefin kullanıcıya yönelmesi.
// Arındırma'nın sildiği olumsuz etkiler bu listedir; saatler süren lanetler `curse` bayrağı taşır.

export type StatusKind = 'burn' | 'slow' | 'freeze' | 'stagger' | 'paralyze' | 'fear' | 'taunt';

export interface Status {
  kind: StatusKind;
  /** Kalan süre (sn). */
  t: number;
  /** Yanma: saniyelik hasar; yavaşlatma: oran (0.3 = %30). */
  power?: number;
  /** Lanet: Arındırma S-'ye (Lanet Kıran) kadar kaldıramaz. */
  curse?: boolean;
}

export const STATUS_NAMES: Record<StatusKind, string> = {
  burn: 'Yanma', slow: 'Yavaşlama', freeze: 'Donma', stagger: 'Sendeleme', paralyze: 'Felç', fear: 'Korku', taunt: 'Kışkırtma',
};

/** Yanmanın saniyelik hasarı: taban hasarın %20'si. */
export const BURN_PER_SEC = 0.2;
/** Bosslarda dondurmanın yerine geçen yavaşlatma. */
export const BOSS_FREEZE_SLOW = 0.5;

export interface StatusTarget {
  boss?: boolean;
  level: number;
}

/**
 * Etkiyi uygula. Aynı türden etki varsa süre ve güç büyük olanı alır (üst üste binmez). Boss dondurulamaz (%50
 * yavaşlatma olur); sendeleme bosslara ve kullanıcıdan yüksek leveldekilere işlemez. Sonuç: yeni liste ve uygulanan
 * etki (işlemediyse null).
 */
export function applyStatus(list: Status[], s: Status, target: StatusTarget, userLevel: number): { list: Status[]; applied: Status | null } {
  let st: Status = { ...s };
  if (st.kind === 'freeze' && target.boss) st = { kind: 'slow', t: st.t, power: BOSS_FREEZE_SLOW };
  if (st.kind === 'stagger' && (target.boss || target.level > userLevel)) return { list, applied: null };
  if (st.t <= 0) return { list, applied: null };
  const out = list.map((x) => ({ ...x }));
  const cur = out.find((x) => x.kind === st.kind);
  if (cur) {
    cur.t = Math.max(cur.t, st.t);
    if (st.power !== undefined) cur.power = Math.max(cur.power ?? 0, st.power);
    cur.curse = cur.curse || st.curse;
    return { list: out, applied: cur };
  }
  out.push(st);
  return { list: out, applied: st };
}

/** Süreleri ilerletir; bu karedeki yanma hasarını döndürür. */
export function tickStatuses(list: Status[], dt: number): { list: Status[]; burn: number } {
  let burn = 0;
  const out: Status[] = [];
  for (const s of list) {
    const step = Math.min(dt, Math.max(0, s.t));
    if (s.kind === 'burn') burn += (s.power ?? 0) * step;
    const t = s.t - dt;
    if (t > 0) out.push({ ...s, t });
  }
  return { list: out, burn };
}

export interface StatusMods {
  /** Hareket hızı çarpanı. */
  speed: number;
  /** Hareket edip saldırabilir mi (dondurma, sendeleme, felç: hayır). */
  canAct: boolean;
  frozen: boolean;
  fleeing: boolean;
  taunted: boolean;
}

export function statusMods(list: Status[]): StatusMods {
  let speed = 1;
  let canAct = true, frozen = false, fleeing = false, taunted = false;
  for (const s of list) {
    if (s.t <= 0 && !s.curse) continue;
    if (s.kind === 'slow') speed = Math.min(speed, 1 - Math.max(0, Math.min(0.9, s.power ?? 0)));
    if (s.kind === 'freeze') { canAct = false; frozen = true; }
    if (s.kind === 'stagger' || s.kind === 'paralyze') canAct = false;
    if (s.kind === 'fear') fleeing = true;
    if (s.kind === 'taunt') taunted = true;
  }
  return { speed, canAct, frozen, fleeing, taunted };
}

/** Arındırma: savaş etkilerini siler; lanetler yalnızca curseBreak ile (Şifa S-). */
export function cleanseStatuses(list: Status[], curseBreak = false): Status[] {
  return list.filter((s) => s.curse && !curseBreak);
}

/** Olumsuz etkilerin süresi (İlk Yardım B-: -%25). */
export function scaledDuration(t: number, debuffDurPct = 0): number {
  return Math.max(0, t * (1 + debuffDurPct));
}
