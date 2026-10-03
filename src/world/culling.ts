// Ekran dışı ayıklama (A3): hareket etmeyen dekorlar ve binalar 256 px'lik parçalara bölünür;
// yalnızca kameranın (ve kenar payının) içindeki parçaların nesneleri çizilir.
// Görüntü değişmez: kenar payı en büyük dekordan (dev meşe ~320 px) daha geniş tutulur.
import type Phaser from 'phaser';

const CHUNK = 256;
const MARGIN = 360;

type Obj = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible & { x: number; y: number };

export class Culler {
  private chunks = new Map<number, Obj[]>();
  private shown = new Set<number>();
  /** Kalıcı olarak gizlenen nesneler (ör. yanıp kül olan çalı). */
  hidden = new WeakSet<object>();
  total = 0;

  add(o: Obj, cx?: number, cy?: number) {
    const x = cx ?? o.x, y = cy ?? o.y;
    const k = this.key(Math.floor(x / CHUNK), Math.floor(y / CHUNK));
    let a = this.chunks.get(k);
    if (!a) this.chunks.set(k, (a = []));
    a.push(o);
    o.setVisible(false);
    this.total++;
  }

  private key(cx: number, cy: number) {
    return cy * 4096 + cx;
  }

  /** Görünen dikdörtgen değişince çağrılır (her kare çağrılması ucuzdur). */
  update(view: Phaser.Geom.Rectangle) {
    const x0 = Math.floor((view.x - MARGIN) / CHUNK), x1 = Math.floor((view.right + MARGIN) / CHUNK);
    const y0 = Math.floor((view.y - MARGIN) / CHUNK), y1 = Math.floor((view.bottom + MARGIN) / CHUNK);
    const want = new Set<number>();
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) want.add(this.key(cx, cy));
    for (const k of this.shown) if (!want.has(k)) this.setChunk(k, false);
    for (const k of want) if (!this.shown.has(k)) this.setChunk(k, true);
    this.shown = want;
  }

  private setChunk(k: number, vis: boolean) {
    const a = this.chunks.get(k);
    if (!a) return;
    for (const o of a) {
      if (!o.active) continue;
      o.setVisible(vis && !this.hidden.has(o));
    }
  }

  /** Görünür (çizilen) nesne sayısı (ölçüm için). */
  visibleCount() {
    let n = 0;
    for (const k of this.shown) for (const o of this.chunks.get(k) ?? []) if (o.visible) n++;
    return n;
  }
}
