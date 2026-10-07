// 0.11.0 (C2): prolog ve uyanış kendiliğinden akar — dokunmak ve klavye yazıları geçmez ya da hızlandırmaz.
// Satır yazıldıktan sonra okuma süresi dolunca ilerler: ~2,2 sn + harf başına 45 ms. Status ekranı ~8 sn.

export const READ_BASE_MS = 2200;
export const READ_PER_CHAR_MS = 45;
export const STATUS_SCREEN_MS = 8000;
/** Çok uzun metinlerde (trait açıklaması) üst sınır. */
export const READ_MAX_MS = 24000;

export function readTimeMs(text: string): number {
  return Math.min(READ_MAX_MS, READ_BASE_MS + READ_PER_CHAR_MS * [...text].length);
}
