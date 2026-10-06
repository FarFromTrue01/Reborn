// Harita simgeleri: büyük harita (Menü → Harita) ve mini harita (HUD) aynı tabloyu kullanır.

/** Bina kimliği → uiicons anahtarı. */
export const BUILDING_ICON: Record<string, string> = {
  inn: 'm_inn', guild: 'm_guild', smithy: 'm_smithy', shop: 'm_shop', healer: 'm_healer', mill: 'm_mill', guardhouse: 'm_guard',
  bakery: 'm_bakery', tailor: 'm_tailor', tannery: 'm_tannery', lodge: 'm_lodge', farmhouse: 'm_farm', manor: 'm_manor', house_f: 'm_house',
};

/** Mini haritada simgesi görünen binalar (0.9.0): dükkânlar, han ve lonca. */
export const MINIMAP_BUILDINGS = ['inn', 'guild', 'smithy', 'shop', 'healer', 'bakery', 'tailor', 'tannery', 'lodge'];
