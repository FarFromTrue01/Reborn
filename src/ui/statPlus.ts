// Statlarda renkli artılar (0.9.0, Kısım 1 madde 10): solda temel stat (Level'dan gelen), sağında üst üste küçük
// artılar — yeşil ekipman, sarı unvan (Title), mor skill. Sıra her zaman yukarıdan aşağı yeşil → sarı → mor.
import Phaser from 'phaser';
import { txt } from './kit';

export { PLUS_SOURCES, statParts, plusOffsets, type PlusVisibility } from '../core/statParts';
import { plusOffsets } from '../core/statParts';

/** Artı yığını: x sol kenar, cy dikey orta, h kullanılabilir yükseklik. Genişliği rowWidth. */
export function plusStack(scene: Phaser.Scene, x: number, cy: number, h: number, plus: { v: number; color: string }[], size = 11) {
  const c = scene.add.container(x, cy) as Phaser.GameObjects.Container & { rowWidth: number };
  const offs = plusOffsets(plus.length);
  let w = 0;
  plus.forEach((p, i) => {
    const t = txt(scene, 0, offs[i] * h, `${p.v > 0 ? '+' : '−'}${Math.abs(p.v)}`, { size, bold: true, color: p.color, stroke: true }).setOrigin(0, 0.5);
    c.add(t);
    w = Math.max(w, t.width);
  });
  c.rowWidth = w;
  return c;
}
