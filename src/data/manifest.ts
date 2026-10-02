// Görsel manifesti: oyundaki tüm görseller mantıksal anahtarlarla buradan yüklenir.
// Başka bir piksel paketine geçmek için yalnızca bu dosyadaki yolları değiştirmek yeterli.

export const LPC_FRAME = 64;

/** LPC karakter sayfaları (832x1344, klasik 21 satır). */
export const CHAR_SHEETS: Record<string, string> = {
  bertram: 'assets/gfx/chars/bertram.png',
  vera: 'assets/gfx/chars/vera.png',
  lina: 'assets/gfx/chars/lina.png',
  celeste: 'assets/gfx/chars/celeste.png',
  smith: 'assets/gfx/chars/smith.png',
  shopkeeper: 'assets/gfx/chars/shopkeeper.png',
  healer: 'assets/gfx/chars/healer.png',
  guard: 'assets/gfx/chars/guard.png',
  guard2: 'assets/gfx/chars/guard2.png',
  gate_captain: 'assets/gfx/chars/gate_captain.png',
  hunter: 'assets/gfx/chars/hunter.png',
  farmer_m1: 'assets/gfx/chars/farmer_m1.png',
  farmer_m2: 'assets/gfx/chars/farmer_m2.png',
  farmer_f1: 'assets/gfx/chars/farmer_f1.png',
  farmer_f2: 'assets/gfx/chars/farmer_f2.png',
  elder_m: 'assets/gfx/chars/elder_m.png',
  elder_f: 'assets/gfx/chars/elder_f.png',
  mother: 'assets/gfx/chars/mother.png',
  child: 'assets/gfx/chars/child.png',
  drunk: 'assets/gfx/chars/drunk.png',
  miller: 'assets/gfx/chars/miller.png',
  adventurer_m: 'assets/gfx/chars/adventurer_m.png',
  adventurer_f: 'assets/gfx/chars/adventurer_f.png',
  goblin: 'assets/gfx/chars/goblin.png',
  goblin_shaman: 'assets/gfx/chars/goblin_shaman.png',
  goblin_chief: 'assets/gfx/chars/goblin_chief.png',
  hero_knight: 'assets/gfx/chars/hero_knight.png',
  hero_mage: 'assets/gfx/chars/hero_mage.png',
  hero_archer: 'assets/gfx/chars/hero_archer.png',
};

/** Joseph'in ekipmana göre değişen katmanları. */
export const JOSEPH_LAYERS: Record<string, { file: string; z: number }> = {
  body: { file: 'assets/gfx/chars/joseph/body.png', z: 10 },
  head: { file: 'assets/gfx/chars/joseph/head.png', z: 100 },
  a_shorts: { file: 'assets/gfx/chars/joseph/a_shorts.png', z: 20 },
  a_shirt: { file: 'assets/gfx/chars/joseph/a_shirt.png', z: 35 },
  a_pants: { file: 'assets/gfx/chars/joseph/a_pants.png', z: 20 },
  a_shoes: { file: 'assets/gfx/chars/joseph/a_shoes.png', z: 15 },
  a_vest: { file: 'assets/gfx/chars/joseph/a_vest.png', z: 45 },
  a_cap: { file: 'assets/gfx/chars/joseph/a_cap.png', z: 130 },
  a_gloves: { file: 'assets/gfx/chars/joseph/a_gloves.png', z: 70 },
  a_belt: { file: 'assets/gfx/chars/joseph/a_belt.png', z: 70 },
  a_boots: { file: 'assets/gfx/chars/joseph/a_boots.png', z: 25 },
  a_cape: { file: 'assets/gfx/chars/joseph/a_cape.png', z: 85 },
  a_cape_bg: { file: 'assets/gfx/chars/joseph/a_cape_bg.png', z: 5 },
  a_padded: { file: 'assets/gfx/chars/joseph/a_padded.png', z: 60 },
  a_helm: { file: 'assets/gfx/chars/joseph/a_helm.png', z: 130 },
  a_pants_leather: { file: 'assets/gfx/chars/joseph/a_pants_leather.png', z: 20 },
  w_dagger: { file: 'assets/gfx/chars/joseph/w_dagger.png', z: 140 },
  w_dagger_bg: { file: 'assets/gfx/chars/joseph/w_dagger_bg.png', z: 9 },
  w_spear: { file: 'assets/gfx/chars/joseph/w_spear.png', z: 140 },
  w_spear_bg: { file: 'assets/gfx/chars/joseph/w_spear_bg.png', z: 9 },
  w_bow: { file: 'assets/gfx/chars/joseph/w_bow.png', z: 140 },
  w_bow_bg: { file: 'assets/gfx/chars/joseph/w_bow_bg.png', z: -1 },
  w_club: { file: 'assets/gfx/chars/joseph/w_club.png', z: 140 },
};

export const MONSTER_SHEETS: Record<string, string> = {
  m_rat: 'assets/gfx/monsters/rat.png',
  m_rabbit: 'assets/gfx/monsters/rabbit.png',
  m_slime: 'assets/gfx/monsters/slime.png',
  m_wolf: 'assets/gfx/monsters/wolf.png',
};

export const IMAGES: Record<string, string> = {
  terrain: 'assets/gfx/tiles/terrain.png',
  mill_sails: 'assets/gfx/buildings/mill_sails.png',
  city_wall: 'assets/gfx/buildings/city_wall.png',
};

export const BUILDINGS = ['inn', 'guild', 'smithy', 'shop', 'healer', 'house_a', 'house_b', 'house_c', 'house_d', 'house_e', 'mill', 'barn', 'guardhouse'];

export const ATLASES: Record<string, { image: string; json: string }> = {
  props: { image: 'assets/gfx/props.png', json: 'assets/gfx/props.json' },
  icons: { image: 'assets/gfx/icons.png', json: 'assets/gfx/icons.json' },
};

export const JSONS: Record<string, string> = {
  terrainMeta: 'assets/gfx/tiles/terrain.json',
  buildingsMeta: 'assets/gfx/buildings/buildings.json',
  monstersMeta: 'assets/gfx/monsters/monsters.json',
  credits: 'assets/credits.json',
  artIndex: 'art-index.json',
};

/** Kullanıcının kendi görselleri (varsa). */
export const PORTRAIT_EXPRESSIONS = ['normal', 'gulen', 'kizgin', 'saskin', 'uzgun', 'alayci'] as const;
export type Expression = (typeof PORTRAIT_EXPRESSIONS)[number];
export const CG_SCENES = ['void', 'battlefield', 'forest_wake', 'village_view', 'title'] as const;

// LPC satır düzeni (klasik)
export const LPC_ROWS = {
  spellcast: { row: 0, frames: 7 },
  thrust: { row: 4, frames: 8 },
  walk: { row: 8, frames: 9 },
  slash: { row: 12, frames: 6 },
  shoot: { row: 16, frames: 13 },
  hurt: { row: 20, frames: 6 },
};
export const DIR_INDEX: Record<string, number> = { up: 0, left: 1, down: 2, right: 3 };
