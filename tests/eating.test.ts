import { describe, it, expect } from 'vitest';
import { newEatState, eat, canEat, cooldownInfo, EAT_COOLDOWN, EAT_CHAIN_COOLDOWN } from '../src/core/eating';

describe('Hızlı yemek bekleme kuralları', () => {
  it('İlk yemek: zincir 1, 10 sn bekleme', () => {
    const r = eat(newEatState(), 100);
    expect(r.ok).toBe(true);
    expect(r.state.chain).toBe(1);
    expect(r.cooldown).toBe(EAT_COOLDOWN);
    expect(canEat(r.state, 109.9)).toBe(false);
    expect(canEat(r.state, 110)).toBe(true);
  });
  it('Bekleme bitmeden yenemez, durum değişmez', () => {
    const a = eat(newEatState(), 0).state;
    const b = eat(a, 5);
    expect(b.ok).toBe(false);
    expect(b.state).toBe(a);
  });
  it('Art arda 3. yemekten sonra 60 sn bekleme', () => {
    let s = eat(newEatState(), 0).state; // zincir 1
    s = eat(s, 10).state; // zincir 2
    const r = eat(s, 20); // zincir 3
    expect(r.state.chain).toBe(3);
    expect(r.cooldown).toBe(EAT_CHAIN_COOLDOWN);
    expect(canEat(r.state, 79)).toBe(false);
    expect(canEat(r.state, 80)).toBe(true);
  });
  it('60 sn sonra yenen yemek zinciri sıfırlar (yeni zincirin ilki)', () => {
    let s = eat(newEatState(), 0).state;
    s = eat(s, 10).state;
    s = eat(s, 20).state; // 3. yemek, 60 sn bekleme
    const r = eat(s, 80); // son yemekten 60 sn sonra
    expect(r.state.chain).toBe(1);
    expect(r.cooldown).toBe(EAT_COOLDOWN);
  });
  it('59 sn sonra yenirse zincir devam eder', () => {
    let s = eat(newEatState(), 0).state; // 1
    const r = eat(s, 59); // 2
    expect(r.state.chain).toBe(2);
    expect(r.cooldown).toBe(EAT_COOLDOWN);
    s = r.state;
    const r3 = eat(s, 69); // 3
    expect(r3.state.chain).toBe(3);
    expect(r3.cooldown).toBe(EAT_CHAIN_COOLDOWN);
  });
  it('Geri sayım bilgisi', () => {
    const s = eat(newEatState(), 0).state;
    expect(cooldownInfo(s, 4)).toEqual({ left: 6, total: 10 });
    expect(cooldownInfo(newEatState(), 4).left).toBe(0);
  });
});
