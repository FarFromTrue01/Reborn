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

export const STAT_POINTS_PER_LEVEL = 6;
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

export const HP_BASE = 5;
export const HP_PER_LEVEL = 8;
export const HP_PER_VIT = 8;

/** Bonussuz HP tabanı: 5 + 8×Level + 8×VIT (canavarlar bunu kendi hpMod'larıyla ölçekler). */
export function baseHP(level: number, vit: number): number {
  return HP_BASE + HP_PER_LEVEL * level + HP_PER_VIT * vit;
}

/** Max HP = 5 + 8×Level + 8×VIT + bonuslar */
export function maxHP(level: number, vit: number, b: PoolBonuses = {}): number {
  const base = baseHP(level, vit) + (b.hpFlat ?? 0);
  return Math.max(1, Math.floor(base * (1 + (b.hpPct ?? 0))));
}

/** Max MP = 1×Level + 3×MNA + bonuslar */
export function maxMP(level: number, mna: number, b: PoolBonuses = {}): number {
  const base = level + 3 * mna + (b.mpFlat ?? 0);
  return Math.max(0, Math.floor(base * (1 + (b.mpPct ?? 0))));
}

/** Dayanıklılık barı = 50 + 3×VIT + 2×AGI */
export function maxStamina(vit: number, agi: number, b: PoolBonuses = {}): number {
  return 50 + 3 * vit + 2 * agi + (b.staminaFlat ?? 0);
}

// ---------------------------------------------------------------- Stat etkileri

/** STR: fiziksel hasar ×(1 + 0.08×STR) */
export function strDamageMult(str: number): number {
  return 1 + 0.08 * str;
}

/** AGI: hareket hızı puan başına +%1,5 (en fazla +%60) */
export function agiMoveMult(agi: number): number {
  return 1 + Math.min(0.6, 0.015 * agi);
}

/** DEX: saldırı hızı puan başına +%2 (en fazla +%70) */
export function dexAttackSpeedMult(dex: number): number {
  return 1 + Math.min(0.7, 0.02 * dex);
}

export const BASE_CRIT = 0.05;
export const MAX_CRIT = 0.6;
export const CRIT_MULT = 2;
export const WEAK_POINT_MULT = 1.5;

/** Kritik şansı: taban %5 + DEX %0,5/puan (≤%20) + LUK %0,6/puan (≤%10) + bonus, toplam ≤ %60 */
export function critChance(dex: number, luk: number, bonus = 0): number {
  const c = BASE_CRIT + Math.min(0.2, 0.005 * dex) + Math.min(0.1, 0.006 * luk) + bonus;
  return Math.min(MAX_CRIT, c);
}

/** LUK: şans eseri ıskalatma +%0.5 (en fazla +%10) */
export function luckyMissChance(luk: number): number {
  return Math.min(0.1, 0.005 * luk);
}

/** LUK: drop şansı ×(1 + 0.06×LUK) */
export function dropChanceMult(luk: number): number {
  return 1 + 0.06 * luk;
}

/** MNA: MP yenilenmesi puan başına +%3 (0.9.0) */
export function mnaRegenMult(mna: number): number {
  return 1 + 0.03 * mna;
}

/** Büyü gücü: INT puan başına +%6, MNA puan başına +%1 */
export function spellPowerMult(int: number, mna: number): number {
  return 1 + 0.06 * int + 0.01 * mna;
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

/** Fiziksel hasar = Silah × (1+0.08×STR) × skill × trait × kritik × zayıf nokta */
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

/** Büyü hasarı = Büyü tabanı × (1 + 0.06×INT + 0.01×MNA) × skill çarpanları */
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

/** En düşük hasar: isabet eden vuruş 0,1'in altına inmez ("en az 1" tabanı yok). */
export const MIN_DAMAGE = 0.1;

/**
 * Hasarı biçimine yuvarlar: 10'un altı bir ondalık (0,5 · 1,0 · 3,7), 10 ve üstü tam sayı (14 · 27 · 103).
 * 9,96 gibi değerler 10'a yuvarlanır ve tam sayı kuralına geçer.
 */
export function roundDamage(x: number): number {
  if (!(x > 0)) return MIN_DAMAGE;
  const r = Math.round(x * 10) / 10;
  if (r >= 10) return Math.round(x);
  return Math.max(MIN_DAMAGE, r);
}

/**
 * Hasar sonrası HP: bir ondalığa sabitlenir ki 1 − 0,3 − 0,7 gibi kayan nokta artıkları
 * yaratığı 0,0000001 HP ile hayatta bırakmasın. En az 0.
 */
export function applyDamage(hp: number, damage: number): number {
  return Math.max(0, Math.round((hp - damage) * 10) / 10);
}

export const UNARMED_DAMAGE: [number, number] = [1, 1];

/** Silah taban hasarı aralıkları (rütbeye göre). Yumruk hariç hepsi 0.3.x'in iki katı. */
export const WEAPON_DAMAGE_BY_RANK: Record<string, [number, number]> = {
  G: [2, 4],
  F: [4, 10],
  E: [10, 20],
  D: [20, 40],
  C: [40, 80],
  B: [80, 150],
  A: [150, 300],
  S: [300, 600],
  X: [600, 1200],
};

// ---------------------------------------------------------------- Yenilenme

/** Savaş dışı saniyelik HP yenilenmesi (normal bir insan = 1x adaptasyon). */
export function hpRegenPerSec(maxHp: number, adaptation: number, inCombat: boolean, bonusPct = 0): number {
  const base = 0.05 + 0.01 * maxHp;
  return base * adaptation * (1 + bonusPct) * (inCombat ? 0.5 : 1);
}

/**
 * MP yenilenmesi (0.9.0, S4): saniyede 0,02 + max MP × 0,005; MNA puan başına +%3, Adaptasyon ile çarpılır,
 * savaşta ×0,3.
 */
export function mpRegenPerSec(maxMp: number, mna: number, adaptation: number, inCombat: boolean): number {
  if (maxMp <= 0) return 0;
  const base = 0.02 + 0.005 * maxMp;
  return base * (1 + 0.03 * mna) * adaptation * (inCombat ? 0.3 : 1);
}

/** AGI dayanıklılık yenilenmesini puan başına %1 artırır. */
export function staminaRegenPerSec(agi: number, adaptation: number, inCombat: boolean): number {
  const base = 18 * (1 + 0.01 * agi);
  return base * adaptation * (inCombat ? 0.5 : 1);
}
