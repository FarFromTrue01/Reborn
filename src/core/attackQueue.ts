// 0.11.0 (A4): saldırı sırası. Aynı hedefe aynı anda en fazla N düşman saldırır; sırasını bekleyenler hedefin
// çevresinde dolaşır. Phaser'sız; her hedefin (Joseph, her yoldaş) kendi sırası var. Uygulaması world/enemy.ts.

/** Bölgeye göre N: bu bölgelerde 2, diğer her yerde (başlangıç bölgeleri, ahır, iç mekânlar) 1. */
export const QUEUE_TWO_ZONES = new Set(['forest_mid', 'forest_deep', 'north_woods', 'goblin_camp']);

export function queueLimit(zoneId: string | null | undefined): number {
  return zoneId && QUEUE_TWO_ZONES.has(zoneId) ? 2 : 1;
}

/** Boss savaştayken (kendi hakkı dışında) en fazla bu kadar yardımcı saldırabilir. */
export const BOSS_HELPERS = 1;
/** Aynı hedefe iki farklı düşmanın vuruşu arasında en az bu kadar saniye. */
export const STRIKE_GAP = 0.5;
/** Bu kadar süredir istekte bulunmayan bekleyen sıradan düşer (öldü, kaçtı, uzaklaştı). */
const STALE_SEC = 0.6;
/** Sıra puanı: bekleme süresi − mesafe × bu katsayı (en uzun bekleyen ve yakın olan önce). */
const DIST_WEIGHT = 0.6;

interface Waiter {
  since: number;
  dist: number;
  seen: number;
}

export interface AttackQueue {
  /** Hakkı olanlar (hazırlık başında alınır). */
  holders: Set<number>;
  waiting: Map<number, Waiter>;
  /** Son vuran ve zamanı. */
  lastStrikeBy: number | null;
  lastStrikeAt: number;
  /** Savaşa giren boss (kendi hakkı dışında). */
  boss: number | null;
}

export function newQueue(): AttackQueue {
  return { holders: new Set(), waiting: new Map(), lastStrikeBy: null, lastStrikeAt: -99, boss: null };
}

/** Düşman bu hedefe saldırmak istiyor (her kare çağrılır). Sırada değilse sona eklenir. */
export function want(q: AttackQueue, id: number, dist: number, now: number): void {
  const w = q.waiting.get(id);
  if (w) {
    w.dist = dist;
    w.seen = now;
  } else if (!q.holders.has(id)) q.waiting.set(id, { since: now, dist, seen: now });
}

function prune(q: AttackQueue, now: number) {
  for (const [id, w] of q.waiting) if (now - w.seen > STALE_SEC) q.waiting.delete(id);
}

/** Bu hedefe aynı anda saldırabilecek düşman sayısı (boss varsa yardımcı sınırı). */
export function effectiveLimit(q: AttackQueue, limit: number): number {
  return q.boss !== null ? BOSS_HELPERS : limit;
}

/** Sırası geldi mi: boş hak var ve (boş hak sayısı kadar) en iyi bekleyenler arasında. Boss her zaman. */
export function isTurn(q: AttackQueue, id: number, limit: number, now: number, isBoss = false): boolean {
  if (isBoss || q.holders.has(id)) return true;
  prune(q, now);
  let holders = 0;
  for (const h of q.holders) if (h !== q.boss) holders++;
  const free = effectiveLimit(q, limit) - holders;
  if (free <= 0) return false;
  const me = q.waiting.get(id);
  if (!me) return false;
  const score = (w: Waiter) => now - w.since - w.dist * DIST_WEIGHT;
  const mine = score(me);
  let better = 0;
  for (const [oid, w] of q.waiting) {
    if (oid === id) continue;
    const s = score(w);
    if (s > mine || (s === mine && oid < id)) better++;
  }
  return better < free;
}

/** Hazırlık başında hak alınır. Sırası değilse false (hazırlığa başlamaz). */
export function acquire(q: AttackQueue, id: number, limit: number, now: number, isBoss = false): boolean {
  if (!isTurn(q, id, limit, now, isBoss)) return false;
  q.waiting.delete(id);
  q.holders.add(id);
  if (isBoss) q.boss = id;
  return true;
}

/**
 * Hak bırakılır (saldırı bitti, öldü, kaçtı, sersemledi). `requeue`: saldırısını bitiren sıranın sonuna geçer;
 * ölen/kaçan sıradan tamamen çıkar.
 */
export function release(q: AttackQueue, id: number, now: number, requeue = true): void {
  q.holders.delete(id);
  q.waiting.delete(id);
  if (requeue) q.waiting.set(id, { since: now, dist: 0, seen: now });
}

/** Boss savaştan çıktı (öldü / eve döndü). */
export function clearBoss(q: AttackQueue, id: number): void {
  if (q.boss === id) q.boss = null;
}

/** Vuruş anı gelebilir mi: başka bir düşman bu hedefe 0,5 sn içinde vurduysa hazırlık biraz uzar. */
export function canStrike(q: AttackQueue, id: number, now: number): boolean {
  return q.lastStrikeBy === null || q.lastStrikeBy === id || now - q.lastStrikeAt >= STRIKE_GAP;
}

export function noteStrike(q: AttackQueue, id: number, now: number): void {
  q.lastStrikeBy = id;
  q.lastStrikeAt = now;
}
