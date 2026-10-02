// Elonth'un temel formülleri. Saf fonksiyonlar, birim testleri tests/formulas.test.ts.

export const STAT_KEYS = ['STR', 'VIT', 'AGI', 'DEX', 'MNA', 'INT', 'LUK'] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number>;

export function zeroStats(): Stats {
  return { STR: 0, VIT: 0, AGI: 0, DEX: 0, MNA: 0, INT: 0, LUK: 0 };
}

export function addStats(a: Stats, b: Partial<Stats>): Stats {
  const r = { ...a };
  for (const k of STAT_KEYS) r[k] += b[k] ?? 0;
  return r;
}

// ---------------------------------------------------------------- Level / EXP

/** Level n'den n+1'e geçmek için gereken EXP: 100 × (n+1). */
export function expToNext(level: number): number {
  return 100 * (level + 1);
}

export const STAT_POINTS_PER_LEVEL = 4;
export const SP_PER_LEVEL = 1;

export interface LevelGain {
  level: number;
  exp: number;
  levelsGained: number;
}

/** EXP ekler, gerekirse level atlatır. */
export function addExp(level: number, exp: number, gain: number): LevelGain {
  let l = level;
  let e = exp + Math.max(0, gain);
  let n = 0;
  while (e >= expToNext(l)) {
    e -= expToNext(l);
    l++;
    n++;
  }
  return { level: l, exp: e, levelsGained: n };
}

// ---------------------------------------------------------------- HP / MP / Dayanıklılık

export interface PoolBonuses {
  hpFlat?: number;
  hpPct?: number; // 0.05 = +%5
  mpFlat?: number;
  mpPct?: number;
  staminaFlat?: number;
}

/** Max HP = 5 + 5×Level + 5×VIT + bonuslar */
export function maxHP(level: number, vit: number, b: PoolBonuses = {}): number {
  const base = 5 + 5 * level + 5 * vit + (b.hpFlat ?? 0);
  return Math.max(1, Math.floor(base * (1 + (b.hpPct ?? 0))));
}

/** Max MP = 1×Level + 2×MNA + bonuslar */
export function maxMP(level: number, mna: number, b: PoolBonuses = {}): number {
  const base = level + 2 * mna + (b.mpFlat ?? 0);
  return Math.max(0, Math.floor(base * (1 + (b.mpPct ?? 0))));
}

/** Dayanıklılık barı = 50 + 3×VIT + 2×AGI */
export function maxStamina(vit: number, agi: number, b: PoolBonuses = {}): number {
  return 50 + 3 * vit + 2 * agi + (b.staminaFlat ?? 0);
}

// ---------------------------------------------------------------- Stat etkileri

/** STR: fiziksel hasar ×(1 + 0.05×STR) */
export function strDamageMult(str: number): number {
  return 1 + 0.05 * str;
}

/** AGI: hareket hızı puan başına +%1 (en fazla +%50) */
export function agiMoveMult(agi: number): number {
  return 1 + Math.min(0.5, 0.01 * agi);
}

/** DEX: saldırı hızı puan başına +%1.5 (en fazla +%60) */
export function dexAttackSpeedMult(dex: number): number {
  return 1 + Math.min(0.6, 0.015 * dex);
}

export const BASE_CRIT = 0.05;
export const MAX_CRIT = 0.6;
export const CRIT_MULT = 2;
export const WEAK_POINT_MULT = 1.5;

/** Kritik şansı: taban %5 + DEX (≤%20) + LUK (≤%10) + bonus, toplam ≤ %60 */
export function critChance(dex: number, luk: number, bonus = 0): number {
  const c = BASE_CRIT + Math.min(0.2, 0.005 * dex) + Math.min(0.1, 0.005 * luk) + bonus;
  return Math.min(MAX_CRIT, c);
}

/** LUK: şans eseri ıskalatma +%0.5 (en fazla +%10) */
export function luckyMissChance(luk: number): number {
  return Math.min(0.1, 0.005 * luk);
}

/** LUK: drop şansı ×(1 + 0.05×LUK) */
export function dropChanceMult(luk: number): number {
  return 1 + 0.05 * luk;
}

/** MNA: MP yenilenmesi puan başına +%5 */
export function mnaRegenMult(mna: number): number {
  return 1 + 0.05 * mna;
}

/** Büyü gücü: INT puan başına +%5, MNA puan başına +%1 */
export function spellPowerMult(int: number, mna: number): number {
  return 1 + 0.05 * int + 0.01 * mna;
}

