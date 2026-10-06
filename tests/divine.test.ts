import { describe, it, expect } from 'vitest';
import {
  divineCoefficient, divineExpToNext, challengeRate, challengeDecay, challengeExp, streakMultiplier, victoryDivineExp,
  trainingExp, addDivineExp, movementWithDivine, divineStat, debuffDurationMult, isAwakeningLevel, streakExpired,
  STREAK_TIMEOUT_SEC, ADAPTATION_CAP,
} from '../src/core/divine';
import { TRAINING_SPOTS } from '../src/data/props';

describe('Divine katsayıları', () => {
  it('0.5 × 1.20^L × 1.32^floor(L/3)', () => {
    expect(divineCoefficient(0)).toBeCloseTo(0.5);
    expect(divineCoefficient(1)).toBeCloseTo(0.6);
    expect(divineCoefficient(2)).toBeCloseTo(0.72);
    expect(divineCoefficient(3)).toBeCloseTo(0.5 * 1.2 ** 3 * 1.32);
    expect(divineCoefficient(6)).toBeCloseTo(0.5 * 1.2 ** 6 * 1.32 ** 2);
  });
  it('3\'ün katı her levelde eski formülle (1.15^L × 1.5^⌊L/3⌋) aynı değer', () => {
    const old = (l: number) => 0.5 * 1.15 ** l * 1.5 ** Math.floor(l / 3);
    // 1.20³ × 1.32 = 2.28096 ≈ 1.15³ × 1.5 = 2.28131 (awakening başına fark %0,015): aynı yere varılır
    for (const l of [0, 3, 6, 9, 12, 15, 30]) expect(Math.abs(divineCoefficient(l) / old(l) - 1)).toBeLessThan(0.0016);
    for (const l of [0, 3, 6]) expect(divineCoefficient(l).toFixed(2)).toBe(old(l).toFixed(2));
    expect(divineCoefficient(3)).toBeCloseTo(1.14, 2);
    expect(divineCoefficient(6)).toBeCloseTo(2.6, 2);
    expect(divineCoefficient(9)).toBeCloseTo(5.93, 2);
    expect(divineCoefficient(12)).toBeCloseTo(13.53, 2);
  });
  it('Aradaki leveller artık boş geçmiyor: her level bir öncekinden büyük', () => {
    for (let l = 0; l < 30; l++) expect(divineCoefficient(l + 1)).toBeGreaterThan(divineCoefficient(l) * 1.19);
  });
  it('Awakening her 3 levelde', () => {
    expect(isAwakeningLevel(0)).toBe(false);
    expect(isAwakeningLevel(3)).toBe(true);
    expect(isAwakeningLevel(4)).toBe(false);
    expect(isAwakeningLevel(6)).toBe(true);
  });
  it('Divine EXP gereksinimi 500×(n+1)', () => {
    expect(divineExpToNext(0)).toBe(500);
    expect(divineExpToNext(1)).toBe(1000);
    expect(divineExpToNext(2)).toBe(1500);
    expect(divineExpToNext(9)).toBe(5000);
  });
});

describe('Divine stat tabanları', () => {
  it('Güç ve Öğrenme ham katsayı: 0,50 · 0,60 · 0,72 · 1,14', () => {
    for (const s of ['power', 'learning'] as const) {
      expect(divineStat(s, 0)).toBeCloseTo(0.5);
      expect(divineStat(s, 1)).toBeCloseTo(0.6);
      expect(divineStat(s, 2)).toBeCloseTo(0.72);
      expect(divineStat(s, 3)).toBeCloseTo(1.14, 2);
    }
  });
  it('Hız ve Dayanıklılık max(0,75; katsayı) (0.8.0): 0,75 · 0,75 · 0,75 · 1,14', () => {
    for (const s of ['speed', 'endurance'] as const) {
      expect(divineStat(s, 0)).toBe(0.75);
      expect(divineStat(s, 1)).toBe(0.75);
      expect(divineStat(s, 2)).toBeCloseTo(0.75, 5);
      expect(divineStat(s, 3)).toBeCloseTo(1.14, 2);
    }
  });
  it('Adaptasyon max(0,75; katsayı), tavan 5', () => {
    expect(divineStat('adaptation', 0)).toBe(0.75);
    expect(divineStat('adaptation', 2)).toBe(0.75);
    expect(divineStat('adaptation', 3)).toBeCloseTo(1.14, 2);
    expect(divineStat('adaptation', 30)).toBe(ADAPTATION_CAP);
    expect(divineStat('power', 30)).toBeGreaterThan(5);
  });
  it('L3\'ten itibaren beşi de aynı eğride', () => {
    for (let l = 3; l <= 8; l++) { // L9'da (5,93) Adaptasyon tavana (5) takılır
      const c = divineCoefficient(l);
      for (const s of ['power', 'speed', 'endurance', 'learning', 'adaptation'] as const) expect(divineStat(s, l)).toBeCloseTo(c);
    }
  });
});

