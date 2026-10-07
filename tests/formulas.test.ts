import { describe, it, expect } from 'vitest';
import {
  maxHP, maxMP, maxStamina, expToNext, addExp, strDamageMult, agiMoveMult, agiAttackSpeedMult,
  critChance, luckyMissChance, dropChanceMult, physicalDamage, spellDamage, damageReduction,
  mitigatedDamage, roundDamage, applyDamage, spellAreaMult, intRegenMult, STAT_KEYS, STAT_POINTS_PER_LEVEL,
  agiDodgeCostMult, agiDodgeWindowMult, gatherDoubleChance, skillExpMult, statusDurationMult, spellPowerMult, luckOutcome,
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

describe('HP / MP / Dayanıklılık (0.10.0: 5 stat, VIT yüzdeli, taban 10)', () => {
  it('Beş stat, level başına 4 puan', () => {
    expect([...STAT_KEYS]).toEqual(['STR', 'VIT', 'AGI', 'INT', 'LUK']);
    expect(STAT_POINTS_PER_LEVEL).toBe(4);
  });
  it('Max HP = (10 + 8×Level + düz) × (1 + 0,08×VIT) × (1 + yüzde), bir ondalık', () => {
    expect(maxHP(0, 0)).toBe(10);
    expect(maxHP(1, 0)).toBe(18);
    expect(maxHP(3, 4)).toBe(Math.round(34 * 1.32 * 10) / 10);
    expect(maxHP(0, 0, { hpFlat: 3 })).toBe(13);
    expect(maxHP(2, 2, { hpPct: 0.05 })).toBe(Math.round(26 * 1.16 * 1.05 * 10) / 10);
    expect(maxHP(0, 1)).toBe(10.8);
  });
  it('Max MP = Level + 3×INT (Lv0, INT0 → 0)', () => {
    expect(maxMP(0, 0)).toBe(0);
    expect(maxMP(3, 2)).toBe(9);
  });
  it('Dayanıklılık = 50 + 5×VIT + 3×AGI', () => {
    expect(maxStamina(0, 0)).toBe(50);
    expect(maxStamina(2, 5)).toBe(75);
  });
});

describe('Stat etkileri (0.10.0)', () => {
  it('STR ×(1+0.08×STR), tavansız', () => {
    expect(strDamageMult(0)).toBe(1);
    expect(strDamageMult(10)).toBeCloseTo(1.8);
    expect(strDamageMult(100)).toBeCloseTo(9);
  });
  it('VIT: durum etkisi süresi −%2/puan, en fazla −%40', () => {
    expect(statusDurationMult(0)).toBe(1);
    expect(statusDurationMult(10)).toBeCloseTo(0.8);
    expect(statusDurationMult(50)).toBeCloseTo(0.6);
  });
  it('AGI: hareket +%1 (≤%50), saldırı hızı +%1,5 (≤%60), kaçış bedeli −%1 (≤−%30), kusursuz pencere +%1 (≤+%30)', () => {
    expect(agiMoveMult(10)).toBeCloseTo(1.1);
    expect(agiMoveMult(80)).toBeCloseTo(1.5);
    expect(agiAttackSpeedMult(10)).toBeCloseTo(1.15);
    expect(agiAttackSpeedMult(100)).toBeCloseTo(1.6);
    expect(agiDodgeCostMult(10)).toBeCloseTo(0.9);
    expect(agiDodgeCostMult(99)).toBeCloseTo(0.7);
    expect(agiDodgeWindowMult(10)).toBeCloseTo(1.1);
    expect(agiDodgeWindowMult(99)).toBeCloseTo(1.3);
  });
  it('Kritik: taban %5, AGI %0,4 (≤%20), LUK %0,6 (≤%10), toplam ≤%60', () => {
    expect(critChance(0, 0)).toBeCloseTo(0.05);
    expect(critChance(10, 10)).toBeCloseTo(0.05 + 0.04 + 0.06);
    expect(critChance(1000, 1000)).toBeCloseTo(0.35);
    expect(critChance(1000, 1000, 0.5)).toBeCloseTo(0.6);
  });
  it('LUK: ıskalatma ≤%10, ganimet ×(1+0.06×LUK), çift ürün +%1 (≤%20)', () => {
    expect(luckyMissChance(4)).toBeCloseTo(0.02);
    expect(luckyMissChance(100)).toBeCloseTo(0.1);
    expect(dropChanceMult(10)).toBeCloseTo(1.6);
    expect(gatherDoubleChance(5)).toBeCloseTo(0.05);
    expect(gatherDoubleChance(50)).toBeCloseTo(0.2);
  });
  it('INT: MP yenilenmesi +%3, büyü gücü +%6, alan +%3 (≤%100), skill EXP +%1,5 (≤%50)', () => {
    expect(intRegenMult(4)).toBeCloseTo(1.12);
    expect(spellPowerMult(10)).toBeCloseTo(1.6);
    expect(spellAreaMult(10)).toBeCloseTo(1.3);
    expect(spellAreaMult(100)).toBeCloseTo(2);
    expect(skillExpMult(10)).toBeCloseTo(1.15);
    expect(skillExpMult(100)).toBeCloseTo(1.5);
  });
  it('"Şans!" tespiti: yalnızca LUK\'un eklediği aralık', () => {
    expect(luckOutcome(0.04, 0.05, 0.08)).toBe('hit');
    expect(luckOutcome(0.06, 0.05, 0.08)).toBe('luck');
    expect(luckOutcome(0.09, 0.05, 0.08)).toBe('miss');
    expect(luckOutcome(0.5, 0.6, 1.2)).toBe('hit');
  });
});

describe('Hasar', () => {
  it('Fiziksel hasar formülü', () => {
    expect(physicalDamage({ weaponBase: 2, str: 0 })).toBe(2);
    expect(physicalDamage({ weaponBase: 2, str: 10, crit: true })).toBeCloseTo(2 * 1.8 * 2);
    expect(physicalDamage({ weaponBase: 4, str: 0, weakPoint: true, skillMult: 1.15, traitMult: 0.5 })).toBeCloseTo(4 * 1.5 * 1.15 * 0.5);
  });
  it('Büyü hasarı = taban × (1 + 0.06×INT) × skill', () => {
    expect(spellDamage({ spellBase: 10, int: 10 })).toBeCloseTo(16);
    expect(spellDamage({ spellBase: 10, int: 0, skillMult: 1.1 })).toBeCloseTo(11);
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
  it('Lv0, HP 10/10 (0.10.0), MP 0/0, tüm statlar 0', () => {
    const j = newJoseph();
    const d = derive(j, { level: 0 });
    expect(j.level).toBe(0);
    expect(d.maxHp).toBe(10);
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
    expect(d.maxHp).toBe(11.6); // 10 × (1 + 0,08×2)
    expect(d.statSources['Ekipman'].AGI).toBe(1);
  });
});
