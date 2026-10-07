// Kutlama ekranlarının (görev bitişi, terfi) dokunma ve kapanma kuralları. Phaser'sız; ui/celebrations kullanır.
// 0.11.0 (C5): terfi animasyonu atlanamaz — sırasında dokunmak sona atlamaz; bitince "Kapatmak için dokun" çıkar ve
// ekran ancak dokununca kapanır (kendiliğinden kapanmaz). Görev bitişi eskisi gibi: dokununca sona atlar, ikinci
// dokunuş kapatır, kısa beklemeden sonra kendiliğinden kapanır.

export interface OverlayMode {
  /** Animasyon sürerken dokunmak sona atlar mı? */
  skippable: boolean;
  /** Bitince bekleme süresinden sonra kendiliğinden kapanır mı? */
  autoClose: boolean;
  /** Bitince altta görünen yazı. */
  hint: string;
}

export const QUEST_OVERLAY: OverlayMode = { skippable: true, autoClose: true, hint: 'Devam etmek için dokun' };
export const RANK_OVERLAY: OverlayMode = { skippable: false, autoClose: false, hint: 'Kapatmak için dokun' };

/** Dokunuşun sonucu: t animasyon zamanı, total animasyonun sonu. */
export function overlayTap(m: OverlayMode, t: number, total: number): 'skip' | 'close' | 'ignore' {
  if (t < total) return m.skippable ? 'skip' : 'ignore';
  return 'close';
}

/** Kendiliğinden kapanma anı geldi mi? */
export function overlayAutoDone(m: OverlayMode, t: number, total: number, holdMs: number): boolean {
  return m.autoClose && t >= total + holdMs;
}
