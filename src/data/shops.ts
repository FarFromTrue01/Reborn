// Dükkân stokları ve çalışma saatleri. Köy fiyatları; şehirde %20–50 pahalı olur.

export interface ShopDef {
  id: string;
  name: string;
  keeper: string;
  stock: string[];
  /** Bu dükkânın satın aldığı eşya türleri. */
  buys: string[];
  /** Tüccar alım oranı (%30–40). */
  rate: number;
  /** Özel alım fiyatı (bronz). */
  special?: Record<string, number>;
}

export const SHOPS: Record<string, ShopDef> = {
  smith: {
    id: 'smith', name: 'Gunnar\'ın Demirhanesi', keeper: 'smith', rate: 0.35,
    stock: ['wooden_club', 'rusty_shortsword', 'hunting_knife', 'short_bow', 'iron_shortsword', 'iron_spear', 'hunter_bow',
      'leather_vest', 'leather_cap', 'leather_gloves', 'leather_boots', 'padded_armor', 'iron_cap', 'sturdy_pants', 'hobnail_boots'],
    buys: ['weapon', 'armor', 'material'],
    special: { wolf_pelt: 9, wolf_fang: 5, goblin_trinket: 3, chief_tusk: 40 },
  },
  shop: {
    id: 'shop', name: 'Marta\'nın Genel Dükkânı', keeper: 'shopkeeper', rate: 0.32,
    stock: ['bread', 'apple', 'bandage', 'rope_belt', 'traveler_cape', 'copper_ring', 'map_village', 'book_archery', 'book_firstaid', 'book_fire'],
    buys: ['material', 'food', 'junk', 'armor', 'weapon', 'book'],
  },
  healer: {
    id: 'healer', name: 'Ilse Nine\'nin Şifa Evi', keeper: 'healer', rate: 0.38,
    stock: ['hp_potion_s', 'mp_potion_s', 'antidote', 'bandage'],
    buys: ['material'],
    special: { herb: 3, rat_tail: 1, slime_jelly: 3, color_core: 9 },
  },
  inn: {
    id: 'inn', name: 'Yorgun Yaban Domuzu Hanı', keeper: 'bertram', rate: 0.35,
    stock: ['bread', 'hot_stew', 'apple'],
    buys: ['material', 'food'],
    special: { rabbit_meat: 3, apple: 0 },
  },
};
