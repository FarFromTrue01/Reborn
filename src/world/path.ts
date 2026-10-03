// Izgara üzerinde A* yol bulma (NPC'ler için).

const inside = (W: number, H: number, x: number, y: number) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < W && y < H;

/**
 * Harita başına yol arama bütçesi (A* adım sınırı). İç mekânlar küçük (ör. han 21×14):
 * karo sayısının birkaç katı yeter; dış dünyada uzun yollar için geniş bütçe.
 */
export function pathBudget(W: number, H: number, indoor: boolean): number {
  return indoor ? Math.min(24000, Math.max(400, W * H * 4)) : 24000;
}

export function findPath(solid: Uint8Array, W: number, H: number, sx: number, sy: number, tx: number, ty: number, maxIter = 6000): [number, number][] | null {
  // Harita dışı başlangıç/hedef: yol yok. (Eskiden hedef dizinin dışına düşünce from[goal]
  // undefined oluyor ve yolu geri izleyen döngü sonsuza dek dönüp oyunu donduruyordu.)
  if (!inside(W, H, sx, sy) || !inside(W, H, tx, ty)) return null;
  if (sx === tx && sy === ty) return [];
  const N = W * H;
  const g = new Float32Array(N).fill(Infinity);
  const from = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const heap: number[] = [];
  const f = new Float32Array(N);
  const push = (i: number) => {
    heap.push(i);
    let c = heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (f[heap[p]] <= f[heap[c]]) break;
      [heap[p], heap[c]] = [heap[c], heap[p]];
      c = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let c = 0;
      for (;;) {
        const l = c * 2 + 1, r = l + 1;
        let m = c;
        if (l < heap.length && f[heap[l]] < f[heap[m]]) m = l;
        if (r < heap.length && f[heap[r]] < f[heap[m]]) m = r;
        if (m === c) break;
        [heap[m], heap[c]] = [heap[c], heap[m]];
        c = m;
      }
    }
    return top;
  };
  const h = (x: number, y: number) => {
    const dx = Math.abs(x - tx), dy = Math.abs(y - ty);
    return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
  };
  const start = sy * W + sx;
  const goal = ty * W + tx;
  g[start] = 0;
  f[start] = h(sx, sy);
  push(start);
  let iter = 0;
  const free = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && (!solid[y * W + x] || y * W + x === goal);
  while (heap.length && iter++ < maxIter) {
    const cur = pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % W, cy = (cur - cx) / W;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (!free(nx, ny)) continue;
        if (dx && dy && (!free(cx + dx, cy) || !free(cx, cy + dy))) continue; // köşe kesme yok
        const ni = ny * W + nx;
        const ng = g[cur] + (dx && dy ? Math.SQRT2 : 1);
        if (ng < g[ni]) {
          g[ni] = ng;
          from[ni] = cur;
          f[ni] = ng + h(nx, ny);
          push(ni);
        }
      }
  }
  if (from[goal] === -1) return null;
  const out: [number, number][] = [];
  let c = goal;
  // Yol en fazla N karo olabilir: sınır, beklenmedik bir döngüde bile takılmayı önler.
  while (c !== start && c >= 0 && out.length <= N) {
    out.push([c % W, Math.floor(c / W)]);
    c = from[c];
  }
  if (c !== start) return null;
  out.reverse();
  return out;
}

/** En yakın boş karo. Harita dışındaki bir nokta önce kenara çekilir. */
export function nearestFree(solid: Uint8Array, W: number, H: number, x: number, y: number): [number, number] {
  x = Math.min(W - 1, Math.max(0, Math.round(x) || 0));
  y = Math.min(H - 1, Math.max(0, Math.round(y) || 0));
  if (!solid[y * W + x]) return [x, y];
  for (let r = 1; r < 8; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && !solid[ny * W + nx]) return [nx, ny];
      }
  return [x, y];
}
