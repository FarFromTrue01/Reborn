// Dövüş kuralları (0.4.0): mükemmel kaçış iadesi, köşeye sıkışan tavşan, koşu döngüsü.
import { describe, it, expect } from 'vitest';
import { refundEvade, corneredStep, newCorneredState } from '../src/core/combat';
import { MONSTERS } from '../src/data/monsters';

describe('Vuruş saldırıyı kesmez (0.11.0, A1)', () => {
  it('canInterrupt ve kilit süresi kalktı; hazırlığı yalnızca sersemleme bozar (bkz. g7combat)', async () => {
    const mod: Record<string, unknown> = await import('../src/core/combat');
    expect(mod.canInterrupt).toBeUndefined();
    expect(mod.INTERRUPT_LOCKOUT_SEC).toBeUndefined();
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

