// Dekor bilgileri: zemin temas noktası (görselin altından yukarı piksel), rüzgâr salınımı ve
// çarpışma kutusu. Çarpışma kutusu piksel cinsindendir ve görselin TABANINA oturur:
//   box: [yarıGenişlik, yukarı, aşağı]  →  x: anchor±yarıGenişlik, y: anchorY−yukarı … anchorY+aşağı
// (anchor = görselin zemine değdiği alt-orta nokta). Kutusu olmayan dekorların üstünden geçilir.
// tests/collision.test.ts her kutunun görselin tabanı içinde kaldığını doğrular.

export interface PropInfo {
  baseY: number;
  box?: [number, number, number];
  sway?: number; // salınım şiddeti (derece)
  flat?: boolean;
}

/** Ağaç: kutu yalnızca gövde kadar. */
const tree = (baseY: number, trunk = 8, sway = 0.8, up = 10): PropInfo => ({ baseY, box: [trunk, up, 2], sway });

export const PROP_INFO: Record<string, PropInfo> = {
  tree_round: tree(10, 9),
  tree_oak: tree(12, 11),
  tree_oak2: tree(14, 11),
  tree_leafy: tree(14, 9),
  tree_pine_thin: tree(6, 5, 1.2, 8),
  tree_twist: tree(10, 8),
  tree_birch: tree(10, 6),
  tree_conifer: tree(8, 7, 1.0),
  tree_lolli: tree(10, 6),
  tree_dense: tree(12, 12),
  tree_big_a: tree(20, 16, 0.5, 14),
  tree_big_b: tree(20, 16, 0.5, 14),
  tree_big_c: tree(20, 16, 0.5, 14),
  tree_big_d: tree(20, 15, 0.5, 14),
  tree_round_big: tree(16, 15, 0.5, 14),
  tree_huge: tree(40, 24, 0.35, 18),
  tree_pale: tree(10, 7),
  tree_pale2: tree(12, 8),
  tree_dead: tree(12, 8, 0.3),
  tree_dead2: tree(10, 7, 0.3),
  tree_small: tree(6, 5),
  tree_med: tree(8, 7),
  bush_big: { baseY: 8, box: [24, 14, 4], sway: 1.2 },
  bush_s1: { baseY: 4, sway: 2 },
  bush_s2: { baseY: 4, sway: 2 },
  bush_s3: { baseY: 4, sway: 2 },
  shrub: { baseY: 6, box: [6, 6, 2], sway: 1.5 },
  boulder: { baseY: 8, box: [24, 20, 4] },
  boulder2: { baseY: 6, box: [24, 14, 4] },
  rock_grey: { baseY: 8, box: [26, 18, 4] },
  rock_small: { baseY: 4 },
  rocks_tiny: { baseY: 2, flat: true },
  mushrooms: { baseY: 2 },
  cattail: { baseY: 4, sway: 3 },
  amanita: { baseY: 2 },
  stump: { baseY: 6, box: [9, 8, 2] },
  stump_big: { baseY: 10, box: [13, 14, 4] },
  lily1: { baseY: 0, flat: true },
  lily2: { baseY: 0, flat: true },
  fern: { baseY: 4, sway: 2 },
  sprout: { baseY: 2, sway: 2 },
  reeds: { baseY: 4, sway: 2 },
  herb_plant: { baseY: 2, sway: 2 },
  crop_cabbage: { baseY: 4 },
  crop_tomato: { baseY: 4, sway: 1 },
  crop_corn: { baseY: 4, sway: 1.5 },
  crop_carrot: { baseY: 4 },
  wheat: { baseY: 6, sway: 1.5 },
  sign_sword: { baseY: 0 },
  sign_inn: { baseY: 0 },
  sign_mug: { baseY: 0 },
  sign_book: { baseY: 0 },
  sign_tools: { baseY: 0 },
  sign_bag: { baseY: 0 },
  sign_potion: { baseY: 0 },
  signpost: { baseY: 4, box: [4, 6, 2] },
  signpost2: { baseY: 4 },
  scarecrow: { baseY: 4, box: [4, 6, 2], sway: 0.6 },
  clothesline: { baseY: 4 },
  lantern: { baseY: 2, box: [5, 6, 2] },
  torch_wall: { baseY: 0 },
  well: { baseY: 6, box: [28, 24, 4] },
  outhouse: { baseY: 4, box: [21, 28, 4] },
  fountain: { baseY: 4, box: [28, 26, 4] },
  cart: { baseY: 6, box: [34, 18, 4] },
  hay_roll: { baseY: 4, box: [22, 20, 4] },
  hay_pile: { baseY: 4, box: [22, 16, 4] },
  hay_bales: { baseY: 4, box: [46, 16, 4] },
  trough: { baseY: 4, box: [34, 12, 4] },
  firewood: { baseY: 4, box: [20, 18, 4] },
  logpile: { baseY: 4, box: [14, 14, 4] },
  chop_block: { baseY: 4, box: [11, 10, 4] },
  anvil: { baseY: 4, box: [18, 10, 4] },
  woodshed: { baseY: 4, box: [32, 48, 4] },
  stool: { baseY: 2 },
  stall_orange: { baseY: 4, box: [44, 36, 4] },
  stall_blue: { baseY: 4, box: [44, 36, 4] },
  bench: { baseY: 4, box: [28, 10, 4] },
  table_out: { baseY: 4, box: [27, 12, 4] },
  target: { baseY: 4, box: [6, 6, 4] },
  target_straw: { baseY: 4, box: [10, 10, 4] },
  cauldron: { baseY: 3, box: [12, 12, 3] },
  tent_big: { baseY: 6, box: [70, 80, 6] },
  tent_small: { baseY: 6, box: [58, 70, 6] },
  wagon: { baseY: 8, box: [54, 70, 8] },
  weapon_rack_out: { baseY: 2, box: [14, 10, 2] },
  fence_h: { baseY: 2, box: [62, 8, 2] },
  grave: { baseY: 2, box: [12, 10, 2] },
  campfire_0: { baseY: 6, box: [12, 10, 4] },
  // iç mekân
  bed: { baseY: 2, box: [15, 80, 2] },
  table_round: { baseY: 2, box: [16, 18, 2] },
  wardrobe: { baseY: 2, box: [13, 26, 2] },
  barrels: { baseY: 2, box: [29, 26, 2] },
  cabinet: { baseY: 2, box: [15, 30, 2] },
  bookshelf: { baseY: 2, box: [15, 30, 2] },
  dish_shelf: { baseY: 2, box: [15, 30, 2] },
  drawers: { baseY: 2, box: [15, 30, 2] },
  counter: { baseY: 2, box: [16, 26, 2] },
  shelf_books2: { baseY: 2, box: [15, 24, 2] },
  shelf_dishes2: { baseY: 2, box: [15, 24, 2] },
  stove: { baseY: 2, box: [16, 24, 2] },
  sink: { baseY: 2, box: [16, 24, 2] },
  kitchen_counter: { baseY: 2, box: [16, 24, 2] },
  fireplace: { baseY: 2, box: [15, 30, 2] },
  tavern_table: { baseY: 4, box: [28, 22, 4] },
  tavern_table2: { baseY: 4, box: [14, 44, 4] },
  clock: { baseY: 2 },
  weapon_rack: { baseY: 2, box: [14, 20, 2] },
  armor_stand: { baseY: 2, box: [28, 14, 2] },
  helm_shelf: { baseY: 2, box: [28, 14, 2] },
  shield_wall: { baseY: 0 },
  sacks: { baseY: 2 },
  pots: { baseY: 2 },
  chest: { baseY: 2, box: [14, 14, 2] },
  crate_rack: { baseY: 2, box: [30, 28, 2] },
  side_table: { baseY: 2, box: [14, 16, 2] },
  ladder: { baseY: 0, box: [12, 30, 0] },
  door_wood: { baseY: 0 },
  window_small: { baseY: 0 },
  window_white: { baseY: 0 },
};

