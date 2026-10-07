// Divine Paladin (X) — Joseph'e özel gizli trait.

export const DIVINE_STATS = ['power', 'endurance', 'speed', 'learning', 'adaptation'] as const;
export type DivineStat = (typeof DIVINE_STATS)[number];

export const DIVINE_STAT_NAMES: Record<DivineStat, string> = {
  power: 'Güç',
  endurance: 'Dayanıklılık',
  speed: 'Hız',
  learning: 'Öğrenme',
  adaptation: 'Adaptasyon',
};

/**
 * Katsayı = 0.5 × 1.20^L × 1.32^floor(L/3).
 * 1.20³ × 1.32 = 1.15³ × 1.5 olduğundan 3'ün katı her levelde eski formülle (1.15 / 1.5) aynı değere varılır;
 * aradaki leveller artık boş geçmez.
 */
export function divineCoefficient(level: number): number {
  return 0.5 * Math.pow(1.2, level) * Math.pow(1.32, Math.floor(level / 3));
}

export const ADAPTATION_CAP = 5;
export const MOVE_SPEED_CAP = 1.6;
export const DEBUFF_REDUCTION_CAP = 0.75;

/**
 * Stat tabanları: Hız, Dayanıklılık ve Adaptasyon 0,75'in altına inmez (0.8.0: Hız ve Dayanıklılık 1 → 0,75; Hız
 * saldırı hızını da çarpar, fareler fazla zararsızdı). Güç ve Öğrenme ham katsayıdır. Level 3'ten (katsayı 1,14)
 * itibaren beşi de aynı eğride ilerler.
 */
export const DIVINE_STAT_FLOOR: Record<DivineStat, number> = {
  power: 0,
  endurance: 0.75,
  speed: 0.75,
  learning: 0,
  adaptation: 0.75,
};

export function divineStat(stat: DivineStat, level: number): number {
  const c = Math.max(DIVINE_STAT_FLOOR[stat], divineCoefficient(level));
  if (stat === 'adaptation') return Math.min(ADAPTATION_CAP, c);
  return c;
}

/** Level n'den n+1'e: 500 × (n+1) */
export function divineExpToNext(level: number): number {
  return 500 * (level + 1);
}

export function isAwakeningLevel(level: number): boolean {
  return level > 0 && level % 3 === 0;
}

/**
 * Öldürme EXP oranı: o levelin EXP gereksiniminin yüzdesi.
 * d = yaratığın leveli − Joseph'in NORMAL leveli.
 */
export function challengeRate(d: number): number {
  // 0.11.0 (C10): oranlar ÷3 civarı (Divine başlangıçta normal levelden hızlı ilerliyordu)
  if (d <= -3) return 0;
  if (d === -2) return 0.001;
  if (d === -1) return 0.003;
  if (d === 0) return 0.007;
  if (d === 1) return 0.013;
  if (d === 2) return 0.027;
  if (d === 3) return 0.05;
  return 0.083;
}

/** Divine levelle azalma: her 5 levelde ödül oranı yarıya iner. L = Joseph'in DIVINE leveli. */
export function challengeDecay(divineLevel: number): number {
  return Math.pow(0.5, divineLevel / 5);
}

export const BOSS_CHALLENGE_MULT = 3;

/**
 * Meydan okuma EXP'si (yuvarlanmamış): oran(d) × divineExpToNext(L) × 0.5^(L/5), boss ×3.
 * d normal levelle, azalma divine levelle hesaplanır.
 */
export function challengeExp(enemyLevel: number, playerLevel: number, divineLevel: number, boss = false): number {
  const rate = challengeRate(enemyLevel - playerLevel);
  return rate * divineExpToNext(divineLevel) * challengeDecay(divineLevel) * (boss ? BOSS_CHALLENGE_MULT : 1);
}

