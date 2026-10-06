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
  haldor: 'assets/gfx/chars/haldor.png',
  baker: 'assets/gfx/chars/baker.png',
  tailor: 'assets/gfx/chars/tailor.png',
  tanner: 'assets/gfx/chars/tanner.png',
  merchant: 'assets/gfx/chars/merchant.png',
  merc_guard: 'assets/gfx/chars/merc_guard.png',
  steward: 'assets/gfx/chars/steward.png',
  knight: 'assets/gfx/chars/knight.png',
  vagrant: 'assets/gfx/chars/vagrant.png',
  beggar: 'assets/gfx/chars/beggar.png',
  farmer_m3: 'assets/gfx/chars/farmer_m3.png',
  farmer_f3: 'assets/gfx/chars/farmer_f3.png',
  shepherd: 'assets/gfx/chars/shepherd.png',
  milkmaid: 'assets/gfx/chars/milkmaid.png',
  headman: 'assets/gfx/chars/headman.png',
  headwife: 'assets/gfx/chars/headwife.png',
  carpenter: 'assets/gfx/chars/carpenter.png',
  child_girl: 'assets/gfx/chars/child_girl.png',
  child_boy: 'assets/gfx/chars/child_boy.png',
  washer: 'assets/gfx/chars/washer.png',
  adv_kael: 'assets/gfx/chars/adv_kael.png',
  adv_thorne: 'assets/gfx/chars/adv_thorne.png',
  gerda: 'assets/gfx/chars/gerda.png',
  guard3: 'assets/gfx/chars/guard3.png',
  bard: 'assets/gfx/chars/bard.png',
  apprentice: 'assets/gfx/chars/apprentice.png',
  innmaid: 'assets/gfx/chars/innmaid.png',
  woodcutter: 'assets/gfx/chars/woodcutter.png',
  goblin: 'assets/gfx/chars/goblin.png',
  goblin_shaman: 'assets/gfx/chars/goblin_shaman.png',
  goblin_chief: 'assets/gfx/chars/goblin_chief.png',
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
  /** Metal başlı çekiç/topuz (ileride gürz için; şu an hiçbir eşya kullanmıyor). */
  w_club: { file: 'assets/gfx/chars/joseph/w_club.png', z: 140 },
  // Grup 4B — tools/build_weapons.py üretir
  w_stick: { file: 'assets/gfx/chars/joseph/w_stick.png', z: 140 },
  w_stick_cracked: { file: 'assets/gfx/chars/joseph/w_stick_cracked.png', z: 140 },
  w_arming_rusty: { file: 'assets/gfx/chars/joseph/w_arming_rusty.png', z: 140 },
  w_arming_rusty_bg: { file: 'assets/gfx/chars/joseph/w_arming_rusty_bg.png', z: 9 },
  w_arming_steel: { file: 'assets/gfx/chars/joseph/w_arming_steel.png', z: 140 },
  w_arming_steel_bg: { file: 'assets/gfx/chars/joseph/w_arming_steel_bg.png', z: 9 },
};

/**
 * Büyük kare silah sayfaları (LPC jeneratörünün özel animasyonları): kare boyutu 128 ya da 192 px,
 * 4 yön satırı. Karenin merkezi Joseph'in 64 px karesinin merkeziyle çakışır.
 */
