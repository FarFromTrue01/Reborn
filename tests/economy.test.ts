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

import { ITEMS } from '../src/data/items';
import { SHOPS } from '../src/data/shops';
import { FEES, LESSONS, JOBS } from '../src/data/economy';
import { MONSTERS } from '../src/data/monsters';

describe('0.2.0 köy fiyatları', () => {
  it('Yeni temel fiyatlar', () => {
    const want: Record<string, number> = {
      bread: 4, apple: 3, hot_stew: 12, bandage: 15, hp_potion_s: 60, mp_potion_s: 90, antidote: 45, map_village: 60,
    };
    for (const [id, p] of Object.entries(want)) expect(ITEMS[id].price, id).toBe(p);
  });
  it('Silah ve zırhlar yaklaşık ×2.5, kitaplar ×2', () => {
    const old: Record<string, number> = { rusty_shortsword: 60, iron_shortsword: 220, leather_vest: 70, padded_armor: 230, linen_shirt: 30, hobnail_boots: 105 };
    for (const [id, p] of Object.entries(old)) expect(ITEMS[id].price / p, id).toBeCloseTo(2.5, 1);
    const books: Record<string, number> = { book_fire: 450, book_archery: 90, book_firstaid: 60 };
    for (const [id, p] of Object.entries(books)) expect(ITEMS[id].price / p, id).toBeCloseTo(2, 5);
  });
  it('Hizmetler ve skill öğretmenleri (×5)', () => {
    expect(FEES.innBed).toBe(40);
    expect(FEES.healerWrap).toBe(15);
    expect(LESSONS.archery.price).toBe(200);
    expect(LESSONS.first_aid.price).toBe(150);
    expect(LESSONS.sword_mastery.price).toBe(750);
    expect(formatPrice(LESSONS.sword_mastery.price)).toBe('7 Gümüş 50 Bronz');
  });
  it('Bertram (4 gün) + Haldor\'un hasadı = tam 1 gümüş = lonca kaydı', () => {
    expect(JOBS.bertramShifts).toBe(4);
    expect(JOBS.bertramPay).toBe(50);
    expect(JOBS.harvestPay).toBe(50);
    expect(JOBS.bertramPay + JOBS.harvestPay).toBe(FEES.guildRegistration);
    expect(canonicalCoins(FEES.guildRegistration)).toEqual(w({ silver: 1 }));
  });
  it('Drop satış değerleri artmadı (0.1.0 ile aynı)', () => {
    const sell: Record<string, number> = {
      rat_tail: 1, slime_jelly: 2, color_core: 8, rabbit_meat: 3, rabbit_pelt: 5, wolf_pelt: 9, wolf_fang: 5, goblin_ear: 4, goblin_trinket: 3, herb: 2,
      goblin_cleaver: 63, gnawed_ring: 10, slime_gloves: 15, rabbit_charm: 20, wolf_fang_necklace: 55, scroll_spark: 100, chief_tusk: 40,
    };
    for (const [id, v] of Object.entries(sell)) expect(ITEMS[id].sell, id).toBe(v);
    // Her drop sabit bir satış değerine sahip (fiyat artışı satış değerini etkilemesin)
    for (const m of Object.values(MONSTERS)) {
      for (const d of [...m.drops, ...(m.special ? [m.special] : [])]) if (ITEMS[d.id].kind !== 'quest') expect(ITEMS[d.id].sell, d.id).toBeDefined();
    }
  });
  it('Dükkânların drop alım fiyatları eşyanın satış değerini aşmıyor (şifacının eski otu hariç)', () => {
    for (const s of Object.values(SHOPS)) {
      expect(s.rate).toBeGreaterThanOrEqual(0.3);
      expect(s.rate).toBeLessThanOrEqual(0.4);
      for (const [id, v] of Object.entries(s.special ?? {})) expect(v, `${s.id}.${id}`).toBeLessThanOrEqual(Math.max(ITEMS[id].sell ?? 0, s.id === 'healer' ? 9 : 0));
    }
  });
  it('Al-sat ile para kasılamaz: hiçbir dükkânda alıp başka dükkâna satmak kâr getirmez', () => {
    for (const shop of Object.values(SHOPS))
      for (const id of shop.stock) {
        const buy = ITEMS[id].price;
        for (const other of Object.values(SHOPS)) {
          const it = ITEMS[id];
          const special = other.special?.[id];
          const sp = special ?? (it.sell !== undefined ? it.sell : sellPrice(it.price, other.rate));
          expect(sp, `${id}: ${shop.id} → ${other.id}`).toBeLessThan(buy);
        }
      }
  });
});
