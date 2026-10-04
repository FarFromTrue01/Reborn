// Her alım, satım, ücret, ödül, toplama, tüketme ve üretme bir işlemdir:
// 1) doğrula  2) verileni tam düş  3) alınanı tam ekle  4) kaydet.
// Yetmiyorsa işlem başarısız olur ve hiçbir şey değişmez.

import { addWallet, planPayment, isValidWallet, emptyWallet, walletTotal, normalizeWallet, type Wallet } from './money';
import { ITEMS } from '../data/items';
import type { EquipSlot } from './types';
import { EQUIP_SLOTS } from './types';

export interface Ledger {
  inventory: Record<string, number>;
  wallet: Wallet;
  equipment: Partial<Record<EquipSlot, string>>;
}

export interface ItemQty {
  id: string;
  qty: number;
}

export interface TxSpec {
  label: string;
  /** Bronz cinsinden ödenecek tutar (otomatik bozdurma). */
  pay?: number;
  /** Verilecek eşyalar. */
  take?: ItemQty[];
  /** Alınacak eşyalar. */
  give?: ItemQty[];
  /** Alınacak para (belirli paralar). */
  receive?: Wallet;
}

export interface TxResult {
  ok: boolean;
  reason?: string;
  change?: Wallet;
  handed?: Wallet;
}

type CommitHook = (label: string) => void;
let commitHook: CommitHook | null = null;

/** Her başarılı işlemden sonra çağrılır (kayıt). */
export function setCommitHook(h: CommitHook | null) {
  commitHook = h;
}

export function countItem(l: Ledger, id: string): number {
  return l.inventory[id] ?? 0;
}

function cloneLedger(l: Ledger): Ledger {
  return { inventory: { ...l.inventory }, wallet: { ...l.wallet }, equipment: { ...l.equipment } };
}

function commit(target: Ledger, next: Ledger) {
  target.inventory = next.inventory;
  target.wallet = next.wallet;
  target.equipment = next.equipment;
}

/** Envanterin kendi içinde tutarlı olup olmadığını kontrol eder (testler ve hata ayıklama). */
export function isConsistent(l: Ledger): boolean {
  if (!isValidWallet(l.wallet)) return false;
  for (const [id, q] of Object.entries(l.inventory)) {
    if (!ITEMS[id]) return false;
    if (!Number.isInteger(q) || q <= 0) return false;
  }
  for (const s of EQUIP_SLOTS) {
    const id = l.equipment[s];
    if (id && !ITEMS[id]) return false;
  }
  return true;
}

export function transact(l: Ledger, spec: TxSpec): TxResult {
  // 1) Doğrula
  for (const t of spec.take ?? []) {
    if (!ITEMS[t.id]) return { ok: false, reason: 'Bilinmeyen eşya.' };
    if (!Number.isInteger(t.qty) || t.qty <= 0) return { ok: false, reason: 'Geçersiz miktar.' };
  }
  for (const g of spec.give ?? []) {
    if (!ITEMS[g.id]) return { ok: false, reason: 'Bilinmeyen eşya.' };
    if (!Number.isInteger(g.qty) || g.qty <= 0) return { ok: false, reason: 'Geçersiz miktar.' };
  }
  const takeTotals: Record<string, number> = {};
  for (const t of spec.take ?? []) takeTotals[t.id] = (takeTotals[t.id] ?? 0) + t.qty;
  for (const [id, q] of Object.entries(takeTotals)) {
    if (countItem(l, id) < q) return { ok: false, reason: `Yeterli ${ITEMS[id].name} yok.` };
  }
  if (spec.receive && !isValidWallet(spec.receive)) return { ok: false, reason: 'Geçersiz para.' };
  const next = cloneLedger(l);
  let change: Wallet | undefined;
  let handed: Wallet | undefined;
  if (spec.pay && spec.pay > 0) {
    const plan = planPayment(next.wallet, spec.pay);
    if (!plan) return { ok: false, reason: 'Paran yetmiyor.' };
    next.wallet = plan.after;
    change = plan.change;
    handed = plan.handed;
  }
  // 2) Verileni düş
  for (const [id, q] of Object.entries(takeTotals)) {
    const left = next.inventory[id] - q;
    if (left > 0) next.inventory[id] = left;
    else delete next.inventory[id];
  }
  // 3) Alınanı ekle
  for (const g of spec.give ?? []) next.inventory[g.id] = (next.inventory[g.id] ?? 0) + g.qty;
  if (spec.receive) next.wallet = addWallet(next.wallet, spec.receive);
  // Para birimleri her işlemden sonra bozdurulur: 100 bronz cüzdanda 1 gümüş olarak durur.
  if (spec.receive || spec.pay) next.wallet = normalizeWallet(next.wallet);
  if (!isConsistent(next)) return { ok: false, reason: 'İşlem tutarsız.' };
  commit(l, next);
  // 4) Kaydet
  commitHook?.(spec.label);
  return { ok: true, change, handed };
}

/** Kuşan: eşya envanterden çıkar, slottaki eski eşya envantere döner. */
export function equip(l: Ledger, id: string, slot: EquipSlot): TxResult {
  const it = ITEMS[id];
  if (!it || !it.slot) return { ok: false, reason: 'Bu kuşanılamaz.' };
  const okSlot = it.slot === 'ring' ? slot === 'ring1' || slot === 'ring2' : it.slot === slot;
  if (!okSlot) return { ok: false, reason: 'Yanlış slot.' };
  if (countItem(l, id) < 1) return { ok: false, reason: 'Envanterde yok.' };
  const next = cloneLedger(l);
  const old = next.equipment[slot];
  const left = next.inventory[id] - 1;
  if (left > 0) next.inventory[id] = left;
  else delete next.inventory[id];
  next.equipment[slot] = id;
  if (old) next.inventory[old] = (next.inventory[old] ?? 0) + 1;
  commit(l, next);
  commitHook?.('Kuşan: ' + it.name);
  return { ok: true };
}

export function unequip(l: Ledger, slot: EquipSlot): TxResult {
  const id = l.equipment[slot];
  if (!id) return { ok: false, reason: 'Slot boş.' };
  const next = cloneLedger(l);
  delete next.equipment[slot];
  next.inventory[id] = (next.inventory[id] ?? 0) + 1;
  commit(l, next);
  commitHook?.('Çıkar: ' + ITEMS[id].name);
  return { ok: true };
}

/** Ölüm cezası: paranın %10'u kaybolur. Kaybolan tutar (bronz) döner. */
export function loseMoneyPercent(l: Ledger, pct: number): number {
  const amount = Math.floor(walletTotal(l.wallet) * pct);
  if (amount <= 0) return 0;
  const r = transact(l, { label: 'Ölüm cezası', pay: amount });
  return r.ok ? amount : 0;
}

/** Bir eşyanın toplam sayısı (envanter + kuşanılmış). */
export function totalOwned(l: Ledger, id: string): number {
  let n = countItem(l, id);
  for (const s of EQUIP_SLOTS) if (l.equipment[s] === id) n++;
  return n;
}

export { emptyWallet };
