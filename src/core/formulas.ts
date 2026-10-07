// Elonth'un temel formülleri. Saf fonksiyonlar, birim testleri tests/formulas.test.ts.

/**
 * 0.10.0 (B9): beş stat — DEX AGI'ye, MNA INT'e birleşti. Etkilerin sayıları `STAT_RULES`'ta; Status'taki ipuçları
 * (MenuScene.statHint) bu sabitleri birebir gösterir.
 */
export const STAT_KEYS = ['STR', 'VIT', 'AGI', 'INT', 'LUK'] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number>;

export function zeroStats(): Stats {
  return { STR: 0, VIT: 0, AGI: 0, INT: 0, LUK: 0 };
}

export function addStats(a: Stats, b: Partial<Stats>): Stats {
  const r = { ...a };
  for (const k of STAT_KEYS) r[k] += b[k] ?? 0;
  return r;
}

/** Stat başına etkiler (oranlar: 0.08 = %8; `Max` alanları tavan). */
export const STAT_RULES = {
  STR: { dmgPct: 0.08 },
  VIT: { hpPct: 0.08, stamina: 5, statusDurPct: 0.02, statusDurMax: 0.4 },
  AGI: {
    movePct: 0.01, moveMax: 0.5, atkSpdPct: 0.015, atkSpdMax: 0.6, critPct: 0.004, critMax: 0.2, stamina: 3,
    staminaRegenPct: 0.01, dodgeCostPct: 0.01, dodgeCostMax: 0.3, dodgeWindowPct: 0.01, dodgeWindowMax: 0.3,
  },
  INT: { mp: 3, mpRegenPct: 0.03, spellPct: 0.06, areaPct: 0.03, areaMax: 1, skillExpPct: 0.015, skillExpMax: 0.5 },
  LUK: { critPct: 0.006, critMax: 0.1, missPct: 0.005, missMax: 0.1, dropPct: 0.06, doublePct: 0.01, doubleMax: 0.2 },
} as const;

// ---------------------------------------------------------------- Level / EXP

/** Level n'den n+1'e geçmek için gereken EXP: 100 × (n+1). */
export function expToNext(level: number): number {
  return 100 * (level + 1);
}

/** 0.10.0: level başına 4 stat puanı (eskiden 6). */
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

/** 0.10.0: HP tabanı 10 (eskiden 5), level başına 8. VIT artık yüzdeli çarpan. */
export const HP_BASE = 10;
export const HP_PER_LEVEL = 8;
export const STAMINA_BASE = 50;

/** Bir ondalığa yuvarla (yaratık ve Joseph HP'leri: 1,5 HP'li fare 2'ye yuvarlanmaz). */
export function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

/** Max HP = (10 + 8×Level + düz bonuslar) × (1 + 0,08×VIT) × (1 + yüzde bonuslar), bir ondalık. */
export function maxHP(level: number, vit: number, b: PoolBonuses = {}): number {
  const base = HP_BASE + HP_PER_LEVEL * level + (b.hpFlat ?? 0);
  return Math.max(1, round1(base * (1 + STAT_RULES.VIT.hpPct * vit) * (1 + (b.hpPct ?? 0))));
}

/** Max MP = Level + 3×INT + bonuslar */
export function maxMP(level: number, int: number, b: PoolBonuses = {}): number {
  const base = level + STAT_RULES.INT.mp * int + (b.mpFlat ?? 0);
  return Math.max(0, Math.floor(base * (1 + (b.mpPct ?? 0))));
}

/** Dayanıklılık = 50 + 5×VIT + 3×AGI + bonuslar */
export function maxStamina(vit: number, agi: number, b: PoolBonuses = {}): number {
  return STAMINA_BASE + STAT_RULES.VIT.stamina * vit + STAT_RULES.AGI.stamina * agi + (b.staminaFlat ?? 0);
}

// ---------------------------------------------------------------- Stat etkileri

/** STR: fiziksel hasar ×(1 + 0.08×STR), tavansız */
export function strDamageMult(str: number): number {
  return 1 + STAT_RULES.STR.dmgPct * str;
}

/** VIT: durum etkilerinin (zehir, kanama, yanma…) süresi puan başına −%2 (en fazla −%40). */
export function statusDurationMult(vit: number): number {
  return 1 - Math.min(STAT_RULES.VIT.statusDurMax, STAT_RULES.VIT.statusDurPct * vit);
}

/** AGI: hareket hızı puan başına +%1 (en fazla +%50) */
export function agiMoveMult(agi: number): number {
  return 1 + Math.min(STAT_RULES.AGI.moveMax, STAT_RULES.AGI.movePct * agi);
}

/** AGI: saldırı hızı puan başına +%1,5 (en fazla +%60) */
export function agiAttackSpeedMult(agi: number): number {
  return 1 + Math.min(STAT_RULES.AGI.atkSpdMax, STAT_RULES.AGI.atkSpdPct * agi);
}

/** AGI: kaçışın dayanıklılık bedeli puan başına −%1 (en fazla −%30): çarpan. */
export function agiDodgeCostMult(agi: number): number {
  return 1 - Math.min(STAT_RULES.AGI.dodgeCostMax, STAT_RULES.AGI.dodgeCostPct * agi);
}

