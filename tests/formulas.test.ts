import { describe, it, expect } from 'vitest';
import {
  maxHP, maxMP, maxStamina, expToNext, addExp, strDamageMult, agiMoveMult, dexAttackSpeedMult,
  critChance, luckyMissChance, dropChanceMult, physicalDamage, spellDamage, damageReduction,
  mitigatedDamage, roundDamage, spellAreaMult, mnaRegenMult,
} from '../src/core/formulas';
import { derive } from '../src/core/creature';
import { newJoseph } from '../src/core/state';

describe('Level ve EXP', () => {
  it('Lv n → n+1 için 100×(n+1) EXP', () => {
    expect(expToNext(0)).toBe(100);
    expect(expToNext(1)).toBe(200);
    expect(expToNext(9)).toBe(1000);
  });
  it('EXP eklenince level atlar ve artan devreder', () => {
    expect(addExp(0, 0, 99)).toEqual({ level: 0, exp: 99, levelsGained: 0 });
    expect(addExp(0, 90, 20)).toEqual({ level: 1, exp: 10, levelsGained: 1 });
    expect(addExp(0, 0, 300)).toEqual({ level: 2, exp: 0, levelsGained: 2 });
  });
});

describe('HP / MP / Dayanıklılık', () => {
  it('Max HP = 5 + 5×Level + 5×VIT + bonuslar', () => {
    expect(maxHP(0, 0)).toBe(5);
    expect(maxHP(1, 0)).toBe(10);
    expect(maxHP(3, 4)).toBe(5 + 15 + 20);
    expect(maxHP(0, 0, { hpFlat: 3 })).toBe(8);
    expect(maxHP(2, 2, { hpPct: 0.05 })).toBe(Math.floor(25 * 1.05));
  });
  it('Max MP = Level + 2×MNA (Lv0, MNA0 → 0)', () => {
    expect(maxMP(0, 0)).toBe(0);
    expect(maxMP(3, 2)).toBe(7);
  });
  it('Dayanıklılık = 50 + 3×VIT + 2×AGI', () => {
    expect(maxStamina(0, 0)).toBe(50);
    expect(maxStamina(2, 5)).toBe(66);
  });
});

describe('Stat etkileri', () => {
  it('STR ×(1+0.05×STR)', () => {
    expect(strDamageMult(0)).toBe(1);
    expect(strDamageMult(10)).toBeCloseTo(1.5);
  });
  it('AGI hareket +%1, en fazla +%50', () => {
    expect(agiMoveMult(10)).toBeCloseTo(1.1);
    expect(agiMoveMult(80)).toBeCloseTo(1.5);
  });
  it('DEX saldırı hızı +%1.5, en fazla +%60', () => {
    expect(dexAttackSpeedMult(10)).toBeCloseTo(1.15);
    expect(dexAttackSpeedMult(100)).toBeCloseTo(1.6);
  });
  it('Kritik: taban %5, DEX ≤%20, LUK ≤%10, toplam ≤%60', () => {
    expect(critChance(0, 0)).toBeCloseTo(0.05);
    expect(critChance(10, 10)).toBeCloseTo(0.15);
    expect(critChance(1000, 1000)).toBeCloseTo(0.35);
    expect(critChance(1000, 1000, 0.5)).toBeCloseTo(0.6);
  });
  it('LUK ıskalatma ≤%10, drop ×(1+0.05×LUK)', () => {
    expect(luckyMissChance(4)).toBeCloseTo(0.02);
    expect(luckyMissChance(100)).toBeCloseTo(0.1);
    expect(dropChanceMult(10)).toBeCloseTo(1.5);
  });
  it('MNA MP yenilenmesi +%5, INT alan +%3 (≤%100)', () => {
    expect(mnaRegenMult(4)).toBeCloseTo(1.2);
    expect(spellAreaMult(10)).toBeCloseTo(1.3);
    expect(spellAreaMult(100)).toBeCloseTo(2);
  });
});

describe('Hasar', () => {
  it('Fiziksel hasar formülü', () => {
    expect(physicalDamage({ weaponBase: 2, str: 0 })).toBe(2);
    expect(physicalDamage({ weaponBase: 2, str: 10, crit: true })).toBeCloseTo(6);
    expect(physicalDamage({ weaponBase: 4, str: 0, weakPoint: true, skillMult: 1.15, traitMult: 0.5 })).toBeCloseTo(4 * 1.5 * 1.15 * 0.5);
  });
  it('Büyü hasarı = taban × (1 + 0.05×INT + 0.01×MNA) × skill', () => {
    expect(spellDamage({ spellBase: 10, int: 10, mna: 10 })).toBeCloseTo(16);
    expect(spellDamage({ spellBase: 10, int: 0, mna: 0, skillMult: 1.1 })).toBeCloseTo(11);
  });
  it('Hasar azaltma = DEF/(DEF+20+5×Lv), en fazla %80', () => {
    expect(damageReduction(0, 3)).toBe(0);
    expect(damageReduction(20, 0)).toBeCloseTo(0.5);
    expect(damageReduction(10, 2)).toBeCloseTo(10 / 40);
    expect(damageReduction(100000, 0)).toBe(0.8);
  });
  it('Divine Dayanıklılık 0.5x → iki kat hasar', () => {
    expect(mitigatedDamage(2, 0, 0, 0.5)).toBe(4);
  });
  it('Yuvarlama: isabet en az 1, kesir olasılıkla', () => {
    expect(roundDamage(0.2)).toBe(1);
    expect(roundDamage(2.5, () => 0.4)).toBe(3);
    expect(roundDamage(2.5, () => 0.6)).toBe(2);
    expect(roundDamage(3, () => 0)).toBe(3);
  });
});

describe('Joseph başlangıç', () => {
  it('Lv0, HP 5/5, MP 0/0, tüm statlar 0', () => {
    const j = newJoseph();
    const d = derive(j, { level: 0 });
    expect(j.level).toBe(0);
    expect(d.maxHp).toBe(5);
    expect(d.maxMp).toBe(0);
    expect(Object.values(d.stats).every((v) => v === 0)).toBe(true);
    expect(d.def).toBe(0);
    expect(d.weaponName).toBe('Yumruk');
    expect(d.weaponDmg).toEqual([1, 1]);
    expect(d.divPower).toBeCloseTo(0.5);
    expect(j.equipment.pants).toBe('torn_shorts');
  });
  it('Ekipman statları toplanır', () => {
    const j = newJoseph();
    j.equipment.chest = 'leather_vest';
    j.equipment.pants = 'linen_pants';
    j.alloc.VIT = 2;
    const d = derive(j, { level: 0 });
    expect(d.def).toBe(2);
    expect(d.stats.AGI).toBe(1);
    expect(d.maxHp).toBe(5 + 10);
    expect(d.statSources['Ekipman'].AGI).toBe(1);
  });
});
