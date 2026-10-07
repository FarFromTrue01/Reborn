// Haritalar arası yön (A7.2/B1/B18): görev hedefi başka bir haritadaysa ok, o haritaya giden geçişi
// (kapı ya da merdiven) gösterir. Yol bulma yok (ok kuş uçuşu); yalnızca harita grafiğinde ilk adım.
import type { Warp } from './types';

export interface NavMap {
  warps: Warp[];
}

/**
 * `from` haritasından `to` haritasına giden yolun ilk geçişi (genişlik öncelikli arama; geçişlerin `to` alanları
 * grafiği kurar). Aynı haritaysa ya da yol yoksa null. Birden çok geçiş aynı haritaya gidiyorsa ilk tanımlanan.
 */
export function firstHop(maps: Record<string, NavMap | undefined>, from: string, to: string): Warp | null {
  if (from === to) return null;
  const start = maps[from];
  if (!start) return null;
  const seen = new Set<string>([from]);
  // kuyruk: [bu harita, buraya varmak için from'da kullanılan ilk geçiş]
  const queue: [string, Warp][] = [];
  for (const w of start.warps) {
    if (!w.to || seen.has(w.to)) continue;
    if (w.to === to) return w;
    seen.add(w.to);
    queue.push([w.to, w]);
  }
  while (queue.length) {
    const [id, hop] = queue.shift()!;
    for (const w of maps[id]?.warps ?? []) {
      if (!w.to || seen.has(w.to)) continue;
      if (w.to === to) return hop;
      seen.add(w.to);
      queue.push([w.to, hop]);
    }
  }
  return null;
}

/** Geçiş karosunun ortası (piksel). */
export function warpCenterPx(w: Warp, tile = 32): { x: number; y: number } {
  return { x: (w.x + w.w / 2) * tile, y: (w.y + w.h / 2) * tile };
}

/** Bir noktanın dikdörtgene uzaklığı (içindeyse 0). */
export function distToRect(px: number, py: number, r: { x: number; y: number; w: number; h: number }): number {
  const dx = Math.max(r.x - px, 0, px - (r.x + r.w));
  const dy = Math.max(r.y - py, 0, py - (r.y + r.h));
  return Math.hypot(dx, dy);
}

/** A7.10: yatağın "Uyu" alanı (kenarına uzaklık, px): yanından, ayak ucundan ve bir kare öteden. */
export const BED_REACH = 52;