/** AGI: kusursuz kaçış penceresi puan başına +%1 (en fazla +%30): çarpan. */
export function agiDodgeWindowMult(agi: number): number {
  return 1 + Math.min(STAT_RULES.AGI.dodgeWindowMax, STAT_RULES.AGI.dodgeWindowPct * agi);
}

export const BASE_CRIT = 0.05;
export const MAX_CRIT = 0.6;
export const CRIT_MULT = 2;
export const WEAK_POINT_MULT = 1.5;

/** Kritik şansı: taban %5 + AGI %0,4/puan (≤%20) + LUK %0,6/puan (≤%10) + bonus, toplam ≤ %60 */
export function critChance(agi: number, luk: number, bonus = 0): number {
  const c = BASE_CRIT + Math.min(STAT_RULES.AGI.critMax, STAT_RULES.AGI.critPct * agi) + Math.min(STAT_RULES.LUK.critMax, STAT_RULES.LUK.critPct * luk) + bonus;
  return Math.min(MAX_CRIT, c);
}

/** LUK: şans eseri ıskalatma +%0,5 (en fazla %10) */
export function luckyMissChance(luk: number): number {
  return Math.min(STAT_RULES.LUK.missMax, STAT_RULES.LUK.missPct * luk);
}

/** LUK: ganimet şansı ×(1 + 0.06×LUK) */
export function dropChanceMult(luk: number): number {
  return 1 + STAT_RULES.LUK.dropPct * luk;
}

/** LUK: toplamada çift ürün şansı +%1 (en fazla %20) */
export function gatherDoubleChance(luk: number): number {
  return Math.min(STAT_RULES.LUK.doubleMax, STAT_RULES.LUK.doublePct * luk);
}

/** INT: MP yenilenmesi puan başına +%3 */
export function intRegenMult(int: number): number {
  return 1 + STAT_RULES.INT.mpRegenPct * int;
}

/** Büyü gücü: INT puan başına +%6 */
export function spellPowerMult(int: number): number {
  return 1 + STAT_RULES.INT.spellPct * int;
}

/** INT: büyü alanı puan başına +%3 (en fazla +%100) */
export function spellAreaMult(int: number): number {
  return 1 + Math.min(STAT_RULES.INT.areaMax, STAT_RULES.INT.areaPct * int);
}

/** INT: skill EXP kazancı puan başına +%1,5 (en fazla +%50) */
export function skillExpMult(int: number): number {
  return 1 + Math.min(STAT_RULES.INT.skillExpMax, STAT_RULES.INT.skillExpPct * int);
}

/**
 * LUK'un sonucu değiştirip değiştirmediği (B9, "Şans!" yazısı): zar `roll` (0..1), LUK'suz şans `base`, LUK'lu şans
 * `withLuck`. 'luck': yalnızca LUK'un eklediği aralığa düştü; 'hit': LUK olmadan da tutardı; 'miss': tutmadı.
 */
export function luckOutcome(roll: number, base: number, withLuck: number): 'luck' | 'hit' | 'miss' {
  if (roll < Math.min(1, base)) return 'hit';
  if (roll < Math.min(1, withLuck)) return 'luck';
  return 'miss';
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
  skillMult?: number;
  traitMult?: number;
  crit?: boolean;
  weakPoint?: boolean;
}

/** Büyü hasarı = Büyü tabanı × (1 + 0.06×INT) × skill çarpanları */
export function spellDamage(h: SpellHit): number {
  return (
    h.spellBase *
    spellPowerMult(h.int) *
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
 * MP yenilenmesi (0.9.0, S4): saniyede 0,02 + max MP × 0,005; INT puan başına +%3 (0.10.0: eskiden MNA), Adaptasyon
 * ile çarpılır, savaşta ×0,3.
 */
export function mpRegenPerSec(maxMp: number, int: number, adaptation: number, inCombat: boolean): number {
  if (maxMp <= 0) return 0;
  const base = 0.02 + 0.005 * maxMp;
  return base * intRegenMult(int) * adaptation * (inCombat ? 0.3 : 1);
}

/** AGI dayanıklılık yenilenmesini puan başına %1 artırır. */
export function staminaRegenPerSec(agi: number, adaptation: number, inCombat: boolean): number {
  const base = 18 * (1 + STAT_RULES.AGI.staminaRegenPct * agi);
  return base * adaptation * (inCombat ? 0.5 : 1);
}

// ---------------------------------------------------------------- A7.11: iki ondalık
/** İki ondalığa yuvarla (kayan nokta birikmesini keser: 3.7375000000000016 → 3.74). */
export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/**
 * Yenilenme adımı (A7.11): her karedeki küçük artışlar biriktirilir, değere yalnızca 0,01'lik adımlarla eklenir —
 * HP/MP/dayanıklılık hep en çok iki ondalıklı kalır. Tavandayken birikim sıfırlanır.
 */
export function regenStep(cur: number, max: number, gain: number, acc: number): { value: number; acc: number } {
  if (cur >= max) return { value: Math.min(cur, max), acc: 0 };
  let a = acc + Math.max(0, gain);
  const step = Math.floor(a * 100 + 1e-9) / 100;
  a -= step;
  const value = Math.min(max, round2(cur + step));
  return { value, acc: value >= max ? 0 : a };
}
