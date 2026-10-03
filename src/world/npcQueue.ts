// NPC işlerini zamana yayan küçük kuyruklar. Phaser'a bağımlı değil (testlerde sınanır).

/**
 * Yol arama kuyruğu: aynı karede birden fazla A* araması yapılmasın.
 * Her sahip (NPC) için en fazla bir bekleyen iş tutulur; yeni istek eskisinin yerine geçer
 * ama sıradaki yerini korur.
 */
export class PathQueue {
  private jobs = new Map<object, () => void>();

  request(owner: object, run: () => void) {
    this.jobs.set(owner, run);
  }

  cancel(owner: object) {
    this.jobs.delete(owner);
  }

  has(owner: object) {
    return this.jobs.has(owner);
  }

  get size() {
    return this.jobs.size;
  }

  clear() {
    this.jobs.clear();
  }

  /** Bu karede en fazla `max` iş çalıştırır; çalıştırılan iş sayısını döndürür. */
  tick(max = 1): number {
    let n = 0;
    for (const [owner, run] of this.jobs) {
      if (n >= max) break;
      this.jobs.delete(owner);
      run();
      n++;
    }
    return n;
  }
}

/**
 * Kapıdan teker teker giriş: kuyruktaki öğeler kare başına en fazla bir tane ve aralarında
 * [minGap, maxGap] saniyelik rastgele bir gecikmeyle çıkar. Kuyruk boşken gelen ilk öğe hemen çıkar.
 */
export class ArrivalQueue<T> {
  private items: T[] = [];
  private wait = 0;

  constructor(private minGap = 0.3, private maxGap = 1, private rand: () => number = Math.random) {}

  push(item: T) {
    this.items.push(item);
  }

  some(pred: (item: T) => boolean) {
    return this.items.some(pred);
  }

  get length() {
    return this.items.length;
  }

  clear() {
    this.items = [];
    this.wait = 0;
  }

  /** dt saniye geçti: sırası gelen öğe (en fazla bir) ya da null. */
  tick(dt: number): T | null {
    if (this.wait > 0) this.wait -= dt;
    if (this.wait > 0 || !this.items.length) return null;
    this.wait = this.minGap + this.rand() * (this.maxGap - this.minGap);
    return this.items.shift()!;
  }
}
