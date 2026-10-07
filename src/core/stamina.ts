// Koşu (0.10.0, B22): koşmak dayanıklılık harcamaz — kilit (eski "tükendi" kilidi), koşu bedeli ve koşudan sonraki
// yenilenme gecikmesi kalktı. Dayanıklılık kaçış ve ağır saldırı gibi diğer kullanımlarda aynen kalır.

/** Joystick'in koşu eşiği (0..1). */
export const RUN_THRESHOLD = 0.92;

/** Saniyelik koşu bedeli (B22: 0). */
export const RUN_STAMINA_PER_SEC = 0;

/** Koşunun dayanıklılığa etkisi (her zaman 0): oyuncu kodu ve testler buradan. */
export function runStaminaCost(_dt: number): number {
  return RUN_STAMINA_PER_SEC * _dt;
}
