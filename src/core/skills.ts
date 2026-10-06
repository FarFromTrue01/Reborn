import { parseSubRank, skillThreshold, SUBRANK_MAX, subRankToString, subRankLetter, type SubRank, type Letter } from './ranks';
import type { SkillDef, SkillPassive, SkillState, SkillTier, KindMap } from './types';
import { SKILLS, skillDef, TECHNIQUES } from '../data/skills';

export function newSkill(id: string): SkillState {
  return { id, rank: 0, exp: 0 };
}

export interface SkillExpResult {
  state: SkillState;
  rankUps: SubRank[]; // ulaşılan yeni kademeler
  unlocked: SkillTier[]; // açılan tablolar
}

/** Skill EXP ekler; eşik dolunca bir üst alt kademeye geçer, artan EXP devreder. */
export function addSkillExp(s: SkillState, gain: number): SkillExpResult {
  const st = { ...s };
  const rankUps: SubRank[] = [];
  const unlocked: SkillTier[] = [];
  if (gain < 0 || st.rank >= SUBRANK_MAX) return { state: st, rankUps, unlocked };
  st.exp += gain;
  const def = SKILLS[st.id];
  while (st.rank < SUBRANK_MAX && st.exp >= skillThreshold(st.rank)) {
    st.exp -= skillThreshold(st.rank);
    st.rank++;
    rankUps.push(st.rank);
    if (def) for (const t of def.tiers) if (parseSubRank(t.at) === st.rank) unlocked.push(t);
  }
  if (st.rank >= SUBRANK_MAX) st.exp = 0;
  // Kesirli EXP biriktirilir ama ekranda tamsayı gösterilir.
  st.exp = Math.round(st.exp * 1000) / 1000;
  return { state: st, rankUps, unlocked };
}

/** Bu skill'in mevcut kademede açık olan tüm tabloları. */
export function activeTiers(s: SkillState): SkillTier[] {
  const def = SKILLS[s.id];
  if (!def) return [];
  return def.tiers.filter((t) => parseSubRank(t.at) <= s.rank);
}

// ---------------------------------------------------------------- pasif birleştirme (S2)

/** Alanın "hiç yokken" değeri: ara kademe ilerlemesi bundan başlar (çarpanlar 1, taban süreler vb.). */
export const PASSIVE_NEUTRAL: Partial<Record<keyof SkillPassive, number>> = {
  sneakMult: 1.5, burnMult: 1, slowMult: 1, freezeRadiusMult: 1, frozenDmgMult: 1, comboFinisher: 1, cdMult: 1,
  freezeDur: 1.5, staggerDur: 0.5, windWaves: 1, burnDur: 3, slowPct: 0.2, chain: 1,
};

const MAP_KEYS = new Set(['stats', 'dmg', 'crit', 'atkSpd', 'atkStamina', 'range']);
const isMapKey = (k: string) => MAP_KEYS.has(k);

function mergeInto(acc: any, p: SkillPassive) {
  for (const [k, v] of Object.entries(p)) {
    if (isMapKey(k)) acc[k] = { ...(acc[k] ?? {}), ...(v as object) };
    else acc[k] = v;
  }
}

const r4 = (x: number) => Math.round(x * 10000) / 10000;

/** cur'dan next'e f (0–1) kadar: yalnızca sayılar ve eşlem değerleri; statlar tamsayıya yuvarlanır. */
export function lerpPassive(cur: SkillPassive, next: SkillPassive, f: number): SkillPassive {
  const out: any = JSON.parse(JSON.stringify(cur));
  if (f <= 0) return out;
  for (const [k, nv] of Object.entries(next)) {
    if (isMapKey(k)) {
      const cm = (cur as any)[k] ?? {};
      const om: any = { ...cm };
      for (const [kk, v] of Object.entries(nv as Record<string, number>)) {
        const a = cm[kk] ?? 0;
        const val = a + (v - a) * f;
        om[kk] = k === 'stats' ? Math.round(val) : r4(val);
      }
      out[k] = om;
    } else if (typeof nv === 'number') {
      const a = typeof (cur as any)[k] === 'number' ? (cur as any)[k] : PASSIVE_NEUTRAL[k as keyof SkillPassive] ?? 0;
      out[k] = r4(a + (nv - a) * f);
    }
  }
  return out;
}

