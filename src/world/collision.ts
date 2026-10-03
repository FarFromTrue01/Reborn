// Dekor çarpışması: dairesel gövdeleri, dekorların piksel kutularından dışarı iter (kayarak).
// Karo ızgarası (MapData.hard) Arcade tilemap çarpışmasıyla, kutular burada çözülür.
import type Phaser from 'phaser';
import type { ColliderRect, MapData } from './types';
import { TILE } from './types';

export class PropCollision {
  private cells = new Map<number, number[]>();
  constructor(public rects: ColliderRect[], private w: number) {
    rects.forEach((r, i) => {
      const x0 = Math.floor(r.x / TILE), x1 = Math.floor((r.x + r.w) / TILE);
      const y0 = Math.floor(r.y / TILE), y1 = Math.floor((r.y + r.h) / TILE);
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const k = y * w + x;
          let a = this.cells.get(k);
          if (!a) this.cells.set(k, (a = []));
          a.push(i);
        }
    });
  }

  /** Bir noktada (piksel) kutu var mı? */
  hitPoint(px: number, py: number): boolean {
    const a = this.cells.get(Math.floor(py / TILE) * this.w + Math.floor(px / TILE));
    if (!a) return false;
    for (const i of a) {
      const r = this.rects[i];
      if (!r.off && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return true;
    }
    return false;
  }

  /** Bir alandaki kutuları kapat (ör. yanan çalı). */
  disableNear(px: number, py: number, radius: number) {
    for (const r of this.rects) if (!r.off && px > r.x - radius && px < r.x + r.w + radius && py > r.y - radius && py < r.y + r.h + radius) r.off = true;
  }

  /** Dairesel bir gövdeyi kutulardan dışarı iter. Bir şeye çarptıysa true. */
  resolve(body: Phaser.Physics.Arcade.Body): boolean {
    if (!body.enable) return false;
    const r = body.halfWidth;
    let cx = body.center.x, cy = body.center.y;
    const tx0 = Math.floor((cx - r) / TILE), tx1 = Math.floor((cx + r) / TILE);
    const ty0 = Math.floor((cy - r) / TILE), ty1 = Math.floor((cy + r) / TILE);
    let hit = false;
    const seen: number[] = [];
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        const a = this.cells.get(ty * this.w + tx);
        if (!a) continue;
        for (const i of a) {
          if (seen.includes(i)) continue;
          seen.push(i);
          const b = this.rects[i];
          if (b.off) continue;
          const qx = Math.max(b.x, Math.min(cx, b.x + b.w));
          const qy = Math.max(b.y, Math.min(cy, b.y + b.h));
          let dx = cx - qx, dy = cy - qy;
          const d2 = dx * dx + dy * dy;
          if (d2 >= r * r) continue;
          let nx: number, ny: number, push: number;
          if (d2 > 1e-6) {
            const d = Math.sqrt(d2);
            nx = dx / d;
            ny = dy / d;
            push = r - d;
          } else {
            // merkez kutunun içinde: en kısa eksenden çık
            const l = cx - b.x, rr = b.x + b.w - cx, t = cy - b.y, bt = b.y + b.h - cy;
            const m = Math.min(l, rr, t, bt);
            if (m === l) { nx = -1; ny = 0; push = l + r; }
            else if (m === rr) { nx = 1; ny = 0; push = rr + r; }
            else if (m === t) { nx = 0; ny = -1; push = t + r; }
            else { nx = 0; ny = 1; push = bt + r; }
          }
          cx += nx * push;
          cy += ny * push;
          body.position.x += nx * push;
          body.position.y += ny * push;
          const vn = body.velocity.x * nx + body.velocity.y * ny;
          if (vn < 0) {
            body.velocity.x -= nx * vn;
            body.velocity.y -= ny * vn;
          }
          if (nx > 0.5) body.blocked.left = true;
          if (nx < -0.5) body.blocked.right = true;
          if (ny > 0.5) body.blocked.up = true;
          if (ny < -0.5) body.blocked.down = true;
          body.blocked.none = false;
          hit = true;
        }
      }
    if (hit) body.updateCenter();
    return hit;
  }
}

/** Mermi/görüş için: piksel noktası geçilmez mi (sert karo ya da kutu)? */
export function blockedAt(m: MapData, pc: PropCollision | null, px: number, py: number): boolean {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return true;
  if (m.hard[ty * m.w + tx]) return true;
  return !!pc?.hitPoint(px, py);
}
