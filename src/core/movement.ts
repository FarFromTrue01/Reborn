// Joseph'in yürüme hızı (0.8.0, Grup 5A C1–C2). Saf: test edilir.
//
// Divine Hız tabanı 0,75 (saldırı hızını da 0,75 yapar) ve yalnızca Joseph'e özel ⅔ yürüme çarpanı: hareket eski
// hızın yarısı (0,75 × ⅔). Koşu = yürüme × 1,6. Yoldaşlar, NPC'ler ve canavarlar BASE_SPEED'i kendi çarpanlarıyla
// kullanır, etkilenmez.

/** Kare/saniye (1.0x insan). Yoldaşlar da kullanır — değiştirme. */
export const BASE_SPEED = 5.2;
/** Yalnızca Joseph: yürüme çarpanı. */
export const JOSEPH_WALK_MULT = 2 / 3;
/** Koşu çarpanı. */
export const RUN_MULT = 1.6;
/** Ayardaki en düşük hız: doğal hızın %40'ı. */
export const WALK_SETTING_MIN_FRAC = 0.4;

/** Joseph'in doğal yürüme hızı (kare/sn): BASE_SPEED × türetilmiş hareket çarpanı (AGI × Divine Hız) × ⅔. */
export function naturalWalk(moveSpeed: number): number {
  return BASE_SPEED * moveSpeed * JOSEPH_WALK_MULT;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Ayarlar → Hareket hızı: değer kare/sn (null = "Max", doğal hız). Değer max'ı geçemez (max'a sabitlenir), en az
 * max'ın %40'ı. Ayar hiçbir koşulda Joseph'i hızlandıramaz: çarpan ≤ 1.
 */
export function walkSetting(natural: number, setting: number | null): { max: number; min: number; value: number; mult: number; isMax: boolean } {
  const max = r1(natural);
  const min = r1(max * WALK_SETTING_MIN_FRAC);
  if (setting === null || !isFinite(setting)) return { max, min, value: max, mult: 1, isMax: true };
  const value = r1(Math.min(max, Math.max(min, setting)));
  const mult = Math.min(1, natural > 0 ? value / natural : 1);
  return { max, min, value, mult, isMax: value >= max };
}

/** Hız sayısı (Türkçe ondalık). */
export function fmtSpeed(v: number): string {
  return r1(v).toFixed(1).replace('.', ',');
}
