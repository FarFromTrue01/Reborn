// Satış fiyatı aralığı ve dükkân ilişkisi (0.8.0, Grup 5A B16). Saf: test edilir.
//
// Her satılabilir eşyanın tek bir satış değeri yerine bir aralığı vardır: alt ≈ değer × 0,8, üst ≈ değer × 1,5.
// Dükkânın ödediği fiyat aralıktaki konumdur: konum = 0,5 × uzmanlık + 0,5 × yakınlık.
//   - Uzmanlık: eşya dükkânın uzmanlık listesine (tür ya da eşya kimliği) giriyorsa 1, girmiyorsa 0.
//   - Yakınlık: dükkân sahibiyle ilişki (G.affinity), −5…+10 aralığından 0–1'e.
// Dükkânın hiç almadığı eşya satılamaz.
import { sellPrice } from './money';

export interface SellItem {
  kind: string;
  price: number;
  sell?: number;
}

export interface SellShop {
  buys: string[];
  /** Uzmanlık: eşya türleri (weapon, food…) ya da eşya kimlikleri. */
  expertise: string[];
  rate: number;
}

/** Yakınlığın sınırları (G.affinity): −5 → 0, +10 → 1. */
export const AFFINITY_MIN = -5;
export const AFFINITY_MAX = 10;

/** Eşyanın temel satış değeri (eski tek değer): tanımlıysa `sell`, yoksa fiyatın %35'i. */
export function baseSellValue(it: SellItem): number {
  return it.sell !== undefined ? it.sell : sellPrice(it.price, 0.35);
}

/** Satış aralığı [alt, üst] (bronz). Değeri 0 olan eşya satılamaz: [0, 0]. */
export function sellRange(it: SellItem): [number, number] {
  const v = baseSellValue(it);
  if (v <= 0) return [0, 0];
  const lo = Math.max(1, Math.round(v * 0.8));
  const hi = Math.max(lo, Math.round(v * 1.5));
  return [lo, hi];
}

export function closeness(affinity: number): number {
  return Math.max(0, Math.min(1, (affinity - AFFINITY_MIN) / (AFFINITY_MAX - AFFINITY_MIN)));
}

export function isExpert(shop: SellShop, id: string, it: SellItem): boolean {
  return shop.expertise.includes(id) || shop.expertise.includes(it.kind);
}

/** Dükkân bu eşyayı alır mı? (türü alım listesinde ya da uzmanlığında) */
export function shopBuys(shop: SellShop, id: string, it: SellItem): boolean {
  return shop.buys.includes(it.kind) || shop.expertise.includes(id);
}

/** Dükkânın teklifi (bronz); almıyorsa ya da değeri yoksa 0. */
export function sellOffer(shop: SellShop, id: string, it: SellItem, affinity: number): { price: number; range: [number, number]; expert: boolean; near: number; pos: number } {
  const range = sellRange(it);
  const expert = isExpert(shop, id, it);
  const near = closeness(affinity);
  const pos = 0.5 * (expert ? 1 : 0) + 0.5 * near;
  if (!shopBuys(shop, id, it) || range[1] <= 0) return { price: 0, range, expert, near, pos };
  return { price: Math.round(range[0] + (range[1] - range[0]) * pos), range, expert, near, pos };
}

/** Appraisal drop tablosu için eşya türü etiketi. */
export function lootKindLabel(kind: string): string {
  switch (kind) {
    case 'weapon': case 'armor': return 'Ekipman';
    case 'material': return 'Malzeme';
    case 'food': return 'Yiyecek';
    case 'consumable': return 'İksir';
    case 'book': return 'Kitap';
    default: return 'Diğer';
  }
}
