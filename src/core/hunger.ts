// Açlık / Tokluk (B13, 0.10.0): yalnızca Joseph. Sayılar burada; saf kurallar tests/g6.test.ts.
// Tokluk 0–100. Uyanıkken saatte −4, uyurken saatte −2 (oyun saati). < 30 "Aç": dayanıklılık yenilenmesi −%50.
// < 10 "Çok aç": HP yenilenmesi durur, en yüksek dayanıklılık −%25. Açlık öldürmez (HP'yi düşürmez).

export const SATIETY_MAX = 100;
/** Yeni oyun: Joseph aç uyanır ("yemek" diyor). */
export const SATIETY_START = 40;
/** Eski kayıtlar (alan yoksa). */
export const SATIETY_MIGRATE = 80;
export const HUNGER_AWAKE_PER_HOUR = 4;
export const HUNGER_SLEEP_PER_HOUR = 2;
export const HUNGRY_BELOW = 30;
export const STARVING_BELOW = 10;
/** Aç: dayanıklılık yenilenmesi çarpanı. */
export const HUNGRY_STAMINA_REGEN = 0.5;
/** Çok aç: en yüksek dayanıklılık çarpanı. */
export const STARVING_MAX_STAMINA = 0.75;
/** Bu Tokluk ve üstünde yemek yenmez ("Tokum.", eşya harcanmaz). */
export const FULL_AT = 95;
/** Bertram'ın vardiya sonundaki yemeği (güveç). */
export const SHIFT_MEAL = 40;
/** Vardiyanın ortasındaki öğle yemeği (mutfaktan): uzun vardiyada Joseph "Çok aç"a düşmesin. */
export const SHIFT_LUNCH = 30;

/** Vardiya günü: öğle yemeği, çalışılan saatlerin azalması, akşam güveci — tek adımda (ara uyarı yok). */
export function shiftSatiety(s: number, minutes: number): number {
  return Math.min(SATIETY_MAX, decaySatiety(Math.min(SATIETY_MAX, s + SHIFT_LUNCH), minutes, false) + SHIFT_MEAL);
}

export type HungerState = 'normal' | 'hungry' | 'starving';

export function hungerState(s: number): HungerState {
  if (s < STARVING_BELOW) return 'starving';
  if (s < HUNGRY_BELOW) return 'hungry';
  return 'normal';
}

export const HUNGER_NAMES: Record<HungerState, string> = { normal: 'Tok', hungry: 'Aç', starving: 'Çok aç' };

/** Geçen oyun dakikasıyla azalma (uyurken yarısı). */
export function decaySatiety(s: number, minutes: number, asleep: boolean): number {
  const perHour = asleep ? HUNGER_SLEEP_PER_HOUR : HUNGER_AWAKE_PER_HOUR;
  return Math.max(0, Math.round((s - (perHour * minutes) / 60) * 100) / 100);
}

/** Yemek: Tokluk artar (100'ü aşmaz). 95+ iken yenmez. */
export function eatSatiety(s: number, gain: number): { value: number; refused: boolean } {
  if (s >= FULL_AT) return { value: s, refused: true };
  return { value: Math.min(SATIETY_MAX, s + gain), refused: false };
}

/** Durumun etkileri: dayanıklılık yenilenmesi, HP yenilenmesi ve en yüksek dayanıklılık çarpanları. */
export function hungerMods(s: number): { staminaRegen: number; hpRegen: number; maxStamina: number } {
  const st = hungerState(s);
  if (st === 'starving') return { staminaRegen: HUNGRY_STAMINA_REGEN, hpRegen: 0, maxStamina: STARVING_MAX_STAMINA };
  if (st === 'hungry') return { staminaRegen: HUNGRY_STAMINA_REGEN, hpRegen: 1, maxStamina: 1 };
  return { staminaRegen: 1, hpRegen: 1, maxStamina: 1 };
}

/**
 * Hızlı yeme ve kullanım menüsü için en uygun yiyecek: Tokluk ihtiyacını (100 − Tokluk) en az israfla karşılayan —
 * ihtiyacı aşmayan en büyük; hepsi aşıyorsa en küçüğü. Eşit Tokluk: daha ucuz olan.
 */
export function bestFood(foods: { id: string; satiety: number; price: number }[], satiety: number): string | null {
  if (!foods.length) return null;
  const need = SATIETY_MAX - satiety;
  const fit = foods.filter((f) => f.satiety <= need);
  const pool = fit.length ? fit : foods;
  const sorted = [...pool].sort((a, b) => (fit.length ? b.satiety - a.satiety : a.satiety - b.satiety) || a.price - b.price);
  return sorted[0].id;
}
