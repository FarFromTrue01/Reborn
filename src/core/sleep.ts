// Uyku (C9): "Uyu"ya her basışta yeniden doğma noktası ayarlanır ve oyun kaydedilir.
// Gerçekten uyuyup zamanı atlamak için saat 20:00'yi geçmiş olmalı ya da Joseph en az 8 oyun saati
// uyanık kalmış olmalı. Böylece art arda uyuyarak gün atlanamaz.

export const SLEEP_HOUR = 20;
export const MIN_AWAKE_MINUTES = 8 * 60;

/** absNow, awakeSince: mutlak oyun dakikası ((gün−1)×1440 + dakika). */
export function canSleep(minuteOfDay: number, absNow: number, awakeSince: number): boolean {
  const late = minuteOfDay >= SLEEP_HOUR * 60 || minuteOfDay < 4 * 60;
  return late || absNow - awakeSince >= MIN_AWAKE_MINUTES;
}

export function absMinute(day: number, minute: number): number {
  return (day - 1) * 1440 + minute;
}