/** INT: büyü alanı puan başına +%3 (en fazla +%100) */
export function spellAreaMult(int: number): number {
  return 1 + Math.min(1, 0.03 * int);
}

// ---------------------------------------------------------------- Hasar

export interface PhysicalHit {
  weaponBase: number; // silahın taban hasarı (aralıktan seçilmiş değer)
  str: number;
  skillMult?: number;
  traitMult?: number;
  crit?: boolean;
  weakPoint?: boolean; // zayıf nokta / arkadan saldırı
}

/** Fiziksel hasar = Silah × (1+0.05×STR) × skill × trait × kritik × zayıf nokta */
export function physicalDamage(h: PhysicalHit): number {
  return (
    h.weaponBase *
    strDamageMult(h.str) *
    (h.skillMult ?? 1) *
    (h.traitMult ?? 1) *
    (h.crit ? CRIT_MULT : 1) *
    (h.weakPoint ? WEAK_POINT_MULT : 1)
  );
}

export interface SpellHit {
  spellBase: number;
  int: number;
  mna: number;
  skillMult?: number;
  traitMult?: number;
  crit?: boolean;
  weakPoint?: boolean;
}

/** Büyü hasarı = Büyü tabanı × (1 + 0.05×INT + 0.01×MNA) × skill çarpanları */
export function spellDamage(h: SpellHit): number {
  return (
    h.spellBase *
    spellPowerMult(h.int, h.mna) *
    (h.skillMult ?? 1) *
    (h.traitMult ?? 1) *
    (h.crit ? CRIT_MULT : 1) *
    (h.weakPoint ? WEAK_POINT_MULT : 1)
  );
}

/** Hasar azaltma = DEF / (DEF + 20 + 5 × saldırganın Level'ı), en fazla %80 */
export function damageReduction(def: number, attackerLevel: number): number {
  if (def <= 0) return 0;
  return Math.min(0.8, def / (def + 20 + 5 * attackerLevel));
}

/**
 * Savunanın gördüğü son hasar (henüz yuvarlanmamış).
 * enduranceDivisor: Divine Dayanıklılık gibi "aldığı hasar bu katsayıya bölünür" çarpanları.
 */
export function mitigatedDamage(raw: number, def: number, attackerLevel: number, enduranceDivisor = 1): number {
  return (raw * (1 - damageReduction(def, attackerLevel))) / enduranceDivisor;
}

/**
 * Hasarı tamsayıya çevirir: isabet eden her vuruş en az 1 hasar verir,
 * kesirli kısım olasılıkla yuvarlanır (1.3 → %70 ihtimalle 1, %30 ihtimalle 2).
 */
export function roundDamage(x: number, rand: () => number = Math.random): number {
  if (x <= 1) return 1;
  const f = Math.floor(x);
  return f + (rand() < x - f ? 1 : 0);
}

export const UNARMED_DAMAGE: [number, number] = [1, 1];

/** Silah taban hasarı aralıkları (rütbeye göre). */
export const WEAPON_DAMAGE_BY_RANK: Record<string, [number, number]> = {
  G: [1, 2],
  F: [2, 5],
  E: [5, 10],
  D: [10, 20],
  C: [20, 40],
  B: [40, 75],
  A: [75, 150],
  S: [150, 300],
  X: [300, 600],
};

// ---------------------------------------------------------------- Yenilenme

/** Savaş dışı saniyelik HP yenilenmesi (normal bir insan = 1x adaptasyon). */
export function hpRegenPerSec(maxHp: number, adaptation: number, inCombat: boolean, bonusPct = 0): number {
  const base = 0.05 + 0.01 * maxHp;
  return base * adaptation * (1 + bonusPct) * (inCombat ? 0.5 : 1);
}

export function mpRegenPerSec(maxMp: number, mna: number, adaptation: number, inCombat: boolean): number {
  if (maxMp <= 0) return 0;
  const base = 0.05 + 0.02 * maxMp;
  return base * mnaRegenMult(mna) * adaptation * (inCombat ? 0.5 : 1);
}

/** AGI dayanıklılık yenilenmesini puan başına %1 artırır. */
export function staminaRegenPerSec(agi: number, adaptation: number, inCombat: boolean): number {
  const base = 18 * (1 + 0.01 * agi);
  return base * adaptation * (inCombat ? 0.5 : 1);
}
