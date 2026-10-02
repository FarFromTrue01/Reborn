// Para: Bronz → Gümüş → Platin → Altın → Elmas, her biri öncekinin 100 katı.
// Para birimleri ayrı tutulur; ödemede tüccar otomatik bozdurup para üstü verir.

export const COINS = ['bronze', 'silver', 'platinum', 'gold', 'diamond'] as const;
export type Coin = (typeof COINS)[number];
export type Wallet = Record<Coin, number>;

export const COIN_VALUE: Record<Coin, number> = {
  bronze: 1,
  silver: 100,
  platinum: 10_000,
  gold: 1_000_000,
  diamond: 100_000_000,
};

export const COIN_NAMES: Record<Coin, string> = {
  bronze: 'Bronz',
  silver: 'Gümüş',
  platinum: 'Platin',
  gold: 'Altın',
  diamond: 'Elmas',
};

export function emptyWallet(): Wallet {
  return { bronze: 0, silver: 0, platinum: 0, gold: 0, diamond: 0 };
}

export function walletTotal(w: Wallet): number {
  let t = 0;
  for (const c of COINS) t += w[c] * COIN_VALUE[c];
  return t;
}

/** Bronz cinsinden bir miktarı en az sayıda paraya böler. */
export function canonicalCoins(amount: number): Wallet {
  if (!Number.isInteger(amount) || amount < 0) throw new Error('Geçersiz miktar: ' + amount);
  const w = emptyWallet();
  let rest = amount;
  for (let i = COINS.length - 1; i >= 0; i--) {
    const c = COINS[i];
    w[c] = Math.floor(rest / COIN_VALUE[c]);
    rest -= w[c] * COIN_VALUE[c];
  }
  return w;
}

export function addWallet(a: Wallet, b: Wallet): Wallet {
  const r = emptyWallet();
  for (const c of COINS) r[c] = a[c] + b[c];
  return r;
}

export function isValidWallet(w: Wallet): boolean {
  return COINS.every((c) => Number.isInteger(w[c]) && w[c] >= 0);
}

export interface PaymentPlan {
  handed: Wallet; // tüccara verilen paralar
  change: Wallet; // para üstü
  after: Wallet; // ödemeden sonraki cüzdan
}

/**
 * Ödeme planı. Yetmiyorsa null döner (hiçbir şey değişmez).
 * Önce büyükten küçüğe, fiyatı aşmadan para verilir; tam tutmazsa
 * kalan miktarı karşılayan en küçük para da verilir ve üstü bozdurulur.
 */
export function planPayment(w: Wallet, price: number): PaymentPlan | null {
  if (!Number.isInteger(price) || price < 0) throw new Error('Geçersiz fiyat: ' + price);
  if (walletTotal(w) < price) return null;
  const handed = emptyWallet();
  let remaining = price;
  for (let i = COINS.length - 1; i >= 0; i--) {
    const c = COINS[i];
    const n = Math.min(w[c], Math.floor(remaining / COIN_VALUE[c]));
    handed[c] = n;
    remaining -= n * COIN_VALUE[c];
  }
  let change = emptyWallet();
  if (remaining > 0) {
    // Kalanı karşılayan en küçük artık parayı bul.
    let picked: Coin | null = null;
    for (const c of COINS) {
      if (w[c] - handed[c] > 0 && COIN_VALUE[c] >= remaining) {
        picked = c;
        break;
      }
    }
    if (!picked) return null; // teorik olarak olmaz (bkz. testler)
    handed[picked] += 1;
    change = canonicalCoins(COIN_VALUE[picked] - remaining);
  }
  const after = emptyWallet();
  for (const c of COINS) after[c] = w[c] - handed[c] + change[c];
  return { handed, change, after };
}

/** Bronz cinsinden fiyatı okunur metne çevirir: "1 Gümüş 25 Bronz". */
export function formatPrice(amount: number, short = false): string {
  if (amount === 0) return short ? '0 B' : '0 Bronz';
  const w = canonicalCoins(amount);
  return formatWallet(w, short);
}

export const COIN_SHORT: Record<Coin, string> = {
  bronze: 'B',
  silver: 'G',
  platinum: 'P',
  gold: 'A',
  diamond: 'E',
};

export function formatWallet(w: Wallet, short = false): string {
  const parts: string[] = [];
  for (let i = COINS.length - 1; i >= 0; i--) {
    const c = COINS[i];
    if (w[c] > 0) parts.push(short ? `${w[c]}${COIN_SHORT[c]}` : `${w[c]} ${COIN_NAMES[c]}`);
  }
  if (parts.length === 0) return short ? '0B' : '0 Bronz';
  return parts.join(' ');
}

/** Tüccarlar eşyayı fiyatının %30–40'ına alır. */
export function sellPrice(price: number, merchantRate = 0.35): number {
  const r = Math.max(0.3, Math.min(0.4, merchantRate));
  return Math.max(price > 0 ? 1 : 0, Math.floor(price * r));
}
