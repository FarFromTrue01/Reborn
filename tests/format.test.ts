import { describe, it, expect } from 'vitest';
import { fmtHp, fmtMult } from '../src/ui/format';
import { roundDamage } from '../src/core/formulas';

describe('Hasar/HP gösterimi (fmtHp)', () => {
  it('10 altı bir ondalık, virgül; 10 ve üstü tam sayı', () => {
    expect(fmtHp(0.5)).toBe('0,5');
    expect(fmtHp(1)).toBe('1,0');
    expect(fmtHp(3.7)).toBe('3,7');
    expect(fmtHp(3.66)).toBe('3,7');
    expect(fmtHp(14)).toBe('14');
    expect(fmtHp(27.4)).toBe('27');
    expect(fmtHp(103)).toBe('103');
    expect(fmtHp(9.96)).toBe('10');
    expect(fmtHp(0)).toBe('0,0');
  });
  it('Hesaplanan hasar ile gösterilen değer aynı (3,5 bir yerde, 4 başka yerde olmaz)', () => {
    for (const x of [0.04, 0.5, 1.25, 3.5, 7.77, 9.94, 9.96, 12.5, 99.5]) {
      const d = roundDamage(x);
      const shown = Number(fmtHp(d).replace(',', '.'));
      expect(shown).toBe(d);
    }
  });
  it('Seri çarpanı gösterimi', () => {
    expect(fmtMult(1.4)).toBe('1,4');
    expect(fmtMult(1.5)).toBe('1,5');
    expect(fmtMult(1.1000000001)).toBe('1,1');
  });
});