export const JOSEPH_BIG: Record<string, { file: string; size: number }> = {
  w_stick_atk: { file: 'assets/gfx/chars/joseph/w_stick_atk.png', size: 192 },
  w_stick_atk_bg: { file: 'assets/gfx/chars/joseph/w_stick_atk_bg.png', size: 192 },
  w_stick_cracked_atk: { file: 'assets/gfx/chars/joseph/w_stick_cracked_atk.png', size: 192 },
  w_stick_cracked_atk_bg: { file: 'assets/gfx/chars/joseph/w_stick_cracked_atk_bg.png', size: 192 },
  w_arming_rusty_atk: { file: 'assets/gfx/chars/joseph/w_arming_rusty_atk.png', size: 128 },
  w_arming_rusty_atk_bg: { file: 'assets/gfx/chars/joseph/w_arming_rusty_atk_bg.png', size: 128 },
  w_arming_steel_atk: { file: 'assets/gfx/chars/joseph/w_arming_steel_atk.png', size: 128 },
  w_arming_steel_atk_bg: { file: 'assets/gfx/chars/joseph/w_arming_steel_atk_bg.png', size: 128 },
  w_cleaver_walk: { file: 'assets/gfx/chars/joseph/w_cleaver_walk.png', size: 128 },
  w_cleaver_walk_bg: { file: 'assets/gfx/chars/joseph/w_cleaver_walk_bg.png', size: 128 },
  w_cleaver_atk: { file: 'assets/gfx/chars/joseph/w_cleaver_atk.png', size: 128 },
  w_cleaver_atk_bg: { file: 'assets/gfx/chars/joseph/w_cleaver_atk_bg.png', size: 128 },
  // 0.8.0 (D2): savaşta elde taşınan yürüme görünümü (mızrak dik, yay yanda) — tools/build_weapons.py
  w_spear_walk: { file: 'assets/gfx/chars/joseph/w_spear_walk.png', size: 128 },
  w_spear_walk_bg: { file: 'assets/gfx/chars/joseph/w_spear_walk_bg.png', size: 128 },
  w_bow_walk: { file: 'assets/gfx/chars/joseph/w_bow_walk.png', size: 128 },
  w_bow_walk_bg: { file: 'assets/gfx/chars/joseph/w_bow_walk_bg.png', size: 128 },
};

/** Taşıma (sırt/bel) katmanlarının z değerleri: önde (sırtı dönükken pelerinin üstünde) ve gövdenin arkasında. */
export const CARRY_Z = { fg: 90, bg: 6 };

/**
 * Silah görünümleri: eşyanın `visual` alanı buradaki bir anahtardır. Yeni bir silah eklemek yalnızca
 * veridir: 64 px el katmanları (`hand`, JOSEPH_LAYERS anahtarları), büyük kare sayfalar (`big`,
 * JOSEPH_BIG anahtarları) ve taşıma katmanları (`<anahtar>_carry`, `_carry_bg`, `_item` dosyaları;
 * konumlar weapons.json'da). Kod değişmez.
 */
export interface WeaponVisual {
  hand: string[];
  big?: { key: string; anim: 'slash' | 'walk'; z: number; reverse?: boolean }[];
  /** Sırt/bel katmanları üretildi mi (tools/build_weapons.py). */
  carry: boolean;
  /** Elde yürüme karesi yok: yürürken/dururken taşıma görünümü (yay, mızrak). */
  walkCarried?: boolean;
}

export const WEAPON_VISUALS: Record<string, WeaponVisual> = {
  w_stick: {
    hand: ['w_stick'], carry: true,
    big: [{ key: 'w_stick_atk', anim: 'slash', z: 140, reverse: true }, { key: 'w_stick_atk_bg', anim: 'slash', z: 9, reverse: true }],
  },
  w_stick_cracked: {
    hand: ['w_stick_cracked'], carry: true,
    big: [{ key: 'w_stick_cracked_atk', anim: 'slash', z: 140, reverse: true }, { key: 'w_stick_cracked_atk_bg', anim: 'slash', z: 9, reverse: true }],
  },
  w_arming_rusty: {
    hand: ['w_arming_rusty', 'w_arming_rusty_bg'], carry: true,
    big: [{ key: 'w_arming_rusty_atk', anim: 'slash', z: 150 }, { key: 'w_arming_rusty_atk_bg', anim: 'slash', z: 8 }],
  },
  w_arming_steel: {
    hand: ['w_arming_steel', 'w_arming_steel_bg'], carry: true,
    big: [{ key: 'w_arming_steel_atk', anim: 'slash', z: 150 }, { key: 'w_arming_steel_atk_bg', anim: 'slash', z: 8 }],
  },
  w_cleaver: {
    hand: [], carry: true,
    big: [
      { key: 'w_cleaver_walk', anim: 'walk', z: 140 }, { key: 'w_cleaver_walk_bg', anim: 'walk', z: 9 },
      { key: 'w_cleaver_atk', anim: 'slash', z: 140 }, { key: 'w_cleaver_atk_bg', anim: 'slash', z: 9 },
    ],
  },
  w_dagger: { hand: ['w_dagger', 'w_dagger_bg'], carry: true },
  w_spear: {
    hand: ['w_spear', 'w_spear_bg'], carry: true,
    big: [{ key: 'w_spear_walk', anim: 'walk', z: 140 }, { key: 'w_spear_walk_bg', anim: 'walk', z: 9 }],
  },
  w_bow: {
    hand: ['w_bow', 'w_bow_bg'], carry: true,
    big: [{ key: 'w_bow_walk', anim: 'walk', z: 140 }, { key: 'w_bow_walk_bg', anim: 'walk', z: 9 }],
  },
  w_club: { hand: ['w_club'], carry: false },
};

