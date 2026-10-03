// Büyük dekorların (ağaç tepeleri, bina çatıları) arkasında kalan oyuncu ve düşmanlar için
// yumuşak geçişli yarı saydamlık. Ayrıca düşmanların ağaç tepesi altında doğmasını önlemek için
// "bu nokta bir tepe/çatı tarafından örtülüyor mu?" sorgusu.
import Phaser from 'phaser';

export const OCCLUDED_ALPHA = 0.4;
const FADE_SPEED = 5; // saniyede alfa değişimi
const CELL = 256;

interface Occ {
  img: Phaser.GameObjects.Image;
  x0: number;
  x1: number;
  y0: number;
  base: number; // zemin çizgisi (bunun üstündeki aktörler arkada kalır)
  baseAlpha: number;
  target: number;
}

export class Occluders {
  private cells = new Map<number, Occ[]>();
  private all: Occ[] = [];
  private active = new Set<Occ>();

  /** Görsel bir örtücü olarak eklenir; alt kenarı (img.y) zemin çizgisi sayılır. */
  add(img: Phaser.GameObjects.Image, base: number, insetX = 0.18, insetTop = 0.06) {
    const w = img.displayWidth, h = img.displayHeight;
    const left = img.x - w * img.originX;
    const top = img.y - h * img.originY;
    const o: Occ = { img, x0: left + w * insetX, x1: left + w * (1 - insetX), y0: top + h * insetTop, base, baseAlpha: img.alpha, target: img.alpha };
    this.all.push(o);
    const cx0 = Math.floor(o.x0 / CELL), cx1 = Math.floor(o.x1 / CELL);
    const cy0 = Math.floor(o.y0 / CELL), cy1 = Math.floor(o.base / CELL);
    for (let cy = cy0; cy <= cy1; cy++)
      for (let cx = cx0; cx <= cx1; cx++) {
        const k = cy * 10000 + cx;
        let a = this.cells.get(k);
        if (!a) this.cells.set(k, (a = []));
        a.push(o);
      }
  }

  get count() {
    return this.all.length;
  }

  private near(x: number, y: number): Occ[] {
    return this.cells.get(Math.floor(y / CELL) * 10000 + Math.floor(x / CELL)) ?? [];
  }

  /** (x,y) noktası bir tepe/çatının arkasında mı (görünmez olur mu)? */
  covers(x: number, y: number, margin = 0): boolean {
    for (const o of this.near(x, y)) if (x > o.x0 - margin && x < o.x1 + margin && y > o.y0 - margin && y < o.base - 2) return true;
    return false;
  }

  /** Aktörlerin (ayak noktası x,y ve boyu h) arkasında kaldığı örtücüleri saydamlaştırır. */
  update(dt: number, actors: { x: number; y: number; h: number }[]) {
    const hit = new Set<Occ>();
    for (const a of actors) {
      // gövdenin ortası ve başı: biri bile örtülüyorsa
      for (const py of [a.y - 4, a.y - a.h * 0.5, a.y - a.h]) {
        for (const o of this.near(a.x, py)) {
          if (hit.has(o)) continue;
          if (a.y >= o.base - 1) continue; // önde duruyor
          if (a.x > o.x0 && a.x < o.x1 && py > o.y0 && py < o.base) hit.add(o);
        }
      }
    }
    for (const o of hit) {
      o.target = Math.min(o.baseAlpha, OCCLUDED_ALPHA);
      this.active.add(o);
    }
    for (const o of [...this.active]) {
      if (!hit.has(o)) o.target = o.baseAlpha;
      const cur = o.img.alpha;
      const d = o.target - cur;
      if (Math.abs(d) < 0.01) {
        o.img.setAlpha(o.target);
        if (o.target === o.baseAlpha) this.active.delete(o);
      } else o.img.setAlpha(cur + Math.sign(d) * Math.min(Math.abs(d), FADE_SPEED * dt));
    }
  }
}
