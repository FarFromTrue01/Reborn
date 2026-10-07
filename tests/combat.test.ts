// Dövüş kuralları (0.4.0): saldırı iptali, mükemmel kaçış iadesi, köşeye sıkışan tavşan, koşu döngüsü.
import { describe, it, expect } from 'vitest';
import { canInterrupt, INTERRUPT_LOCKOUT_SEC, refundEvade, corneredStep, newCorneredState } from '../src/core/combat';
import { MONSTERS } from '../src/data/monsters';

describe('Vuruşla saldırı iptali', () => {
  const base = { state: 'windup', heavy: false, boss: false, sinceInterrupt: 99 };
  it('Normal vuruş da hazırlıktaki saldırıyı keser', () => {
    expect(canInterrupt(base)).toBe(true);
    expect(canInterrupt({ ...base, heavy: true })).toBe(true);
  });
  it('Yalnızca windup: savurma (strike) ve diğer durumlar kesilmez', () => {
    for (const state of ['strike', 'recover', 'chase', 'hurt', 'idle']) expect(canInterrupt({ ...base, state })).toBe(false);
  });
  it('Boss normal vuruşla kesilmez, ağır vuruşla kesilir', () => {
    expect(canInterrupt({ ...base, boss: true })).toBe(false);
    expect(canInterrupt({ ...base, boss: true, heavy: true })).toBe(true);
  });
  it('İptalden sonra 1,2 sn yeniden kesilemez', () => {
    expect(INTERRUPT_LOCKOUT_SEC).toBe(1.2);
    expect(canInterrupt({ ...base, sinceInterrupt: 0 })).toBe(false);
    expect(canInterrupt({ ...base, sinceInterrupt: 1.19 })).toBe(false);
    expect(canInterrupt({ ...base, sinceInterrupt: 1.2 })).toBe(true);
  });
  it('Yüksek saldırı hızıyla kilitleme yok: 0,1 sn arayla vurulan düşman yine saldırır', () => {
    // Düşman: windup 0,5 sn, iptalde 0,25 sn hurt sonra yeniden windup. Oyuncu her 0,1 sn vuruyor.
    let t = 0, since = 99, state = 'windup', stateT = 0, struck = false;
    const dt = 0.01;
    let nextHit = 0;
    while (t < 5 && !struck) {
      t += dt; since += dt; stateT += dt;
      if (state === 'windup' && stateT >= 0.5) struck = true;
      if (state === 'hurt' && stateT >= 0.25) { state = 'windup'; stateT = 0; }
      if (t >= nextHit) {
        nextHit += 0.1;
        if (canInterrupt({ state, heavy: false, boss: false, sinceInterrupt: since })) { since = 0; state = 'hurt'; stateT = 0; }
      }
    }
    expect(struck).toBe(true);
    expect(t).toBeLessThan(2.5);
  });
});

describe('Mükemmel kaçış bedava', () => {
  it('Peşin bedel bir kez iade edilir', () => {
    const paid = { stamina: 20, light: 0 };
    expect(refundEvade(paid)).toEqual({ stamina: 20, light: 0 });
    expect(refundEvade(paid)).toEqual({ stamina: 0, light: 0 });
  });
  it('Işık Adımı (dash) için ışık bedeli iade edilir', () => {
    const paid = { stamina: 0, light: 25 };
    expect(refundEvade(paid)).toEqual({ stamina: 0, light: 25 });
    expect(paid).toEqual({ stamina: 0, light: 0 });
  });
});

describe('Köşeye sıkışan tavşan', () => {
  const cfg = MONSTERS.rabbit.cornered!;
  it('3 karo içinde ~8 sn kesintisiz kovalanınca döner', () => {
    const s = newCorneredState();
    for (let i = 0; i < 79; i++) expect(corneredStep(s, cfg, 2, 0.1)).toBe(false);
    expect(s.cornered).toBe(false);
    expect(corneredStep(s, cfg, 2.5, 0.15)).toBe(true);
    expect(s.cornered).toBe(true);
  });
  it('Kovalama kesilirse sayaç sıfırlanır', () => {
    const s = newCorneredState();
    for (let i = 0; i < 70; i++) corneredStep(s, cfg, 2, 0.1);
    corneredStep(s, cfg, 3.5, 0.1);
    expect(s.chaseT).toBe(0);
    for (let i = 0; i < 70; i++) corneredStep(s, cfg, 2, 0.1);
    expect(s.cornered).toBe(false);
  });
  it('Oyuncu uzaklaşınca bir süre sonra yine ürkek', () => {
    const s = { cornered: true, chaseT: 0, calmT: 0 };
    for (let i = 0; i < 40; i++) corneredStep(s, cfg, 8, 0.1);
    corneredStep(s, cfg, 2, 0.1); // yakına gelinirse sakinleşme sayacı başa döner
    expect(s.calmT).toBe(0);
    let changed = false;
    for (let i = 0; i < 60 && !changed; i++) changed = corneredStep(s, cfg, 8, 0.1);
    expect(changed).toBe(true);
    expect(s.cornered).toBe(false);
  });
});