/** Taşıma katmanı anahtarları (JOSEPH_LAYERS'a eklenir) ve havada süzülen silah görüntüsü. */
for (const [k, v] of Object.entries(WEAPON_VISUALS)) {
  if (!v.carry) continue;
  JOSEPH_LAYERS[k + '_carry'] = { file: `assets/gfx/chars/joseph/${k}_carry.png`, z: CARRY_Z.fg };
  JOSEPH_LAYERS[k + '_carry_bg'] = { file: `assets/gfx/chars/joseph/${k}_carry_bg.png`, z: CARRY_Z.bg };
}
/** Süzülen silah sayfası: 32 açı (11,25°), 80 px kare, tutma noktası karenin ortasında (RotSprite ile önceden döndürülmüş). */
export const WEAPON_ROT = { steps: 32, cell: 80 };
export const WEAPON_ITEM_IMAGES: Record<string, string> = Object.fromEntries(
  Object.entries(WEAPON_VISUALS).filter(([, v]) => v.carry).map(([k]) => [k, `assets/gfx/chars/joseph/${k}_item.png`]),
);

export const MONSTER_SHEETS: Record<string, string> = {
  m_rat: 'assets/gfx/monsters/rat.png',
  m_rabbit: 'assets/gfx/monsters/rabbit.png',
  m_slime: 'assets/gfx/monsters/slime.png',
  m_wolf: 'assets/gfx/monsters/wolf.png',
};

export const IMAGES: Record<string, string> = {
  terrain: 'assets/gfx/tiles/terrain.png',
  mill_sails: 'assets/gfx/buildings/mill_sails.png',
  east_wall: 'assets/gfx/buildings/east_wall.png',
  east_gate: 'assets/gfx/buildings/east_gate.png',
};

export const BUILDINGS = ['inn', 'guild', 'smithy', 'shop', 'healer', 'house_a', 'house_b', 'house_c', 'house_d', 'house_e', 'mill', 'barn', 'guardhouse',
  'bakery', 'tailor', 'tannery', 'lodge', 'farmhouse', 'farmhouse2', 'manor', 'house_f', 'house_g', 'house_h', 'stable'];

export const ATLASES: Record<string, { image: string; json: string }> = {
  props: { image: 'assets/gfx/props.png', json: 'assets/gfx/props.json' },
  icons: { image: 'assets/gfx/icons.png', json: 'assets/gfx/icons.json' },
  /** Renkli arayüz simgeleri (Twemoji, CC-BY 4.0) ve lonca rütbe rozetleri — tools/build_uiicons.py */
  uiicons: { image: 'assets/gfx/uiicons.png', json: 'assets/gfx/uiicons.json' },
};

export const JSONS: Record<string, string> = {
  terrainMeta: 'assets/gfx/tiles/terrain.json',
  buildingsMeta: 'assets/gfx/buildings/buildings.json',
  monstersMeta: 'assets/gfx/monsters/monsters.json',
  credits: 'assets/credits.json',
  /** Silah taşıma konumları (tools/build_weapons.py). */
  weaponsMeta: 'assets/gfx/chars/joseph/weapons.json',
  artIndex: 'art-index.json',
};

/** Kullanıcının kendi görselleri (varsa). */
export const PORTRAIT_EXPRESSIONS = ['normal', 'gulen', 'kizgin', 'saskin', 'uzgun', 'alayci'] as const;
export type Expression = (typeof PORTRAIT_EXPRESSIONS)[number];
export const CG_SCENES = ['void', 'forest_wake', 'village_view', 'title'] as const;

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