/** Bir rütbeye kadarki tabloların alan alan birleşimi (aynı alanda son değer geçerli). */
function mergedUpTo(def: SkillDef, rank: SubRank): SkillPassive {
  const acc: SkillPassive = {};
  for (const t of def.tiers) if (t.passive && parseSubRank(t.at) <= rank) mergeInto(acc, t.passive);
  return acc;
}

/**
 * Skill'in o anki pasifi: ulaşılan tüm tablolar sırayla birleşir (sonraki tabloda anılmayan alan önceki değerini
 * korur). Ara kademelerde (ör. G ve G+) sayısal pasifler bir sonraki kilometre taşına doğru üçte bir ilerler.
 */
export function mergedPassive(s: SkillState): SkillPassive {
  const def = SKILLS[s.id];
  if (!def) return {};
  const cur = mergedUpTo(def, s.rank);
  const ats = def.tiers.map((t) => parseSubRank(t.at));
  const curAt = Math.max(0, ...ats.filter((a) => a <= s.rank));
  const nextAt = ats.filter((a) => a > s.rank).sort((a, b) => a - b)[0];
  if (nextAt === undefined || s.rank === curAt) return cur;
  return lerpPassive(cur, mergedUpTo(def, nextAt), (s.rank - curAt) / (nextAt - curAt));
}

/** Geriye uyum: eski ad. */
export const currentPassive = mergedPassive;

/** Tüm skill'lerin toplam etkisi (derive ve oyun kodu için). Bazı alanlar en büyüğü, çarpanlar çarpımı alır. */
export type SkillFx = SkillPassive;
const MAX_FIELDS = new Set(['sneakMult', 'noticeDelay', 'staggerDur', 'freezeDur', 'slowPct', 'windWaves', 'chain', 'burnDur', 'perfectDodgeStamina', 'healShare']);
const MULT_FIELDS = new Set(['burnMult', 'slowMult', 'freezeRadiusMult', 'frozenDmgMult', 'comboFinisher']);
/** Yalnızca kendi skill'inin tekniklerine uygulanan alanlar (toplama girmez). */
const OWN_FIELDS = new Set(['mpPct', 'cdMult', 'techRangePct']);

export function aggregateFx(states: SkillState[]): SkillFx {
  const out: any = {};
  for (const s of states) {
    const p = mergedPassive(s) as any;
    for (const [k, v] of Object.entries(p)) {
      if (OWN_FIELDS.has(k)) continue;
      if (isMapKey(k)) {
        const m = (out[k] ??= {});
        for (const [kk, n] of Object.entries(v as KindMap)) m[kk] = (m[kk] ?? 0) + (n ?? 0);
      } else if (typeof v === 'boolean') out[k] = out[k] || v;
      else if (MAX_FIELDS.has(k)) out[k] = Math.max(out[k] ?? -Infinity, v as number);
      else if (MULT_FIELDS.has(k)) out[k] = (out[k] ?? 1) * (v as number);
      else out[k] = (out[k] ?? 0) + (v as number);
    }
  }
  return out;
}

export function techniquesOf(s: SkillState): string[] {
  return activeTiers(s)
    .filter((t) => t.technique)
    .map((t) => t.technique!);
}

/** Bir sonraki tablo (ilerleme ekranı için). */
export function nextTier(s: SkillState): SkillTier | null {
  const def = SKILLS[s.id];
  if (!def) return null;
  return def.tiers.find((t) => parseSubRank(t.at) > s.rank) ?? null;
}

export function skillLabel(s: SkillState): string {
  const def = skillDef(s.id);
  return `${def.name} (${subRankToString(s.rank)})`;
}

export function skillProgressLabel(s: SkillState): string {
  if (s.rank >= SUBRANK_MAX) return '[MAX]';
  return `[${Math.floor(s.exp)}/${skillThreshold(s.rank)}]`;
}

/** Yeni EXP eşiklerine göre birikmiş EXP'yi rütbeye çevirir (kayıt göçü; artan EXP devreder). */
export function normalizeSkillExp(s: SkillState): SkillState {
  return addSkillExp(s, 0).state;
}

