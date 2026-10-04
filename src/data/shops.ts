// Dükkân stokları, yerleri ve çalışma saatleri. Köy fiyatları; şehirde %20–50 pahalı olur.
// Bir dükkân yalnızca sahibi kendi dükkânında (map) ve çalışma saatindeyken (hours) açılır.

export interface ShopDef {
  id: string;
  name: string;
  keeper: string;
  /** Alışverişin yapılabildiği iç mekân. */
  map: string;
  /** Çalışma saatleri [başlangıç, bitiş). */
  hours: [number, number];
  stock: string[];
  /** Bu dükkânın satın aldığı eşya türleri. */
  buys: string[];
  /** Tüccar alım oranı (%30–40). */
  rate: number;
  /** Özel alım fiyatı (bronz). 0.2.0'da drop alım fiyatları artırılmadı. */
  special?: Record<string, number>;
}

export const SHOPS: Record<string, ShopDef> = {
  smith: {
    id: 'smith', name: 'Gunnar\'ın Demirhanesi', keeper: 'smith', map: 'smithy', hours: [8, 18], rate: 0.35,
    stock: ['wooden_club', 'rusty_shortsword', 'hunting_knife', 'short_bow', 'iron_shortsword', 'iron_spear', 'hunter_bow',
      'leather_vest', 'leather_cap', 'leather_gloves', 'leather_boots', 'padded_armor', 'iron_cap', 'sturdy_pants', 'hobnail_boots'],
    buys: ['weapon', 'armor', 'material'],
    special: { wolf_pelt: 9, wolf_fang: 5, goblin_trinket: 3, chief_tusk: 40 },
  },
  shop: {
    id: 'shop', name: 'Marta\'nın Genel Dükkânı', keeper: 'shopkeeper', map: 'shop', hours: [8, 19], rate: 0.32,
    stock: ['bread', 'apple', 'bandage', 'rope_belt', 'traveler_cape', 'copper_ring', 'map_village', 'book_archery', 'book_firstaid', 'book_fire'],
    buys: ['material', 'food', 'junk', 'armor', 'weapon', 'book'],
  },
  healer: {
    id: 'healer', name: 'Ilse Nine\'nin Şifa Evi', keeper: 'healer', map: 'healer', hours: [9, 17], rate: 0.38,
    stock: ['hp_potion_s', 'mp_potion_s', 'antidote', 'bandage'],
    buys: ['material'],
    special: { herb: 3, rat_tail: 1, slime_jelly: 3, color_core: 9 },
  },
  inn: {
    id: 'inn', name: 'Yorgun Yaban Domuzu Hanı', keeper: 'bertram', map: 'inn', hours: [5, 24], rate: 0.35,
    stock: ['bread', 'hot_stew', 'apple'],
    buys: ['material', 'food'],
    special: { rabbit_meat: 3, apple: 0 },
  },
  bakery: {
    id: 'bakery', name: 'Brunhild\'in Fırını', keeper: 'baker', map: 'bakery', hours: [5, 18], rate: 0.3,
    stock: ['bread', 'honey_bun', 'meat_pie', 'cheese', 'apple'],
    buys: ['food'],
  },
  tailor: {
    id: 'tailor', name: 'Terzi Mirelle', keeper: 'tailor', map: 'tailor', hours: [9, 18], rate: 0.32,
    stock: ['linen_shirt', 'linen_pants', 'cloth_shoes', 'rope_belt', 'traveler_cape', 'wool_vest', 'felt_hat'],
    buys: ['armor'],
  },
  tannery: {
    id: 'tannery', name: 'Gorm\'un Tabakhanesi', keeper: 'tanner', map: 'tannery', hours: [8, 18], rate: 0.33,
    stock: ['leather_vest', 'leather_cap', 'leather_gloves', 'leather_boots', 'sturdy_pants'],
    buys: ['material', 'armor'],
    special: { wolf_pelt: 9, rabbit_pelt: 5 },
  },
  lodge: {
    id: 'lodge', name: 'Garrick\'in Avcı Kulübesi', keeper: 'hunter', map: 'lodge', hours: [12, 18], rate: 0.33,
    stock: ['short_bow', 'hunter_bow', 'hunting_knife', 'dried_meat', 'bandage'],
    buys: ['material'],
    special: { rabbit_meat: 3, rabbit_pelt: 5, wolf_pelt: 9, wolf_fang: 5 },
  },
};

/** Maceracılar Loncası'nın açık olduğu saatler (bina kapısı ve Celeste'nin programı aynı değeri kullanır). */
export const GUILD_HOURS: [number, number] = [5, 24];

/** Dükkân şu an (bu haritada, bu saatte) hizmet veriyor mu? */
export function shopOpen(shop: ShopDef, mapId: string, hour: number): boolean {
  return mapId === shop.map && hour >= shop.hours[0] && hour < shop.hours[1];
}
