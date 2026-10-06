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
  /** Tüccar oranı (%30–40; eski tek satış değeri — 0.8.0'dan beri satışta core/selling kullanılır). */
  rate: number;
  /**
   * 0.8.0 (B16): uzmanlık — eşya türleri ya da eşya kimlikleri. Uzmanlığına giren eşyayı satış aralığının üst
   * yarısından alır (core/selling). Uzmanlıktaki eşya, türü alım listesinde olmasa da alınır.
   */
  expertise: string[];
}

export const SHOPS: Record<string, ShopDef> = {
  smith: {
    id: 'smith', name: 'Gunnar\'ın Demirhanesi', keeper: 'smith', map: 'smithy', hours: [8, 18], rate: 0.35,
    stock: ['wooden_club', 'rusty_shortsword', 'hunting_knife', 'short_bow', 'iron_shortsword', 'iron_spear', 'hunter_bow',
      'leather_vest', 'leather_cap', 'leather_gloves', 'leather_boots', 'padded_armor', 'iron_cap', 'sturdy_pants', 'hobnail_boots'],
    buys: ['weapon', 'armor', 'material'],
    // silah ve metal
    expertise: ['weapon', 'iron_cap', 'hobnail_boots', 'padded_armor', 'wolf_fang', 'chief_tusk', 'goblin_trinket'],
  },
  shop: {
    id: 'shop', name: 'Marta\'nın Genel Dükkânı', keeper: 'shopkeeper', map: 'shop', hours: [8, 19], rate: 0.32,
    stock: ['bread', 'apple', 'bandage', 'rope_belt', 'traveler_cape', 'copper_ring', 'map_village'], // 0.8.0: skill kitapları satılmaz (ödül/ganimet)
    buys: ['material', 'food', 'junk', 'armor', 'weapon', 'book'],
    // genel: gündelik mallar, kitap ve ıvır zıvır
    expertise: ['food', 'junk', 'book', 'consumable', 'rope_belt', 'traveler_cape', 'copper_ring', 'gnawed_ring', 'firewood'],
  },
  healer: {
    id: 'healer', name: 'Ilse Nine\'nin Şifa Evi', keeper: 'healer', map: 'healer', hours: [9, 17], rate: 0.38,
    stock: ['hp_potion_s', 'mp_potion_s', 'antidote', 'bandage'],
    buys: ['material'],
    // otlar, iksir malzemeleri
    expertise: ['consumable', 'herb', 'rat_tail', 'slime_jelly', 'color_core'],
  },
  inn: {
    id: 'inn', name: 'Yorgun Yaban Domuzu Hanı', keeper: 'bertram', map: 'inn', hours: [5, 24], rate: 0.35,
    stock: ['bread', 'hot_stew', 'apple'],
    buys: ['material', 'food'],
    // mutfak
    expertise: ['food', 'rabbit_meat'],
  },
  bakery: {
    id: 'bakery', name: 'Brunhild\'in Fırını', keeper: 'baker', map: 'bakery', hours: [5, 18], rate: 0.3,
    stock: ['bread', 'honey_bun', 'meat_pie', 'cheese', 'apple'],
    buys: ['food'],
    expertise: ['food'],
  },
  tailor: {
    id: 'tailor', name: 'Terzi Mirelle', keeper: 'tailor', map: 'tailor', hours: [9, 18], rate: 0.32,
    stock: ['linen_shirt', 'linen_pants', 'cloth_shoes', 'rope_belt', 'traveler_cape', 'wool_vest', 'felt_hat'],
    buys: ['armor'],
    // kumaş giysi
    expertise: ['linen_shirt', 'linen_pants', 'cloth_shoes', 'rope_belt', 'traveler_cape', 'wool_vest', 'felt_hat', 'torn_shorts'],
  },
  tannery: {
    id: 'tannery', name: 'Gorm\'un Tabakhanesi', keeper: 'tanner', map: 'tannery', hours: [8, 18], rate: 0.33,
    stock: ['leather_vest', 'leather_cap', 'leather_gloves', 'leather_boots', 'sturdy_pants'],
    buys: ['material', 'armor'],
    // post ve deri
    expertise: ['wolf_pelt', 'rabbit_pelt', 'leather_vest', 'leather_cap', 'leather_gloves', 'leather_boots', 'sturdy_pants', 'slime_gloves'],
  },
  lodge: {
    id: 'lodge', name: 'Garrick\'in Avcı Kulübesi', keeper: 'hunter', map: 'lodge', hours: [12, 18], rate: 0.33,
    stock: ['short_bow', 'hunter_bow', 'hunting_knife', 'dried_meat', 'bandage'],
    buys: ['material'],
    // av: et, post, diş, av silahları
    expertise: ['rabbit_meat', 'rabbit_pelt', 'wolf_pelt', 'wolf_fang', 'short_bow', 'hunter_bow', 'hunting_knife', 'rabbit_charm', 'wolf_fang_necklace'],
  },
};

/** Maceracılar Loncası'nın açık olduğu saatler (bina kapısı ve Celeste'nin programı aynı değeri kullanır). */
export const GUILD_HOURS: [number, number] = [5, 24];

/** Dükkân şu an (bu haritada, bu saatte) hizmet veriyor mu? */
export function shopOpen(shop: ShopDef, mapId: string, hour: number): boolean {
  return mapId === shop.map && hour >= shop.hours[0] && hour < shop.hours[1];
}
