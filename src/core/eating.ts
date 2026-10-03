// Yemek yeme bekleme kuralları (Hızlı Yemek butonu ve menüden yeme).
// - Her yemekten sonra 10 sn bekleme.
// - Art arda 3. yemekten sonra 60 sn bekleme.
// - Bir yemek bir öncekinden en az 60 sn sonra yenirse zincir sıfırlanır; bu yemek zincirin ilkidir.
// Testler: tests/eating.test.ts

export const EAT_COOLDOWN = 10;
export const EAT_CHAIN_COOLDOWN = 60;
export const EAT_CHAIN_RESET = 60;
export const EAT_CHAIN_MAX = 3;

export interface EatState {
  /** Son yemeğin zamanı (sn); hiç yenmediyse null. */
  lastAt: number | null;
  /** Şu anki zincir uzunluğu (son yemek dahil). */
  chain: number;
  /** Bir sonraki yemeğin yenebileceği an (sn). */
  readyAt: number;
}

export function newEatState(): EatState {
  return { lastAt: null, chain: 0, readyAt: 0 };
}

export function canEat(s: EatState, now: number): boolean {
  return now >= s.readyAt;
}

/** Zincir: son yemekten bu yana ≥ 60 sn geçtiyse 1, değilse bir fazlası. */
export function nextChain(s: EatState, now: number): number {
  return s.lastAt === null || now - s.lastAt >= EAT_CHAIN_RESET ? 1 : s.chain + 1;
}

/** Yemek yendikten sonraki durum. Yenemiyorsa durum değişmez. */
export function eat(s: EatState, now: number): { ok: boolean; state: EatState; cooldown: number } {
  if (!canEat(s, now)) return { ok: false, state: s, cooldown: s.readyAt - now };
  const chain = nextChain(s, now);
  const cd = chain >= EAT_CHAIN_MAX ? EAT_CHAIN_COOLDOWN : EAT_COOLDOWN;
  return { ok: true, state: { lastAt: now, chain, readyAt: now + cd }, cooldown: cd };
}

/** Kalan bekleme ve toplam bekleme (dairesel geri sayım için). */
export function cooldownInfo(s: EatState, now: number): { left: number; total: number } {
  if (s.lastAt === null) return { left: 0, total: 1 };
  return { left: Math.max(0, s.readyAt - now), total: Math.max(1, s.readyAt - s.lastAt) };
}
