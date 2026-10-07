// 0.11.0 (B2): sistem bildiriminin düzeni — Phaser'sız kararlar (tür, simge, "etiket · değer", satır dizimi, konum).
// Çizim ui/sysBox.ts'te; UIScene.showSys ve MenuScene.showNotice aynı kutuyu kullanır.

export type SysTheme = 'level' | 'skill' | 'divine' | 'warn' | 'quest' | 'info';

/** Başlık şeridinin rengi ve simgesi (uiicons atlası; renkli, çizilmiş emoji tarzı). */
export const SYS_THEME: Record<SysTheme, { color: number; text: string; icon: string }> = {
  level: { color: 0xf0c040, text: '#ffe08a', icon: 'level' },
  skill: { color: 0x4aa8ff, text: '#a8d8ff', icon: 'skills' },
  divine: { color: 0xfff0c0, text: '#fff6dc', icon: 'light' },
  warn: { color: 0xe0503c, text: '#ffb0a0', icon: 'risk' },
  quest: { color: 0x5ccf6a, text: '#b8f0bc', icon: 'quests' },
  info: { color: 0xd9b45a, text: '#f3dc95', icon: 'sparkle' },
};

/** Başlığa göre tür: seviye atlama altın, skill mavi, Divine beyaz-altın, uyarı kırmızı, görev yeşil. */
export function sysTheme(title: string): SysTheme {
  const t = title.toLocaleUpperCase('tr');
  if (/LEVEL ATLADIN/.test(t)) return 'level';
  if (/DIVINE|IŞIK|İKİNCİ NEFES|ÖLÜMSÜZ KALE|UYANIŞ/.test(t)) return 'divine';
  if (/UYARI|BAŞARISIZ|BIRAKILDI|SÜRE DOLUYOR|ÖĞRENİLEMEDİ|ÖNCE LONCA|DEĞİŞTİ|YETERSİZ/.test(t)) return 'warn';
  if (/SKILL|YETENEK|TITLE|SİSTEM TEKLİFİ|STATUS|EKİPMAN/.test(t)) return 'skill';
  if (/GÖREV|İŞ|ŞÜPHELİ|PANO|LONCA|KART|HARİTA|YOLDAŞ/.test(t)) return 'quest';
  return 'info';
}

/** Satırın başındaki simge (türüne göre). */
export function lineIcon(text: string, theme: SysTheme): string {
  const s = text;
  if (/^Level\b/i.test(s)) return 'level';
  if (/stat puan/i.test(s)) return 'stats';
  if (/^SP\b|\bSP\b/.test(s)) return 'card';
  if (/Max HP|^HP\b/.test(s)) return 'hp';
  if (/Max MP|^MP\b/.test(s)) return 'mp';
  if (/Yeni yetenek|Yetenek/i.test(s)) return 'skill_slot';
  if (/Divine|Işık/i.test(s)) return 'light';
  if (/\{m:|bronz|gümüş|Ödül|Ödeme|Borç|ceza/i.test(s)) return 'money';
  if (/Lonca Puanı|Rütbe/i.test(s)) return 'guild';
  if (/→\s*[GFEDCBASX][+-]?\s*$/.test(s) || /^[^:]+: [GFEDCBASX][+-]? → /.test(s)) return 'skills';
  if (/Envanter|Ekipman|\[DEF|\[Hasar|eşya/i.test(s)) return 'bag';
  if (/görev|Görev|ilan/i.test(s)) return 'quests';
  if (/gün|saat|\d{2}:\d{2}/i.test(s)) return 'clock';
  if (theme === 'warn') return 'risk';
  if (theme === 'skill') return 'skills';
  if (theme === 'level') return 'level';
  if (theme === 'divine') return 'light';
  if (theme === 'quest') return 'quests';
  return 'check';
}

/**
 * "Etiket — değer" ayrımı: "Max HP: 10 → 18", "Rütbe: G-" (iki nokta) ya da "Max HP 10 → 18" (ok) biçimleri.
 * Ayrılamayan satır tek parça kalır (value null).
 */
export function parseSysLine(text: string): { label: string; value: string | null } {
  const tab = text.indexOf('\t');
  if (tab > 0) return { label: text.slice(0, tab).trim(), value: text.slice(tab + 1).trim() };
  const colon = /^([^:{}]{1,22}):\s+(.+)$/.exec(text);
  if (colon) return { label: colon[1].trim(), value: colon[2].trim() };
  const arrow = /^([^\d→{}]{2,22}?)\s+([+\-−]?\d[^→]*→\s*.+)$/.exec(text);
  if (arrow) return { label: arrow[1].trim(), value: arrow[2].trim() };
  return { label: text, value: null };
}

/** Satırların y konumları: ölçülen gerçek yüksekliğe göre (sarılan satır bir sonrakine binmez). */
export function stackLines(heights: number[], top: number, gap: number): { ys: number[]; bottom: number } {
  const ys: number[] = [];
  let y = top;
  for (const h of heights) {
    ys.push(y);
    y += h + gap;
  }
  return { ys, bottom: heights.length ? y - gap : top };
}

export interface SysPlacementInput {
  /** Ekran genişliği. */
  W: number;
  /** Kutunun genişliği ve yüksekliği. */
  boxW: number;
  /** Sol üst panelin (ve altındaki görev kutusunun) sağ kenarı, sağ üst saat kutusunun sol kenarı. */
  leftEdge: number;
  rightEdge: number;
  /** Sol üst panelin ve sağ üst kutunun alt kenarları. */
  leftBottom: number;
  rightBottom: number;
  margin?: number;
}

/**
 * Kutu konumu (merkez x, üst y): sol üst panel ile sağ üstteki saat kutusu arasındaki boşlukta ortalanır, ikisine de
 * binmez. Sığmazsa ikisinin de altına iner (ekranın ortasında).
 */
export function sysPlacement(i: SysPlacementInput): { x: number; y: number; inGap: boolean } {
  const m = i.margin ?? 12;
  const gap = i.rightEdge - i.leftEdge;
  if (gap >= i.boxW + m * 2) return { x: Math.round(i.leftEdge + gap / 2), y: 10, inGap: true };
  const x = Math.round(i.W / 2);
  const overlapsLeft = x - i.boxW / 2 < i.leftEdge + m;
  const overlapsRight = x + i.boxW / 2 > i.rightEdge - m;
  const y = Math.max(overlapsLeft ? i.leftBottom : 0, overlapsRight ? i.rightBottom : 0, 10) + (overlapsLeft || overlapsRight ? m : 0);
  return { x, y, inGap: false };
}

/** Kutu ne kadar süre açık kalır (ms): satır sayısı ve uzunluğuyla. */
export function sysDuration(lines: string[]): number {
  const chars = lines.reduce((a, l) => a + l.length, 0);
  return Math.min(12000, 2600 + lines.length * 600 + chars * 25);
}
