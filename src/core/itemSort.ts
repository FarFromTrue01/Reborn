// Envanter ve dükkân sıralaması (0.9.0, madde 13–14). Saf; tests/g5b.test.ts.
import type { ItemDef } from './types';
import { sellRange } from './selling';

export type SortKey = 'price' | 'rank' | 'kind' | 'name';
export const SORT_KEYS: SortKey[] = ['price', 'rank', 'kind', 'name'];
export const SORT_NAMES: Record<SortKey, string> = { price: 'Fiyat', rank: 'Rütbe', kind: 'Tür', name: 'Ad' };

export interface SortPref {
  /** null: sırasız (eklenme sırası). */
  key: SortKey | null;
  desc: boolean;
}

/** Oturum boyunca hatırlanan seçimler (kayda yazılmaz; sahneler yeniden kurulsa da modül değişkeni kalır). */
export const SORT_PREFS: Record<'inv' | 'buy' | 'sell', SortPref> = {
  inv: { key: null, desc: true },
  buy: { key: null, desc: false },
  sell: { key: null, desc: true },
};

const RANKS = 'GFEDCBASX';
const KIND_ORDER = ['weapon', 'armor', 'consumable', 'food', 'material', 'book', 'quest', 'junk'];

/** Envanterdeki "fiyat": 5A satış aralığının ortası. */
export function avgSellPrice(it: ItemDef): number {
  const [lo, hi] = sellRange(it);
  return (lo + hi) / 2;
}

/**
 * Eşyaları sırala. price: dükkânda alış/satış fiyatı, envanterde ortalama satış fiyatı (priceOf). Eşitlikte ada göre
 * (her zaman artan) ve rütbesizler rütbe sırasında sonda.
 */
export function sortItems(ids: string[], items: Record<string, ItemDef>, pref: SortPref, priceOf: (id: string) => number = (id) => avgSellPrice(items[id])): string[] {
  if (!pref.key) return [...ids];
  const name = (id: string) => items[id]?.name ?? id;
  const byName = (a: string, b: string) => name(a).localeCompare(name(b), 'tr');
  const val = (id: string): number => {
    const it = items[id];
    switch (pref.key) {
      case 'price': return priceOf(id);
      case 'rank': return it?.rank ? RANKS.indexOf(it.rank) : -1;
      case 'kind': {
        const k = KIND_ORDER.indexOf(it?.kind ?? '');
        return k < 0 ? KIND_ORDER.length : k;
      }
      default: return 0;
    }
  };
  const dir = pref.desc ? -1 : 1;
  return [...ids].sort((a, b) => {
    if (pref.key === 'name') return dir * byName(a, b);
    if (pref.key === 'rank') {
      const ra = val(a), rb = val(b);
      if ((ra < 0) !== (rb < 0)) return ra < 0 ? 1 : -1; // rütbesizler hep sonda
      if (ra !== rb) return dir * (ra - rb);
      return byName(a, b);
    }
    const d = val(a) - val(b);
    return d ? dir * d : byName(a, b);
  });
}

/** Düğmenin bir sonraki anahtarı: sırasız → Fiyat → Rütbe → Tür → Ad → sırasız. */
export function nextSortKey(k: SortKey | null): SortKey | null {
  if (k === null) return SORT_KEYS[0];
  const i = SORT_KEYS.indexOf(k);
  return i >= SORT_KEYS.length - 1 ? null : SORT_KEYS[i + 1];
}
