// 0.11.0 (C11): hasat ve antrenman mini oyunları spamlanamaz. Phaser'sız; uygulaması scenes/MinigameScene.
// - Hasat ve odun kesme: her basışta orak/balta savrulur ve 0,4 sn boyunca yeni basış yok sayılır; ıska kırmızı
//   parlama ve süreden 1 sn düşer. Hedef: hasatta 22 sn'de 10 demet, odunda 24 sn'de 10 kütük.
// - Taş kaldırma: sürenin en az %60'ı bölgede.
// - Koşu parkuru: ritimsiz basış (iki adım arası 0,12 sn'den kısa) hızı artırmaz, düşürür. Hedef: süre içinde bitir.
// - Hedefe ulaşılamazsa "Kaybettin" ve "Tekrar dene" (antrenmanda ayrıca "Bırak"); ücret ve günlük seans yalnızca
//   başarıda.

export type MinigameKind = 'chop' | 'lift' | 'run' | 'harvest' | 'serve';

/** Savuruştan sonra yeni basışın yok sayıldığı süre (sn). */
export const SWING_LOCK_SEC = 0.4;
/** Iskanın cezası (sn). */
export const MISS_PENALTY_SEC = 1;
/** Hedefler. */
export const MINIGAME_GOAL: Record<'harvest' | 'chop', { count: number; sec: number }> = {
  harvest: { count: 10, sec: 22 },
  chop: { count: 10, sec: 24 },
};
/** Taş kaldırma: bölgede geçmesi gereken süre oranı. */
export const LIFT_ZONE_FRAC = 0.6;
/** Koşu: bundan kısa adım aralığı ritimsiz sayılır. */
export const RUN_MIN_STEP = 0.12;
export const RUN_MAX_STEP = 0.45;

/** Basış kabul edilir mi (savuruş kilidi)? */
export function swingAccepted(lastPressAt: number, now: number): boolean {
  return now - lastPressAt >= SWING_LOCK_SEC;
}

/**
 * Koşu adımı: hız değişimi. Aynı tarafa basmak ve ritimsiz (çok hızlı) basmak hızı düşürür; ritimli basış artırır,
 * yavaş basış az artırır.
 */
export function runStepDelta(sameSide: boolean, interval: number): number {
  if (sameSide) return -0.15;
  if (interval < RUN_MIN_STEP) return -0.1;
  if (interval <= RUN_MAX_STEP) return 0.12;
  return 0.05;
}

export interface MinigameStats {
  /** Hasat/odun: başarılı vuruş sayısı. */
  count?: number;
  /** Taş: bölgede geçen süre (sn) ve toplam süre. */
  inZone?: number;
  dur?: number;
  /** Koşu: mesafe (1 = bitiş). */
  dist?: number;
}

/** Başarı: hedefe ulaşıldı mı? */
export function minigameWon(kind: MinigameKind, s: MinigameStats): boolean {
  if (kind === 'harvest' || kind === 'chop') return (s.count ?? 0) >= MINIGAME_GOAL[kind].count;
  if (kind === 'lift') return (s.inZone ?? 0) >= LIFT_ZONE_FRAC * (s.dur ?? 1);
  if (kind === 'run') return (s.dist ?? 0) >= 1;
  return false;
}

/** Hasat/odun isabet oranı (Haldor'un yorumu ve performans). */
export function accuracy(hits: number, attempts: number): number {
  return attempts > 0 ? Math.max(0, Math.min(1, hits / attempts)) : 0;
}
