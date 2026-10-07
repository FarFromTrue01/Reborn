// 0.11.0 (B3): düşünce/konuşma balonlarının sırası. Phaser'sız; WorldScene çizer.
// Aynı karakterin balonları sıraya girer: biri bitince sonraki çıkar (level ve Divine level aynı anda atlayınca iki
// iç ses üst üste yazılıyordu). Farklı karakterlerin balonları birbirini beklemez.

export interface BubbleItem {
  text: string;
  /** Ekranda kalma süresi (sn). */
  dur: number;
  think: boolean;
}

export type BubbleAction<K> = { kind: 'show'; key: K; item: BubbleItem } | { kind: 'hide'; key: K };

/** Balonlar arasında kısa boşluk (sn), ve aynı metnin art arda yinelenmesi önlenir. */
export const BUBBLE_GAP = 0.15;

export class BubbleQueue<K> {
  private lanes = new Map<K, { cur: BubbleItem | null; t: number; gap: number; queue: BubbleItem[] }>();

  push(key: K, item: BubbleItem) {
    let l = this.lanes.get(key);
    if (!l) this.lanes.set(key, (l = { cur: null, t: 0, gap: 0, queue: [] }));
    // aynı metin zaten gösteriliyor ya da sırada: yineleme
    if (l.cur?.text === item.text || l.queue.some((q) => q.text === item.text)) return;
    l.queue.push(item);
  }

  /** Her kare: biten balon gizlenir, sıradaki gösterilir. */
  tick(dt: number): BubbleAction<K>[] {
    const acts: BubbleAction<K>[] = [];
    for (const [key, l] of this.lanes) {
      if (l.cur) {
        l.t += dt;
        if (l.t >= l.cur.dur) {
          l.cur = null;
          l.gap = BUBBLE_GAP;
          acts.push({ kind: 'hide', key });
        }
      } else if (l.gap > 0) l.gap -= dt;
      if (!l.cur && l.gap <= 0 && l.queue.length) {
        l.cur = l.queue.shift()!;
        l.t = 0;
        acts.push({ kind: 'show', key, item: l.cur });
      }
      if (!l.cur && !l.queue.length && l.gap <= 0) this.lanes.delete(key);
    }
    return acts;
  }

  /** Karakter yok oldu: sırası silinir. */
  drop(key: K) {
    this.lanes.delete(key);
  }

  showing(key: K): BubbleItem | null {
    return this.lanes.get(key)?.cur ?? null;
  }

  pending(key: K): number {
    return this.lanes.get(key)?.queue.length ?? 0;
  }

  clear() {
    this.lanes.clear();
  }
}