/**
 * Üstünden geçilebilen küçük nesneler (çöp benzeri, yerdeki eşyalar, ekinler, otlar).
 * Bunların hiç çarpışma kutusu yoktur (testle doğrulanır).
 */
export const WALK_OVER = [
  'pots', 'sacks', 'stool', 'rock_small', 'rocks_tiny', 'mushrooms', 'amanita', 'herb_plant', 'sprout', 'fern', 'reeds', 'cattail',
  'bush_s1', 'bush_s2', 'bush_s3', 'lily1', 'lily2', 'crop_cabbage', 'crop_tomato', 'crop_corn', 'crop_carrot', 'wheat', 'signpost2', 'clothesline',
];

/** Yol kenarına alınması gereken nesneler (yolun üstünde doğarsa en yakın kenar karosuna kayar). */
export const ROADSIDE = ['lantern', 'signpost', 'scarecrow'];

export const TREE_KEYS_FOREST = ['tree_big_a', 'tree_big_b', 'tree_big_c', 'tree_big_d', 'tree_dense', 'tree_oak', 'tree_oak2', 'tree_leafy', 'tree_round', 'tree_conifer', 'tree_pine_thin', 'tree_round_big', 'tree_twist'];
export const TREE_KEYS_LIGHT = ['tree_round', 'tree_lolli', 'tree_birch', 'tree_oak', 'tree_leafy', 'tree_med', 'tree_small', 'tree_pale', 'tree_pale2'];
export const BUSH_KEYS = ['bush_s1', 'bush_s2', 'bush_s3', 'shrub', 'fern', 'bush_big'];

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Bir dekorun dünya pikseli cinsinden çarpışma kutusu (yoksa null). */
export function propBox(key: string, ax: number, ay: number, scale = 1): Rect | null {
  const b = PROP_INFO[key]?.box;
  if (!b) return null;
  const [hw, up, down] = b;
  return { x: ax - hw * scale, y: ay - up * scale, w: hw * 2 * scale, h: (up + down) * scale };
}

/** Bir kutunun anlamlı ölçüde (≥ 4 px) kapladığı karolar: NPC yol bulma ızgarası için. */
export function rectTiles(r: Rect, tile = 32): [number, number][] {
  const out: [number, number][] = [];
  const x0 = Math.floor((r.x + 3) / tile), x1 = Math.floor((r.x + r.w - 3) / tile);
  const y0 = Math.floor((r.y + 3) / tile), y1 = Math.floor((r.y + r.h - 3) / tile);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push([x, y]);
  return out;
}
