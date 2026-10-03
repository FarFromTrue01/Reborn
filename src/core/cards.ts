// Şehir giriş kartları (C8). Oyunda ay yok: 3 ay = 84 gün (12 hafta).
// Süresi dolmadan yeni kart alınırsa yeni kartın süresi eskisinin bittiği günden başlar.

export const CARD_DAYS = 84;
/** 3 aylık giriş kartı: 10 gümüş. */
export const CARD_PRICE = 1000;

export interface EntryCard {
  city: string;
  /** Geçerli olduğu ilk gün (dahil). */
  from: number;
  /** Geçerli olduğu son gün (dahil). */
  until: number;
  boughtDay: number;
}

export const CITY_NAMES: Record<string, string> = { capital: 'Kraliyet Şehri Valmont' };

/** Bir şehir için yeni kart: varsa son kartın bitişinden sonra başlar. */
export function buyCard(cards: EntryCard[], city: string, today: number, days = CARD_DAYS): EntryCard {
  const last = cards.filter((c) => c.city === city).reduce((m, c) => Math.max(m, c.until), 0);
  const from = Math.max(today, last + 1);
  const card: EntryCard = { city, from, until: from + days - 1, boughtDay: today };
  cards.push(card);
  return card;
}

/** Bugün geçerli bir kart var mı? */
export function hasValidCard(cards: EntryCard[], city: string, today: number): boolean {
  return cards.some((c) => c.city === city && c.from <= today && c.until >= today);
}

/** Bir kartın kalan günü (bugün dahil; henüz başlamadıysa tüm süre, bittiyse 0). */
export function daysLeft(c: EntryCard, today: number): number {
  if (today > c.until) return 0;
  return c.until - Math.max(today, c.from) + 1;
}

/** Bir şehir için toplam kalan gün (art arda kartlar). */
export function totalDaysLeft(cards: EntryCard[], city: string, today: number): number {
  return cards.filter((c) => c.city === city).reduce((s, c) => s + daysLeft(c, today), 0);
}