describe('Divine EXP: öldürme', () => {
  it('Oran tablosu (d = yaratık leveli − normal level)', () => {
    expect(challengeRate(-5)).toBe(0);
    expect(challengeRate(-3)).toBe(0);
    expect(challengeRate(-2)).toBe(0.003);
    expect(challengeRate(-1)).toBe(0.008);
    expect(challengeRate(0)).toBe(0.02);
    expect(challengeRate(1)).toBe(0.04);
    expect(challengeRate(2)).toBe(0.08);
    expect(challengeRate(3)).toBe(0.15);
    expect(challengeRate(4)).toBe(0.25);
    expect(challengeRate(9)).toBe(0.25);
  });
  it('Azalma 0.5^(L/5): her 5 divine levelde yarıya', () => {
    expect(challengeDecay(0)).toBe(1);
    expect(challengeDecay(5)).toBeCloseTo(0.5);
    expect(challengeDecay(10)).toBeCloseTo(0.25);
  });
  it('EXP = oran × divineExpToNext(L) × azalma, boss ×3', () => {
    expect(challengeExp(0, 0, 0)).toBeCloseTo(10);
    expect(challengeExp(1, 0, 0)).toBeCloseTo(20);
    expect(challengeExp(3, 0, 0, true)).toBeCloseTo(0.15 * 500 * 3);
    expect(challengeExp(1, 1, 5)).toBeCloseTo(0.02 * 3000 * 0.5);
  });
  it('d normal levelle, azalma divine levelle: ikisi karışmaz', () => {
    // Normal Lv2, Divine Lv0, yaratık Lv2 → d=0, azalma yok
    expect(victoryDivineExp(2, 2, 0, false, 0)).toBe(10);
    // Normal Lv0, Divine Lv2, yaratık Lv2 → d=+2, azalma 0.5^(2/5)
    expect(victoryDivineExp(2, 0, 2, false, 0)).toBe(Math.round(0.08 * 1500 * 0.5 ** 0.4));
  });
  it('Eş seviye avla level atlama: L0 50, L5 100, L10 197 öldürme', () => {
    const kills = (l: number) => Math.ceil(divineExpToNext(l) / victoryDivineExp(0, 0, l, false, 0));
    expect(kills(0)).toBe(50);
    expect(kills(5)).toBe(100);
    expect(kills(10)).toBe(197);
  });
  it('En az 1 EXP (oranı 0 olanlar hariç)', () => {
    expect(victoryDivineExp(0, 2, 20, false, 0)).toBe(2); // %0,3 × 10500 × 1/16 ≈ 1,97
    expect(victoryDivineExp(0, 1, 40, false, 0)).toBe(1); // çok küçük → 1
    expect(victoryDivineExp(0, 3, 0, false, 0)).toBe(0); // d=−3 → gerçekten 0
    expect(victoryDivineExp(0, 9, 0, true, 5)).toBe(0);
  });
  it('Seri bonusu +%10/zafer, en fazla +%50', () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(3)).toBeCloseTo(1.3);
    expect(streakMultiplier(12)).toBeCloseTo(1.5);
    expect(victoryDivineExp(1, 0, 0, false, 2)).toBe(24);
    expect(victoryDivineExp(1, 0, 0, true, 20)).toBe(90);
  });
  it('Seri 30 sn öldürmesiz kalınca sıfırlanır', () => {
    expect(STREAK_TIMEOUT_SEC).toBe(30);
    expect(streakExpired(29.9)).toBe(false);
    expect(streakExpired(30)).toBe(false);
    expect(streakExpired(30.1)).toBe(true);
  });
});

describe('Divine EXP: antrenman', () => {
  it('Noktaya özgü sabit aralık, performansa göre', () => {
    expect(trainingExp([12, 25], 0)).toBe(12);
    expect(trainingExp([12, 25], 1)).toBe(25);
    expect(trainingExp([12, 25], 0.5)).toBe(19);
    expect(trainingExp([12, 25], 7)).toBe(25);
  });
  it('Köyün üç antrenman noktası 12–25, divine levelden bağımsız', () => {
    for (const id of ['train_chop', 'train_lift', 'train_run']) expect(TRAINING_SPOTS[id].divineExp).toEqual([12, 25]);
  });
  it('Köy antrenmanı eskiyen bir kaynak: L1 ≈ 8–9 gün, L3 adımı (1500) ≈ 25 gün', () => {
    const perDay = 3 * trainingExp([12, 25], 0.5); // ortalama performansla 57/gün
    expect(divineExpToNext(0) / perDay).toBeGreaterThan(7);
    expect(divineExpToNext(0) / perDay).toBeLessThan(10);
    expect(divineExpToNext(2) / perDay).toBeGreaterThan(22);
    expect(divineExpToNext(2) / perDay).toBeLessThan(30);
  });
  it('Level atlama ve awakening listesi', () => {
    const r = addDivineExp(0, 0, 500 + 1000 + 1500 + 10);
    expect(r.level).toBe(3);
    expect(r.exp).toBe(10);
    expect(r.awakenings).toEqual([3]);
  });
});

describe('Hız ve adaptasyon sınırları', () => {
  it('Toplam hareket çarpanı en fazla 1.6x, fazlası taşar; L0 Joseph 0,75 (0.8.0)', () => {
    expect(movementWithDivine(1, divineStat('speed', 0)).move).toBe(0.75);
    const m = movementWithDivine(1.5, 1.5);
    expect(m.move).toBe(1.6);
    expect(m.overflow).toBeCloseTo(0.65);
  });
  it('Olumsuz etki süresi: 1/adaptasyon, en az %25', () => {
    expect(debuffDurationMult(0.5)).toBe(2);
    expect(debuffDurationMult(divineStat('adaptation', 0))).toBeCloseTo(1 / 0.75);
    expect(debuffDurationMult(1)).toBe(1);
    expect(debuffDurationMult(10)).toBe(0.25);
  });
});
