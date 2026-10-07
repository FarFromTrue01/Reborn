// 0.11.0 (B8/C12): kart seçim panelinin düzeni (Sistem Teklifi, Divine skill seçimi). Phaser'sız; ui/panels çizer.
// Kartlar dikey ve uzun (oyun kartı oranı ≈ 2:3), yan yana ekrana sığar; başlık kartların üstünde, "Vazgeç" /
// "Hiçbirini seçme" kartların altında ayrı ve hizalı. Hiçbir şey birbirine binmez.

export const CARD_RATIO = 1.5;
export const CARD_GAP = 22;
export const CARD_MARGIN = 28;
/** Başlık bandı ve alttaki düğme bandı (UI pikseli). */
export const CARD_TITLE_H = 64;
export const CARD_CANCEL_H = 76;

export interface CardLayout {
  cw: number;
  ch: number;
  x0: number;
  gap: number;
  /** Başlığın ortası (y), kartların üstü (y), alt düğmenin ortası (y). */
  titleY: number;
  cardsY: number;
  cancelY: number;
}

/** n kart için düzen: genişlik ve yükseklik sınırlarına göre en büyük 2:3 kart. */
export function cardLayout(W: number, H: number, n: number, cancel: boolean): CardLayout {
  const gap = CARD_GAP;
  const availW = W - CARD_MARGIN * 2 - (n - 1) * gap;
  const availH = H - CARD_MARGIN - CARD_TITLE_H - (cancel ? CARD_CANCEL_H : CARD_MARGIN);
  let cw = Math.min(250, availW / n, availH / CARD_RATIO);
  cw = Math.floor(Math.max(120, cw));
  const ch = Math.floor(cw * CARD_RATIO);
  const total = n * cw + (n - 1) * gap;
  const x0 = Math.round((W - total) / 2);
  // dikeyde ortala: başlık + kartlar + alt düğme bloğu
  const block = CARD_TITLE_H + ch + (cancel ? CARD_CANCEL_H : 0);
  const top = Math.max(CARD_MARGIN / 2, Math.round((H - block) / 2));
  return { cw, ch, x0, gap, titleY: top + CARD_TITLE_H / 2 - 4, cardsY: top + CARD_TITLE_H, cancelY: top + CARD_TITLE_H + ch + CARD_CANCEL_H / 2 };
}

/**
 * Kartın içi yukarıdan aşağıya: simge, ad, nadirlik etiketi, açıklama (kayar), tablo, düğme. Dönen değerler kartın
 * içindeki y konumları; açıklama alanı kalan yüksekliktir.
 */
export function cardSections(ch: number, o: { icon: boolean; titleH: number; tag: boolean; tableH: number; footerH: number }) {
  const pad = 14;
  let y = pad;
  const iconY = o.icon ? y + 26 : -1;
  if (o.icon) y += 56;
  const titleY = y;
  y += o.titleH + 4;
  const tagY = o.tag ? y : -1;
  if (o.tag) y += 20;
  y += 6;
  const buttonH = 44;
  const buttonY = ch - pad - buttonH / 2;
  const footerY = buttonY - buttonH / 2 - 6 - o.footerH;
  const tableY = footerY - (o.tableH ? o.tableH + 8 : 0);
  const descY = y;
  const descH = Math.max(24, tableY - 6 - descY);
  return { iconY, titleY, tagY, descY, descH, tableY, footerY, buttonY, buttonH };
}
