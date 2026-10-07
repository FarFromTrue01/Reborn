// 0.11.0 (A2): düşman saldırısının kırmızı alanı = hasar alanı. Phaser'sız; çizim (world/enemy drawTelegraph) ve
// hasar testi (WorldScene.enemyMeleeHit) aynı şekli kullanır. Şekil hazırlık başında kurulur ve saldırı bitene kadar
// değişmez: hedef yer değiştirse de koni dönmez, atılma görsel olarak kalır ama alanı büyütmez.

/** Koninin yarım açısı (radyan): kırmızı alan ±0,9 rad. */
export const TELEGRAPH_HALF_ANGLE = 0.9;
/** Kırmızı alanın yarıçapı: saldırı menzili + 0,4 kare. */
export const TELEGRAPH_RANGE_PAD = 0.4;
/** Ağır saldırıda (boss) daire, yarıçap ×1,7. */
export const TELEGRAPH_HEAVY_MULT = 1.7;

export type TelegraphShape =
  | { kind: 'cone'; x: number; y: number; r: number; angle: number; half: number }
  | { kind: 'circle'; x: number; y: number; r: number }
  /** Büyü/ok: hazırlık başındaki yön (mermi bu yöne gider). */
  | { kind: 'line'; x: number; y: number; angle: number; len: number };

export interface TelegraphInput {
  /** Saldıranın hazırlık başındaki konumu (px). */
  x: number;
  y: number;
  /** Hedefin hazırlık başındaki konumu (px): yön buradan. */
  tx: number;
  ty: number;
  /** Saldırı menzili (kare). */
  attackRange: number;
  heavy: boolean;
  attack: 'melee' | 'bolt';
  /** Kare boyu (px). */
  tile: number;
}

/** Hazırlık başında saldırının şekli. Yön hedefin o anki konumuna doğru; sonra değişmez. */
export function telegraphShape(i: TelegraphInput): TelegraphShape {
  const angle = Math.atan2(i.ty - i.y, i.tx - i.x);
  if (i.attack === 'bolt') return { kind: 'line', x: i.x, y: i.y, angle, len: Math.hypot(i.tx - i.x, i.ty - i.y) };
  const r = (i.attackRange + TELEGRAPH_RANGE_PAD) * i.tile * (i.heavy ? TELEGRAPH_HEAVY_MULT : 1);
  if (i.heavy) return { kind: 'circle', x: i.x, y: i.y, r };
  return { kind: 'cone', x: i.x, y: i.y, r, angle, half: TELEGRAPH_HALF_ANGLE };
}

function wrap(a: number): number {
  let r = (a + Math.PI) % (Math.PI * 2);
  if (r < 0) r += Math.PI * 2;
  return r - Math.PI;
}

/**
 * Nokta (Joseph'in ayaklarındaki gövde merkezi) kırmızı alanın içinde mi? Koni: yarıçap ve ±açı; daire: yarıçap.
 * Çizgi (büyü) alan değildir: mermi ayrıca çarpışır, burada hep false.
 */
export function inTelegraph(s: TelegraphShape, p: { x: number; y: number }): boolean {
  const dx = p.x - s.x, dy = p.y - s.y;
  const d = Math.hypot(dx, dy);
  if (s.kind === 'circle') return d <= s.r;
  if (s.kind === 'line') return false;
  if (d > s.r) return false;
  if (d < 0.001) return true;
  return Math.abs(wrap(Math.atan2(dy, dx) - s.angle)) <= s.half;
}

/** Bakış yönü vektörü (çizim ve atılma için). */
export function telegraphDir(s: TelegraphShape): { x: number; y: number } {
  const a = s.kind === 'circle' ? 0 : s.angle;
  return { x: Math.cos(a), y: Math.sin(a) };
}
