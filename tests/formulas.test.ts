import { describe, it, expect } from 'vitest';
import {
  maxHP, maxMP, maxStamina, expToNext, addExp, strDamageMult, agiMoveMult, dexAttackSpeedMult,
  critChance, luckyMissChance, dropChanceMult, physicalDamage, spellDamage, damageReduction,
  mitigatedDamage, roundDamage, applyDamage, spellAreaMult, mnaRegenMult,
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
  it('Max HP = 5 + 8×Level + 8×VIT + bonuslar', () => {
    expect(maxHP(0, 0)).toBe(5);
    expect(maxHP(1, 0)).toBe(13);
    expect(maxHP(3, 4)).toBe(5 + 24 + 32);
    expect(maxHP(0, 0, { hpFlat: 3 })).toBe(8);
    expect(maxHP(2, 2, { hpPct: 0.05 })).toBe(Math.floor(37 * 1.05));
  });
  it('Max MP = Level + 3×MNA (Lv0, MNA0 → 0)', () => {
    expect(maxMP(0, 0)).toBe(0);
    expect(maxMP(3, 2)).toBe(9);
  });
  it('Dayanıklılık = 50 + 3×VIT + 2×AGI', () => {
    expect(maxStamina(0, 0)).toBe(50);
    expect(maxStamina(2, 5)).toBe(66);
  });
});

describe('Stat etkileri', () => {
  it('STR ×(1+0.08×STR): bir levelin 6 puanı +%48', () => {
    expect(strDamageMult(0)).toBe(1);
    expect(strDamageMult(10)).toBeCloseTo(1.8);
    expect(strDamageMult(6)).toBeCloseTo(1.48);
  });
  it('AGI hareket +%1,5, en fazla +%60', () => {
    expect(agiMoveMult(10)).toBeCloseTo(1.15);
    expect(agiMoveMult(40)).toBeCloseTo(1.6);
    expect(agiMoveMult(80)).toBeCloseTo(1.6);
  });
  it('DEX saldırı hızı +%2, en fazla +%70', () => {
    expect(dexAttackSpeedMult(10)).toBeCloseTo(1.2);
    expect(dexAttackSpeedMult(35)).toBeCloseTo(1.7);
    expect(dexAttackSpeedMult(100)).toBeCloseTo(1.7);
  });
  it('Kritik: taban %5, DEX %0,5 (≤%20), LUK %0,6 (≤%10), toplam ≤%60', () => {
    expect(critChance(0, 0)).toBeCloseTo(0.05);
    expect(critChance(10, 10)).toBeCloseTo(0.05 + 0.05 + 0.06);
    expect(critChance(1000, 1000)).toBeCloseTo(0.35);
    expect(critChance(1000, 1000, 0.5)).toBeCloseTo(0.6);
  });
  it('LUK ıskalatma ≤%10, drop ×(1+0.06×LUK)', () => {
    expect(luckyMissChance(4)).toBeCloseTo(0.02);
    expect(luckyMissChance(100)).toBeCloseTo(0.1);
    expect(dropChanceMult(10)).toBeCloseTo(1.6);
  });
  it('MNA MP yenilenmesi +%3 (0.9.0), INT alan +%3 (≤%100)', () => {
    expect(mnaRegenMult(4)).toBeCloseTo(1.12);
    expect(spellAreaMult(10)).toBeCloseTo(1.3);
    expect(spellAreaMult(100)).toBeCloseTo(2);
  });
});

describe('Hasar', () => {
  it('Fiziksel hasar formülü', () => {
    expect(physicalDamage({ weaponBase: 2, str: 0 })).toBe(2);
    expect(physicalDamage({ weaponBase: 2, str: 10, crit: true })).toBeCloseTo(2 * 1.8 * 2);
    expect(physicalDamage({ weaponBase: 4, str: 0, weakPoint: true, skillMult: 1.15, traitMult: 0.5 })).toBeCloseTo(4 * 1.5 * 1.15 * 0.5);
  });
  it('Büyü hasarı = taban × (1 + 0.06×INT + 0.01×MNA) × skill', () => {
    expect(spellDamage({ spellBase: 10, int: 10, mna: 10 })).toBeCloseTo(17);
    expect(spellDamage({ spellBase: 10, int: 0, mna: 0, skillMult: 1.1 })).toBeCloseTo(11);
  });
  it('Hasar azaltma = DEF/(DEF+20+5×Lv), en fazla %80', () => {
    expect(damageReduction(0, 3)).toBe(0);
    expect(damageReduction(20, 0)).toBeCloseTo(0.5);
    expect(damageReduction(10, 2)).toBeCloseTo(10 / 40);
    expect(damageReduction(100000, 0)).toBe(0.8);
  });
  it('Dayanıklılık böleni: 2x → yarı hasar (Divine Dayanıklılık 1\'in altına inmez)', () => {
    expect(mitigatedDamage(2, 0, 0, 2)).toBe(1);
    expect(mitigatedDamage(2, 0, 0, 1)).toBe(2);
  });
  it('Yuvarlama: 10 altı bir ondalık, 10 ve üstü tam sayı, en az 0,1, "en az 1" yok', () => {
    expect(roundDamage(0.5)).toBe(0.5);
    expect(roundDamage(0.2)).toBe(0.2);
    expect(roundDamage(0.04)).toBe(0.1);
    expect(roundDamage(0)).toBe(0.1);
    expect(roundDamage(1)).toBe(1);
    expect(roundDamage(3.66)).toBe(3.7);
    expect(roundDamage(3.64)).toBe(3.6);
    expect(roundDamage(9.94)).toBe(9.9);
    expect(roundDamage(9.96)).toBe(10);
    expect(roundDamage(14.4)).toBe(14);
    expect(roundDamage(26.5)).toBe(27);
    expect(roundDamage(103.2)).toBe(103);
  });
  it('Hasar sonrası HP bir ondalığa sabitlenir (kayan nokta artığı yaşatmaz)', () => {
    expect(applyDamage(1, 0.3)).toBe(0.7);
    expect(applyDamage(applyDamage(1, 0.3), 0.7)).toBe(0);
    expect(applyDamage(2, 5)).toBe(0);
    let hp = 3;
    for (let i = 0; i < 30; i++) hp = applyDamage(hp, 0.1);
    expect(hp).toBe(0);
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
    // 0.8.0: Hız, Dayanıklılık ve Adaptasyon 0,75'in altına inmez
    expect(d.divSpeed).toBe(0.75);
    expect(d.divEndurance).toBe(0.75);
    expect(d.divAdaptation).toBe(0.75);
    expect(d.moveSpeed).toBe(0.75);
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
    expect(d.maxHp).toBe(5 + 16);
    expect(d.statSources['Ekipman'].AGI).toBe(1);
  });
});
