// Oyun içi saat ve takvim. 1 oyun günü ≈ 24 gerçek dakika → 1 oyun dakikası = 1 gerçek saniye.

export const MINUTES_PER_DAY = 24 * 60;
export const REAL_SECONDS_PER_GAME_MINUTE = 1;

export const WEEKDAY_NAMES = ['Ay Günü', 'Ateş Günü', 'Su Günü', 'Ağaç Günü', 'Maden Günü', 'Toprak Günü', 'Güneş Günü'];

export interface GameTime {
  day: number; // 1'den başlar
  minute: number; // 0..1439
}

export function advance(t: GameTime, minutes: number): GameTime {
  let m = t.minute + minutes;
  let d = t.day;
  while (m >= MINUTES_PER_DAY) {
    m -= MINUTES_PER_DAY;
    d++;
  }
  return { day: d, minute: m };
}

/** Bir sonraki sabah (varsayılan 06:00). */
export function nextMorning(t: GameTime, hour = 6): GameTime {
  const target = hour * 60;
  if (t.minute < 4 * 60) {
    // Gece yarısından sonra yatıldıysa aynı günün sabahı.
    return { day: t.day, minute: target };
  }
  return { day: t.day + 1, minute: target };
}

export function hourOf(t: GameTime): number {
  return Math.floor(t.minute / 60);
}

export function clockLabel(t: GameTime): string {
  const h = Math.floor(t.minute / 60);
  const m = Math.floor(t.minute % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function weekday(t: GameTime): string {
  return WEEKDAY_NAMES[(t.day - 1) % 7];
}

export function weekNumber(t: GameTime): number {
  return Math.floor((t.day - 1) / 7) + 1;
}

export function dateLabel(t: GameTime): string {
  return `${weekNumber(t)}. Hafta · ${weekday(t)}`;
}

/** Saat aralığında mı? (gece yarısını aşan aralıkları destekler) */
export function inHours(t: GameTime, from: number, to: number): boolean {
  const h = t.minute / 60;
  if (from <= to) return h >= from && h < to;
  return h >= from || h < to;
}

/**
 * Gün ışığı seviyesi 0 (gece) .. 1 (öğle). Şafak 05–07, alacakaranlık 18–20.
 */
export function daylight(t: GameTime): number {
  const h = t.minute / 60;
  if (h < 5 || h >= 20.5) return 0;
  if (h < 7) return (h - 5) / 2;
  if (h < 18) return 1;
  return Math.max(0, 1 - (h - 18) / 2.5);
}
