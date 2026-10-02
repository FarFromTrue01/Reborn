import { parseSubRank, skillThreshold, SUBRANK_MAX, subRankToString, type SubRank } from './ranks';
import type { SkillDef, SkillPassive, SkillState, SkillTier } from './types';
import { SKILLS, skillDef, OFFER_COST } from '../data/skills';

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
  if (gain <= 0 || st.rank >= SUBRANK_MAX) return { state: st, rankUps, unlocked };
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

/** Pasifler: en yüksek açılmış pasif tablo geçerlidir (tablolar kümülatif yazılmıştır). */
export function currentPassive(s: SkillState): SkillPassive {
  const tiers = activeTiers(s).filter((t) => t.passive);
  return tiers.length ? tiers[tiers.length - 1].passive! : {};
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

/** Bu hafta yeni skill öğrenilebilir mi? (oyun içi haftada en fazla 1) */
export function canLearnThisWeek(lastLearnWeek: number | null, day: number): boolean {
  return lastLearnWeek === null || lastLearnWeek < weekOfDay(day);
}

// ---------------------------------------------------------------- Sistem Teklifi

export type OfferRarity = 'common' | 'rare' | 'legendary';

export function offerCost(r: OfferRarity): number {
  return OFFER_COST[r];
}

/** Sahip olunmayan, o nadirlikteki skill'lerden en fazla 3 rastgele öneri. */
export function rollOffer(rarity: OfferRarity, owned: string[], rand: () => number = Math.random): SkillDef[] {
  const pool = Object.values(SKILLS).filter((s) => s.rarity === rarity && !owned.includes(s.id));
  const picks: SkillDef[] = [];
  const p = [...pool];
  while (picks.length < 3 && p.length) {
    const i = Math.floor(rand() * p.length);
    picks.push(p.splice(i, 1)[0]);
  }
  return picks;
}
