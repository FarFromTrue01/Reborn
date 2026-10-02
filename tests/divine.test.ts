import { describe, it, expect } from 'vitest';
import {
  divineCoefficient, divineExpToNext, challengeExp, streakMultiplier, victoryDivineExp, trainingExp,
  addDivineExp, movementWithDivine, divineStat, debuffDurationMult, isAwakeningLevel,
} from '../src/core/divine';

describe('Divine katsayıları', () => {
  it('0.5 × 1.15^L × 1.5^floor(L/3)', () => {
    expect(divineCoefficient(0)).toBeCloseTo(0.5);
    expect(divineCoefficient(1)).toBeCloseTo(0.575);
    expect(divineCoefficient(2)).toBeCloseTo(0.66125);
    expect(divineCoefficient(3)).toBeCloseTo(0.5 * 1.15 ** 3 * 1.5);
    expect(divineCoefficient(6)).toBeCloseTo(0.5 * 1.15 ** 6 * 2.25);
  });
  it('Awakening her 3 levelde', () => {
    expect(isAwakeningLevel(0)).toBe(false);
    expect(isAwakeningLevel(3)).toBe(true);
    expect(isAwakeningLevel(4)).toBe(false);
    expect(isAwakeningLevel(6)).toBe(true);
  });
  it('Adaptasyon en fazla 5x', () => {
    expect(divineStat('adaptation', 30)).toBe(5);
    expect(divineStat('power', 30)).toBeGreaterThan(5);
  });
  it('Divine EXP gereksinimi 500×(n+1)', () => {
    expect(divineExpToNext(0)).toBe(500);
    expect(divineExpToNext(4)).toBe(2500);
  });
});

describe('Divine EXP kaynakları', () => {
  it('Meydan okuma: d<0 → 0, d=0 → 5, d≥1 → 5(d+1)², boss ×3', () => {
    expect(challengeExp(0, 1)).toBe(0);
    expect(challengeExp(1, 1)).toBe(5);
    expect(challengeExp(1, 0)).toBe(20);
    expect(challengeExp(2, 0)).toBe(45);
    expect(challengeExp(3, 0, true)).toBe(240);
  });
  it('Seri bonusu +%10/zafer, en fazla +%50', () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(3)).toBeCloseTo(1.3);
    expect(streakMultiplier(12)).toBeCloseTo(1.5);
    expect(victoryDivineExp(1, 0, false, 2)).toBe(24);
  });
  it('Antrenman %3–5', () => {
    expect(trainingExp(0, 0)).toBe(15);
    expect(trainingExp(0, 1)).toBe(25);
    expect(trainingExp(2, 0.5)).toBe(Math.round(1500 * 0.04));
  });
  it('Level atlama ve awakening listesi', () => {
    const r = addDivineExp(0, 0, 500 + 1000 + 1500 + 10);
    expect(r.level).toBe(3);
    expect(r.exp).toBe(10);
    expect(r.awakenings).toEqual([3]);
  });
});

describe('Hız ve adaptasyon sınırları', () => {
  it('Toplam hareket çarpanı en fazla 1.6x, fazlası taşar', () => {
    expect(movementWithDivine(1, 0.5).move).toBeCloseTo(0.5);
    const m = movementWithDivine(1.5, 1.5);
    expect(m.move).toBe(1.6);
    expect(m.overflow).toBeCloseTo(0.65);
  });
  it('Olumsuz etki süresi: 0.5x adaptasyon iki kat, en az %25', () => {
    expect(debuffDurationMult(0.5)).toBe(2);
    expect(debuffDurationMult(1)).toBe(1);
    expect(debuffDurationMult(10)).toBe(0.25);
  });
});