/** Seri bonusu: önceki art arda anlamlı zafer başına +%10, en fazla +%50. */
export function streakMultiplier(previousStreak: number): number {
  return 1 + Math.min(0.5, 0.1 * Math.max(0, previousStreak));
}

/** Son öldürmeden bu kadar saniye geçerse seri sıfırlanır. */
export const STREAK_TIMEOUT_SEC = 30;

export function streakExpired(secondsSinceKill: number): boolean {
  return secondsSinceKill > STREAK_TIMEOUT_SEC;
}

/** Meydan okuma + seri bonusu, tam sayı. Oranı 0 olmayan her zafer en az 1 verir. */
export function victoryDivineExp(enemyLevel: number, playerLevel: number, divineLevel: number, boss: boolean, previousStreak: number): number {
  if (challengeRate(enemyLevel - playerLevel) === 0) return 0;
  const base = challengeExp(enemyLevel, playerLevel, divineLevel, boss);
  return Math.max(1, Math.round(base * streakMultiplier(previousStreak)));
}

/** Zafer anlamlı mı (seri için)? d ≥ 0 */
export function isMeaningfulVictory(enemyLevel: number, playerLevel: number): boolean {
  return enemyLevel - playerLevel >= 0;
}

/**
 * Antrenman: noktaya özgü sabit aralık (data/props.ts → TRAINING_SPOTS), performansa (0..1) göre.
 * Divine leveline bağlı değildir: bir antrenman alanı zamanla eskir, oyuncu yeni yerler arar.
 */
export function trainingExp(range: [number, number], performance: number): number {
  const p = Math.max(0, Math.min(1, performance));
  return Math.round(range[0] + (range[1] - range[0]) * p);
}

export const TRAINING_SESSIONS_PER_DAY = 3;

export interface DivineGain {
  level: number;
  exp: number;
  awakenings: number[]; // ulaşılan awakening level'ları
}

export function addDivineExp(level: number, exp: number, gain: number): DivineGain {
  let l = level;
  let e = exp + Math.max(0, gain);
  const aw: number[] = [];
  while (e >= divineExpToNext(l)) {
    e -= divineExpToNext(l);
    l++;
    if (isAwakeningLevel(l)) aw.push(l);
  }
  return { level: l, exp: e, awakenings: aw };
}

/**
 * Hareket hızı: AGI ve Divine Hız çarpanı, toplam en fazla 1.6x.
 * Fazlası mükemmel kaçış penceresine ve yavaşlama süresine dönüşür.
 */
export function movementWithDivine(agiMult: number, divineSpeed: number): { move: number; overflow: number } {
  const raw = agiMult * divineSpeed;
  if (raw <= MOVE_SPEED_CAP) return { move: raw, overflow: 0 };
  return { move: MOVE_SPEED_CAP, overflow: raw - MOVE_SPEED_CAP };
}

/** Taşma (overflow) → mükemmel kaçış penceresi çarpanı ve yavaşlama süresi çarpanı. */
export function overflowBonuses(overflow: number): { windowMult: number; slowmoMult: number } {
  return { windowMult: 1 + overflow * 0.8, slowmoMult: 1 + overflow * 1.2 };
}

/** Olumsuz etki süresi çarpanı: 1/adaptasyon, en az 0.25 (en fazla %75 kısalma). */
export function debuffDurationMult(adaptation: number): number {
  return Math.max(1 - DEBUFF_REDUCTION_CAP, 1 / adaptation);
}

// ---------------------------------------------------------------- Işık barı

export const LIGHT_MAX = 100;
/** 0.11.0 (A10): normal vuruş 3 (eskiden 7); bar asıl kusursuz kaçış ve sersemletmeyle dolar. */
export const LIGHT_ON_HIT = 3;
/** Bir düşmanı sersemletmek (A10). */
export const LIGHT_ON_STUN = 10;
export const LIGHT_ON_DODGE = 5;
export const LIGHT_ON_PERFECT_DODGE = 14;
export const LIGHT_DECAY_PER_SEC = 2.5;