// ---------------------------------------------------------------- teknik gücü ve MP (S2, S4)

/** Teknik gücü: skill'in her alt kademesinde +%5 (G- ×1,0 → X- ×2,2). */
export function techniquePower(rank: SubRank): number {
  return Math.round((1 + 0.05 * Math.min(rank, SUBRANK_MAX)) * 100) / 100;
}

/** MP tabanı nadirliğe göre. */
export const MP_RARITY_BASE: Record<string, number> = { common: 3, rare: 5, epic: 8, legendary: 12, innate: 3 };
/** Yeteneğin açıldığı harfin çarpanı. */
export const MP_LETTER_MULT: Record<Letter, number> = { G: 1, F: 1.5, E: 2.5, D: 4, C: 6, B: 9, A: 14, S: 22, X: 35 };

/** Tekniğin geldiği skill ve açıldığı kademe. */
export function techniqueSource(techId: string): { skill: string; at: SubRank } | null {
  for (const def of Object.values(SKILLS)) for (const t of def.tiers) if (t.technique === techId) return { skill: def.id, at: parseSubRank(t.at) };
  return null;
}

/** Tekniğin MP'si: nadirlik tabanı × açıldığı harfin çarpanı; büyü temelli ×2. */
export function techniqueMp(techId: string): number {
  const src = techniqueSource(techId);
  const t = TECHNIQUES[techId];
  if (!src || !t) return 0;
  const base = MP_RARITY_BASE[SKILLS[src.skill].rarity] * MP_LETTER_MULT[subRankLetter(src.at)];
  return Math.round(base * (t.spell ? 2 : 1));
}

// veri modülündeki elle yazılmamış mp alanlarını formülle doldur
for (const t of Object.values(TECHNIQUES)) t.mp = techniqueMp(t.id);

/** Skill'in pasif "MP -%x" indirimi sonrası gerçek MP. */
export function techniqueCost(techId: string, owner: SkillState | null): number {
  const base = techniqueMp(techId);
  const pct = owner ? mergedPassive(owner).mpPct ?? 0 : 0;
  return Math.max(1, Math.round(base * (1 + pct)));
}

/** Bekleme süresi (skill'in "bekleme yarıya" pasifi dahil). */
export function techniqueCooldown(techId: string, owner: SkillState | null): number {
  const t = TECHNIQUES[techId];
  const m = owner ? mergedPassive(owner).cdMult ?? 1 : 1;
  return Math.round(t.cooldown * m * 100) / 100;
}

/**
 * Kullanım EXP'si. Hedef ne kadar güçlüyse o kadar çok verir; çok zayıf hedef çok az,
 * boşa kullanım (hedef yok) hiç vermez. learning: Divine Öğrenme çarpanı.
 */
export function usageExp(base: number, targetLevel: number | null, userLevel: number, learning = 1): number {
  if (targetLevel === null) return 0;
  const d = targetLevel - userLevel;
  let f: number;
  if (d <= -3) f = 0.05;
  else if (d < 0) f = 0.35 + 0.2 * (d + 2); // -2 → 0.35, -1 → 0.55
  else f = 1 + 0.6 * d; // 0 → 1, 1 → 1.6, 2 → 2.2
  return base * Math.min(4, f) * learning;
}

/** Başarı EXP'si: o skill ile senden güçlü bir düşmanı yenmek. */
export function achievementExp(targetLevel: number, userLevel: number, learning = 1, boss = false): number {
  const d = targetLevel - userLevel;
  if (d < 1) return 0;
  return 6 * (d + 1) * (d + 1) * (boss ? 2 : 1) * learning;
}

// ---------------------------------------------------------------- Haftalık sınır

export const DAYS_PER_WEEK = 7;

export function weekOfDay(day: number): number {
  return Math.floor((day - 1) / DAYS_PER_WEEK);
}

/** Bu hafta yeni skill öğrenilebilir mi? (Sistem Teklifi ve öğretmenler: oyun içi haftada en fazla 1) */
export function canLearnThisWeek(lastLearnWeek: number | null, day: number): boolean {
  return lastLearnWeek === null || lastLearnWeek < weekOfDay(day);
}

// ---------------------------------------------------------------- Sistem Teklifi (S3)

