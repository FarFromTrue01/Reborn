import { describe, it, expect } from 'vitest';
import {
  canonicalCoins, emptyWallet, planPayment, walletTotal, formatPrice, sellPrice, type Wallet, COINS,
} from '../src/core/money';
import { transact, equip, unequip, isConsistent, loseMoneyPercent, totalOwned, type Ledger } from '../src/core/transactions';

function w(p: Partial<Wallet>): Wallet {
  return { ...emptyWallet(), ...p };
}

function ledger(p: Partial<Ledger> = {}): Ledger {
  return { inventory: {}, wallet: emptyWallet(), equipment: {}, ...p };
}

describe('Para', () => {
  it('Her birim öncekinin 100 katı', () => {
    expect(walletTotal(w({ diamond: 1 }))).toBe(100 * 100 * 100 * 100);
    expect(canonicalCoins(10_203)).toEqual(w({ platinum: 1, silver: 2, bronze: 3 }));
  });
  it('Biçimlendirme', () => {
    expect(formatPrice(125)).toBe('1 Gümüş 25 Bronz');
    expect(formatPrice(0)).toBe('0 Bronz');
  });
  it('Tam ödeme: bozdurma gerekmez', () => {
    const p = planPayment(w({ bronze: 60 }), 50)!;
    expect(p.after).toEqual(w({ bronze: 10 }));
    expect(walletTotal(p.change)).toBe(0);
  });
  it('Gümüşle bronz ödeme: para üstü verilir', () => {
    const p = planPayment(w({ silver: 1 }), 30)!;
    expect(p.after).toEqual(w({ bronze: 70 }));
    expect(p.change).toEqual(w({ bronze: 70 }));
  });
  it('Karışık ödeme', () => {
    const p = planPayment(w({ silver: 2, bronze: 40 }), 150)!;
    expect(walletTotal(p.after)).toBe(240 - 150);
  });
  it('Yetmiyorsa null', () => {
    expect(planPayment(w({ bronze: 99 }), 100)).toBeNull();
  });
  it('Rastgele 2000 ödemede kuruşu kuruşuna doğru ve negatif yok', () => {
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 2000; i++) {
      const wal = w({
        bronze: Math.floor(r() * 300),
        silver: Math.floor(r() * 5),
        platinum: Math.floor(r() * 2),
        gold: r() < 0.1 ? 1 : 0,
      });
      const total = walletTotal(wal);
      const price = Math.floor(r() * (total + 50));
      const p = planPayment(wal, price);
      if (price > total) {
        expect(p).toBeNull();
      } else {
        expect(p).not.toBeNull();
        expect(walletTotal(p!.after)).toBe(total - price);
        for (const c of COINS) expect(p!.after[c]).toBeGreaterThanOrEqual(0);
        expect(walletTotal(p!.handed) - walletTotal(p!.change)).toBe(price);
      }
    }
  });
  it('Tüccar %30–40 öder', () => {
    expect(sellPrice(100)).toBe(35);
    expect(sellPrice(100, 0.9)).toBe(40);
    expect(sellPrice(100, 0.1)).toBe(30);
  });
});

describe('İşlemler', () => {
  it('Satın alma: para düşer, eşya eklenir', () => {
    const l = ledger({ wallet: w({ silver: 1 }) });
    const r = transact(l, { label: 'Al', pay: 60, give: [{ id: 'rusty_shortsword', qty: 1 }] });
    expect(r.ok).toBe(true);
    expect(walletTotal(l.wallet)).toBe(40);
    expect(l.inventory.rusty_shortsword).toBe(1);
  });
  it('Para yetmezse hiçbir şey değişmez', () => {
    const l = ledger({ wallet: w({ bronze: 10 }), inventory: { rat_tail: 2 } });
    const before = JSON.stringify(l);
    const r = transact(l, { label: 'Al', pay: 60, give: [{ id: 'rusty_shortsword', qty: 1 }], take: [{ id: 'rat_tail', qty: 1 }] });
    expect(r.ok).toBe(false);
    expect(JSON.stringify(l)).toBe(before);
  });
  it('Satış: eşya düşer, para eklenir', () => {
    const l = ledger({ inventory: { rat_tail: 3 } });
    const r = transact(l, { label: 'Sat', take: [{ id: 'rat_tail', qty: 3 }], receive: w({ bronze: 3 }) });
    expect(r.ok).toBe(true);
    expect(l.inventory.rat_tail).toBeUndefined();
    expect(l.wallet.bronze).toBe(3);
  });
  it('Elde olmayanı satamazsın', () => {
    const l = ledger({ inventory: { rat_tail: 1 } });
    expect(transact(l, { label: 'Sat', take: [{ id: 'rat_tail', qty: 2 }], receive: w({ bronze: 2 }) }).ok).toBe(false);
    expect(l.inventory.rat_tail).toBe(1);
    expect(l.wallet.bronze).toBe(0);
  });
  it('Kuşan / çıkar: asla kopyalanmaz', () => {
    const l = ledger({ inventory: { linen_pants: 1 }, equipment: { pants: 'torn_shorts' } });
    expect(equip(l, 'linen_pants', 'pants').ok).toBe(true);
    expect(l.equipment.pants).toBe('linen_pants');
    expect(l.inventory.linen_pants).toBeUndefined();
    expect(l.inventory.torn_shorts).toBe(1);
    expect(totalOwned(l, 'linen_pants')).toBe(1);
    expect(totalOwned(l, 'torn_shorts')).toBe(1);
    expect(unequip(l, 'pants').ok).toBe(true);
    expect(l.inventory.linen_pants).toBe(1);
    expect(l.equipment.pants).toBeUndefined();
    expect(equip(l, 'linen_pants', 'chest').ok).toBe(false);
    expect(isConsistent(l)).toBe(true);
  });
  it('Yüzük iki slota da takılır', () => {
    const l = ledger({ inventory: { copper_ring: 2 } });
    expect(equip(l, 'copper_ring', 'ring1').ok).toBe(true);
    expect(equip(l, 'copper_ring', 'ring2').ok).toBe(true);
    expect(l.inventory.copper_ring).toBeUndefined();
    expect(equip(l, 'copper_ring', 'ring1').ok).toBe(false);
  });
  it('Ölüm cezası paranın %10\'u', () => {
    const l = ledger({ wallet: w({ silver: 1, bronze: 50 }) });
    expect(loseMoneyPercent(l, 0.1)).toBe(15);
    expect(walletTotal(l.wallet)).toBe(135);
  });
});
