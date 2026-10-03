// Akşam hanında donma: harita dışı yol hedefi, yol arama kuyruğu ve kapıdan teker teker giriş.
import { describe, it, expect } from 'vitest';
import { findPath, nearestFree, pathBudget } from '../src/world/path';
import { PathQueue, ArrivalQueue } from '../src/world/npcQueue';

/** Kenarları duvar olan W×H oda. */
function room(W: number, H: number) {
  const solid = new Uint8Array(W * H);
  for (let x = 0; x < W; x++) solid[x] = solid[(H - 1) * W + x] = 1;
  for (let y = 0; y < H; y++) solid[y * W] = solid[y * W + W - 1] = 1;
  return solid;
}

describe('findPath / nearestFree: harita dışı karolar', () => {
  const W = 21, H = 14;
  const solid = room(W, H);

  it('hedef haritanın üstünde (y = -1): sonsuz döngü yerine null', () => {
    // yieldTo(): üst duvarın dibindeki NPC iki karo yukarı çekilmek isteyince hedef y = -1 oluyordu
    expect(findPath(solid, W, H, 5, 1, 5, -1, 24000)).toBeNull();
  });

  it('hedef sağ kenarın dışında ya da dizinin sonunun ötesinde: null', () => {
    expect(findPath(solid, W, H, 5, 5, W + 3, 5, 24000)).toBeNull();
    expect(findPath(solid, W, H, 5, 5, 5, H + 2, 24000)).toBeNull();
    expect(findPath(solid, W, H, -1, 5, 5, 5, 24000)).toBeNull();
    expect(findPath(solid, W, H, 5, 5, NaN, 5, 24000)).toBeNull();
  });

  it('nearestFree harita dışındaki noktayı içerideki en yakın boş karoya çeker', () => {
    const [x, y] = nearestFree(solid, W, H, 5, -1);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(1);
    expect(solid[y * W + x]).toBe(0);
    const [x2, y2] = nearestFree(solid, W, H, W + 5, H + 5);
    expect(x2).toBeLessThan(W);
    expect(y2).toBeLessThan(H);
    expect(solid[y2 * W + x2]).toBe(0);
  });

  it('yieldTo zinciri (nearestFree → findPath) kenarda da geçerli bir yol verir', () => {
    const [gx, gy] = nearestFree(solid, W, H, 5, -1);
    const p = findPath(solid, W, H, 5, 2, gx, gy, pathBudget(W, H, true));
    expect(p).not.toBeNull();
    for (const [x, y] of p!) {
      expect(x >= 0 && y >= 0 && x < W && y < H).toBe(true);
    }
  });

  it('normal yol hâlâ bulunur', () => {
    const p = findPath(solid, W, H, 1, 1, 19, 12, pathBudget(W, H, true));
    expect(p).not.toBeNull();
    expect(p![p!.length - 1]).toEqual([19, 12]);
  });

  it('iç mekân bütçesi küçük, dış dünya bütçesi geniş', () => {
    expect(pathBudget(21, 14, true)).toBeLessThan(2000);
    expect(pathBudget(21, 14, true)).toBeGreaterThanOrEqual(400);
    expect(pathBudget(400, 300, false)).toBe(24000);
  });
});

describe('PathQueue: karede en fazla bir yol araması', () => {
  it('20 NPC aynı anda isterse her tick yalnızca biri çalışır', () => {
    const q = new PathQueue();
    let ran = 0;
    const owners = Array.from({ length: 20 }, () => ({}));
    for (const o of owners) q.request(o, () => ran++);
    expect(q.tick(1)).toBe(1);
    expect(ran).toBe(1);
    expect(q.size).toBe(19);
    for (let i = 0; i < 30; i++) q.tick(1);
    expect(ran).toBe(20);
    expect(q.size).toBe(0);
  });

  it('aynı NPC yeniden isterse eski isteğin yerine geçer (sırasını korur)', () => {
    const q = new PathQueue();
    const a = {}, b = {};
    const log: string[] = [];
    q.request(a, () => log.push('a1'));
    q.request(b, () => log.push('b'));
    q.request(a, () => log.push('a2'));
    q.tick(5);
    expect(log).toEqual(['a2', 'b']);
  });

  it('iptal edilen (kaldırılan NPC) istek çalışmaz', () => {
    const q = new PathQueue();
    const a = {};
    let ran = false;
    q.request(a, () => (ran = true));
    q.cancel(a);
    q.tick(1);
    expect(ran).toBe(false);
  });
});

describe('ArrivalQueue: kapıdan teker teker giriş', () => {
  it('kare başına en fazla bir NPC, aralarında 0,3–1 sn', () => {
    let r = 0;
    const rands = [0, 0.5, 1, 0.25];
    const q = new ArrivalQueue<number>(0.3, 1, () => rands[r++ % rands.length]);
    for (let i = 0; i < 5; i++) q.push(i);
    const dt = 1 / 60;
    const times: number[] = [];
    let t = 0;
    for (let f = 0; f < 600 && times.length < 5; f++) {
      const got = q.tick(dt);
      if (got !== null) times.push(t);
      t += dt;
    }
    expect(times.length).toBe(5);
    expect(times[0]).toBe(0); // ilk gelen hemen girer
    for (let i = 1; i < times.length; i++) {
      const gap = times[i] - times[i - 1];
      expect(gap).toBeGreaterThanOrEqual(0.3 - 1e-9);
      expect(gap).toBeLessThanOrEqual(1 + dt + 1e-9);
    }
  });

  it('tek bir tick asla birden fazla öğe vermez (büyük dt olsa bile)', () => {
    const q = new ArrivalQueue<number>(0.3, 1, () => 0);
    for (let i = 0; i < 10; i++) q.push(i);
    expect(q.tick(5)).toBe(0);
    expect(q.length).toBe(9);
    expect(q.tick(5)).toBe(1);
    expect(q.length).toBe(8);
  });
});