export type OfferRarity = 'common' | 'rare' | 'epic' | 'legendary';
export const OFFER_RARITIES: OfferRarity[] = ['common', 'rare', 'epic', 'legendary'];
export type OfferSp = 1 | 2 | 3;

/** Kart başına nadirlik oranları (Sıradan, Nadir, Epik, Efsanevi). */
export const OFFER_ODDS: Record<OfferSp, [number, number, number, number]> = {
  1: [0.8, 0.16, 0.03, 0.01],
  2: [0.5, 0.36, 0.11, 0.03],
  3: [0.2, 0.45, 0.27, 0.08],
};

export const OFFER_NAMES: Record<OfferSp, string> = { 1: 'Basic chance', 2: 'Medium chance', 3: 'High chance' };

export function rollRarity(sp: OfferSp, rand: () => number = Math.random): OfferRarity {
  const odds = OFFER_ODDS[sp];
  let x = rand();
  for (let i = 0; i < odds.length; i++) {
    if (x < odds[i]) return OFFER_RARITIES[i];
    x -= odds[i];
  }
  return OFFER_RARITIES[odds.length - 1];
}

export interface OfferResult {
  /** Kart sayısı = harcanan SP. null: boş kart ("Sistem uygun skill bulamadı"). */
  cards: (SkillDef | null)[];
  /** Her kartın çekilen nadirliği (boş havuzda bir alta inmeden önceki). */
  rolled: OfferRarity[];
  /** Boş kartların SP iadesi. */
  refund: number;
}

/**
 * Teklif: her kart nadirliğini ayrı çeker. Aynı teklifte aynı skill iki kez çıkmaz. Boş havuz yukarı kaymaz: çekilen
 * nadirlikte öğrenilmemiş skill kalmadıysa kart bir alt nadirlikten yeniden çekilir; sıradan da bitmişse boş gelir ve
 * o kartın SP'si iade edilir.
 */
export function rollOfferCards(sp: OfferSp, owned: string[], rand: () => number = Math.random): OfferResult {
  const cards: (SkillDef | null)[] = [];
  const rolled: OfferRarity[] = [];
  const taken = new Set(owned);
  let refund = 0;
  for (let k = 0; k < sp; k++) {
    const r = rollRarity(sp, rand);
    rolled.push(r);
    let pick: SkillDef | null = null;
    for (let i = OFFER_RARITIES.indexOf(r); i >= 0 && !pick; i--) {
      const pool = Object.values(SKILLS).filter((s) => s.rarity === OFFER_RARITIES[i] && !taken.has(s.id));
      if (pool.length) pick = pool[Math.floor(rand() * pool.length)];
    }
    if (pick) taken.add(pick.id);
    else refund++;
    cards.push(pick);
  }
  return { cards, rolled, refund };
}

// ---------------------------------------------------------------- yetenek slotu (S5)

/** Açık yetenek slotu sayısı; 2. slot kodda hazır, kilitli ("Yakında"). */
export const SKILL_SLOTS_OPEN = 1;
export const SKILL_SLOTS_TOTAL = 2;

/** Joseph'in sahip olduğu aktif yetenekler (skill sırasıyla). */
export function ownedTechniques(states: SkillState[]): string[] {
  const out: string[] = [];
  for (const s of states) for (const t of techniquesOf(s)) if (!out.includes(t)) out.push(t);
  return out;
}

/** Slotları geçerli tut: sahip olunmayan/kaldırılmış teknikler çıkar, uzunluk SKILL_SLOTS_TOTAL, kilitli slot boş. */
export function sanitizeSlots(slots: (string | null)[] | undefined, owned: string[]): (string | null)[] {
  const out: (string | null)[] = [];
  for (let i = 0; i < SKILL_SLOTS_TOTAL; i++) {
    const t = slots?.[i] ?? null;
    out.push(i < SKILL_SLOTS_OPEN && t && owned.includes(t) && TECHNIQUES[t] && !out.includes(t) ? t : null);
  }
  return out;
}

/** Takılı (kullanılabilir) yetenekler. */
export function equippedTechniques(slots: (string | null)[]): string[] {
  return slots.slice(0, SKILL_SLOTS_OPEN).filter((t): t is string => !!t && !!TECHNIQUES[t]);
}
