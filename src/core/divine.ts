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

/** Katsayı = 0.5 × 1.15^L × 1.5^floor(L/3) */
export function divineCoefficient(level: number): number {
  return 0.5 * Math.pow(1.15, level) * Math.pow(1.5, Math.floor(level / 3));
}

export const ADAPTATION_CAP = 5;
export const MOVE_SPEED_CAP = 1.6;
export const DEBUFF_REDUCTION_CAP = 0.75;

export function divineStat(stat: DivineStat, level: number): number {
  const c = divineCoefficient(level);
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
 * Meydan okuma EXP'si. d = düşman level − karakter level.
 * d<0: 0, d=0: 5, d≥1: 5×(d+1)². Boss ×3.
 */
export function challengeExp(enemyLevel: number, playerLevel: number, boss = false): number {
  const d = enemyLevel - playerLevel;
  let e = 0;
  if (d < 0) e = 0;
  else if (d === 0) e = 5;
  else e = 5 * (d + 1) * (d + 1);
  return boss ? e * 3 : e;
}

/** Seri bonusu: önceki art arda anlamlı zafer başına +%10, en fazla +%50. */
export function streakMultiplier(previousStreak: number): number {
  return 1 + Math.min(0.5, 0.1 * Math.max(0, previousStreak));
}

/** Meydan okuma + seri bonusu (yuvarlanmış). */
export function victoryDivineExp(enemyLevel: number, playerLevel: number, boss: boolean, previousStreak: number): number {
  const base = challengeExp(enemyLevel, playerLevel, boss);
  return Math.round(base * streakMultiplier(previousStreak));
}

/** Zafer anlamlı mı (seri için)? d ≥ 0 */
export function isMeaningfulVictory(enemyLevel: number, playerLevel: number): boolean {
  return enemyLevel - playerLevel >= 0;
}

/**
 * Antrenman: performansa (0..1) göre mevcut Divine level gereksiniminin %3–5'i.
 */
export function trainingExp(divineLevel: number, performance: number): number {
  const p = Math.max(0, Math.min(1, performance));
  const pct = 0.03 + 0.02 * p;
  return Math.round(divineExpToNext(divineLevel) * pct);
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
export const LIGHT_ON_HIT = 7;
export const LIGHT_ON_DODGE = 5;
export const LIGHT_ON_PERFECT_DODGE = 14;
export const LIGHT_DECAY_PER_SEC = 2.5;
