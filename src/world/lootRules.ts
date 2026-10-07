// 0.11.0 (C16): ganimet ışıltısının saf kuralları (Phaser'sız; world/lootFx çizer).

export const LOOT_LIFE_SEC = 120;
export const LOOT_BLINK_SEC = 15;
export const LOOT_FX_MAX = 20;

export type LootKind = 'common' | 'money' | 'special';

export const LOOT_COLOR: Record<LootKind, number> = { common: 0xfff2b0, money: 0xffd040, special: 0xffc030 };

/** Yanıp sönme: son 15 sn'de görünür mü (giderek hızlanır)? */
export function lootVisible(t: number, life = LOOT_LIFE_SEC): boolean {
  const left = life - t;
  if (left > LOOT_BLINK_SEC) return true;
  const rate = left > 5 ? 3 : 6;
  return Math.floor(t * rate * 2) % 2 === 0;
}

/** Nabız (0..1). */
export function lootPulse(t: number): number {
  return 0.5 + 0.5 * Math.sin(t * 3.2);
}

