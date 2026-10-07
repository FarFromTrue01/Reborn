// İç mekân haritaları. Her oda: zemin karosu, üst duvar (2 karo), çevre engelleri, mobilyalar.
import { TERRAIN, TILE, type MapData, type PropPlacement, type Warp, type Trigger, type DoorDef, type ColliderRect } from './types';
import { propBox, rectTiles } from '../data/props';

interface RoomSpec {
  id: string;
  name: string;
  /** B7 (0.11.0): sağ üst bölge kutusunda görünen kısa ad (tam ad haritada ve girişteki yazıda). */
  short?: string;
  w: number;
  h: number;
  floor: string; // terrain.json floors anahtarı
  wall: string; // duvar dokusu
  music: string;
  dark: number;
  exit: { x: number; to: string; tx: number; ty: number; facing?: string; w?: number };
  build: (b: Builder) => void;
}

class Builder {
  props: PropPlacement[] = [];
  warps: Warp[] = [];
  doors: DoorDef[] = [];
  triggers: Trigger[] = [];
  points: Record<string, { x: number; y: number }> = {};
  walls: { x: number; y: number; h: number; style: string }[] = [];
  solid: Uint8Array;
  hard: Uint8Array;
  colliders: ColliderRect[] = [];
  floorMask: Uint8Array;
  constructor(public w: number, public h: number) {
    this.solid = new Uint8Array(w * h);
    this.hard = new Uint8Array(w * h);
    this.floorMask = new Uint8Array(w * h).fill(1);
  }
  /** Sert engel (duvar, ocak, merdiven boşluğu). */
  block(x0: number, y0: number, x1: number, y1: number) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < this.w && y < this.h) { this.solid[y * this.w + x] = 1; this.hard[y * this.w + x] = 1; }
  }
  open(x0: number, y0: number, x1: number, y1: number) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < this.w && y < this.h) { this.solid[y * this.w + x] = 0; this.hard[y * this.w + x] = 0; }
  }
  /** Mobilya: çarpışma kutusu görünen tabanına oturur; kapladığı karolar NPC yol bulmasında dolu. */
  prop(key: string, tx: number, ty: number, extra: Partial<PropPlacement> = {}) {
    const p: PropPlacement = { key, x: tx * TILE + TILE / 2, y: ty * TILE + TILE - 2, ...extra };
    this.props.push(p);
    const r = extra.flat ? null : propBox(key, p.x, p.y, p.scale ?? 1);
    if (r) {
      this.colliders.push({ ...r, key });
      for (const [x, y] of rectTiles(r)) if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.solid[y * this.w + x] = 1;
    }
    return p;
  }
  /** Duvara asılı (engelsiz) dekor. */
  wallProp(key: string, tx: number, ty: number, extra: Partial<PropPlacement> = {}) {
    const p: PropPlacement = { key, x: tx * TILE + TILE / 2, y: ty * TILE + TILE - 2, depthOffset: -2000, ...extra };
    this.props.push(p);
    return p;
  }
  /**
   * Dikey iç duvar (bölme). gapFrom..gapTo arası kapı açıklığıdır: duvar orada çizilmez,
   * yerine kasa, eşik ve geçiş işareti çizilir (bkz. mapRender 'side').
   */
  vwall(x: number, y0: number, y1: number, gapFrom = -1, gapTo = -1, label?: string) {
    for (let y = y0; y <= y1; y++) {
      if (y >= gapFrom && y <= gapTo) continue;
      this.block(x, y, x, y);
    }
    if (gapFrom >= 0) {
      if (gapFrom > y0) this.walls.push({ x, y: y0, h: gapFrom - y0, style: 'beam' });
      if (gapTo < y1) this.walls.push({ x, y: gapTo + 1, h: y1 - gapTo, style: 'beam' });
      this.doors.push({ x, y: gapFrom, h: gapTo - gapFrom + 1, dir: 'right', sprite: 'side', warp: false, label });
    } else this.walls.push({ x, y: y0, h: y1 - y0 + 1, style: 'beam' });
  }
  /** Merdiven: ladder dekoru (x, y-1) üstünde, geçiş karosu (x, y). */
  ladderWarp(x: number, y: number, to: string, tx: number, ty: number, facing: string, label?: string) {
    this.warps.push({ x, y, w: 1, h: 1, to, tx, ty, facing, label });
    this.doors.push({ x, y, dir: 'up', sprite: 'ladder', warp: true, label });
  }
}

const ROOMS: RoomSpec[] = [
  {
    id: 'inn', name: 'Yorgun Yaban Domuzu Hanı', w: 21, h: 14, floor: 'floor_wood', wall: 'wall_wood', music: 'inn', dark: 0.35,
    exit: { x: 7, to: 'world', tx: 88, ty: 51, facing: 'down' },
    build: (b) => {
      // Mutfak bölmesi (sağda)
      b.vwall(14, 2, 12, 8, 9, 'Mutfak');
      // Bar tezgâhı
      for (let x = 2; x <= 6; x++) b.prop('counter', x, 5);
      b.points.bertram = { x: 4, y: 4 };
      b.points.bar_front = { x: 4, y: 6 };
      b.wallProp('dish_shelf', 2, 1);
      b.wallProp('shelf_dishes2', 3, 1);
      b.wallProp('bookshelf', 5, 1);
      b.prop('barrels', 1, 4);
      b.wallProp('clock', 7, 1);
      b.prop('fireplace', 10, 1, { light: { radius: 230, color: 0xff8a3a, flicker: true } });
      b.block(10, 0, 10, 2);
      b.wallProp('shield_wall', 8, 1);
      b.wallProp('torch_wall', 1, 1, { light: { radius: 120, color: 0xffb060, flicker: true } });
      b.wallProp('torch_wall', 12, 1, { light: { radius: 120, color: 0xffb060, flicker: true } });
      // Masalar
      b.prop('tavern_table', 4, 9, { interact: 'sit_table' });
      b.prop('tavern_table', 9, 9);
      b.prop('tavern_table2', 11, 6);
      b.prop('tavern_table2', 8, 6);
      b.prop('stool', 3, 10);
      b.prop('stool', 5, 8);
      b.prop('stool', 10, 10);
      b.prop('stool', 8, 8);
      // Oturma düzeni kasta göre: şöminenin önündeki iyi masalar üst kastlara,
      // ortadaki masalar köylülere, mutfak kapısının yanındaki karanlık köşe köksüzlere.
      b.points.good_1 = { x: 9, y: 7 };
      b.points.good_2 = { x: 10, y: 7 };
      b.points.good_3 = { x: 12, y: 7 };
      b.points.good_4 = { x: 10, y: 6 };
      b.points.good_5 = { x: 12, y: 6 };
      b.points.good_6 = { x: 12, y: 8 };
      b.points.table_vera = { x: 5, y: 10 };
      b.points.table_lina = { x: 5, y: 8 };
      // İlk kadeh (0.6.0): Joseph Vera'nın masasına oturur
      b.points.table_joseph = { x: 3, y: 9 };
      b.points.seat_m1 = { x: 2, y: 8 };
      b.points.seat_m3 = { x: 2, y: 10 };
      b.points.seat_m5 = { x: 7, y: 8 };
      b.points.seat_m6 = { x: 10, y: 9 };
      b.points.seat_m7 = { x: 7, y: 10 };
      b.points.seat_m8 = { x: 10, y: 10 };
      b.points.back_1 = { x: 13, y: 11 };
      b.points.back_2 = { x: 12, y: 11 };
      b.points.back_3 = { x: 13, y: 10 };
      b.points.bar_1 = { x: 1, y: 6 };
      b.points.bar_2 = { x: 7, y: 5 };
      b.points.stage = { x: 7, y: 7 };
      // İyi masaların bölgesi (köksüz biri oraya oturursa uyarılır)
      b.triggers.push({ id: 'inn_good_tables', x: 9, y: 6, w: 4, h: 3 });
      b.points.entrance = { x: 7, y: 11 };
      // Tavan arasına merdiven
      b.prop('ladder', 13, 2);
      b.block(13, 0, 13, 2);
      b.ladderWarp(13, 3, 'inn_attic', 2, 4, 'down', 'Tavan Arası');
      // Mutfak
      b.prop('stove', 16, 2);
      b.prop('sink', 17, 2);
      b.prop('kitchen_counter', 18, 2);
      b.prop('kitchen_counter', 19, 2);
      b.prop('sacks', 19, 6);
      b.prop('barrels', 16, 11);
      b.prop('pots', 19, 9);
      b.prop('table_round', 17, 7);
      b.wallProp('torch_wall', 15, 1, { light: { radius: 120, color: 0xffb060, flicker: true } });
      b.points.kitchen = { x: 17, y: 5 };
      b.points.dishes = { x: 17, y: 3 };
    },
  },
  {
    id: 'inn_attic', name: 'Tavan Arası', w: 10, h: 7, floor: 'floor_wood2', wall: 'wall_wood', music: 'night', dark: 0.55,
    exit: { x: -1, to: 'inn', tx: 13, ty: 4, facing: 'down' },
    build: (b) => {
      b.prop('ladder', 2, 2);
      b.block(2, 2, 2, 2);
      b.ladderWarp(2, 3, 'inn', 13, 4, 'down', 'Aşağı');
      b.prop('bed', 7, 4, { interact: 'bed_attic' });
      b.points.bed = { x: 6, y: 4 };
      b.prop('chest', 8, 2);
      b.prop('sacks', 4, 5);
      b.prop('crate_rack', 5, 2);
      b.wallProp('window_small', 6, 1, { light: { radius: 90, color: 0x9fb8ff, night: false } });
    },
  },
  {
    id: 'guild', name: 'Maceracılar Loncası — Brindlewood Şubesi', short: 'Maceracılar Loncası', w: 15, h: 13, floor: 'floor_flag', wall: 'wall_stone', music: 'guild', dark: 0.3,
    exit: { x: 7, to: 'world', tx: 109, ty: 57, facing: 'down' },
    build: (b) => {
      for (let x = 3; x <= 8; x++) b.prop('counter', x, 5);
      b.points.celeste = { x: 6, y: 4 };
      b.points.counter_front = { x: 6, y: 6 };
      b.wallProp('bookshelf', 3, 1);
      b.wallProp('shelf_books2', 4, 1);
      b.wallProp('drawers', 8, 1);
      b.wallProp('__board', 11, 1, { interact: 'quest_board' });
      b.block(10, 2, 12, 2);
      b.points.board = { x: 11, y: 3 };
      b.wallProp('__ranks', 6, 1, { interact: 'rank_table' });
      b.prop('__stone', 12, 7, { interact: 'appraisal_stone', light: { radius: 110, color: 0x7cc8ff, flicker: true } });
      b.block(12, 6, 12, 7);
      b.points.stone = { x: 11, y: 8 };
      b.prop('tavern_table', 3, 10);
      b.prop('tavern_table2', 8, 9);
      b.prop('stool', 2, 11);
      b.prop('stool', 4, 9);
      b.prop('weapon_rack', 1, 7);
      b.prop('armor_stand', 13, 11);
      b.wallProp('torch_wall', 1, 1, { light: { radius: 130, color: 0xffb060, flicker: true } });
      b.wallProp('torch_wall', 13, 1, { light: { radius: 130, color: 0xffb060, flicker: true } });
      b.points.vera = { x: 9, y: 8 };
      b.points.lina = { x: 10, y: 8 };
      b.points.adv1 = { x: 4, y: 8 };
      b.points.adv2 = { x: 1, y: 10 };
      b.points.adv3 = { x: 9, y: 10 };
      b.points.adv4 = { x: 5, y: 11 };
      b.points.entrance = { x: 7, y: 10 };
    },
  },
  {
    id: 'smithy', name: 'Demirci', w: 11, h: 10, floor: 'floor_flag2', wall: 'wall_stone', music: 'village', dark: 0.35,
    exit: { x: 4, to: 'world', tx: 77, ty: 68, facing: 'down' },
    build: (b) => {
      b.prop('fireplace', 8, 1, { light: { radius: 220, color: 0xff7a2a, flicker: true } });
      b.block(8, 0, 8, 2);
      b.prop('anvil', 7, 4);
      for (let x = 2; x <= 5; x++) b.prop('counter', x, 5);
      b.points.smith = { x: 4, y: 4 };
      b.points.counter_front = { x: 4, y: 6 };
      b.prop('weapon_rack', 1, 3);
      b.wallProp('armor_stand', 3, 1);
      b.wallProp('helm_shelf', 5, 1);
      b.prop('barrels', 9, 7);
      b.prop('chest', 9, 4);
      b.wallProp('shield_wall', 6, 1);
    },
  },
  {
    id: 'shop', name: 'Genel Dükkân', w: 10, h: 9, floor: 'floor_wood', wall: 'wall_plaster', music: 'village', dark: 0.3,
    exit: { x: 4, to: 'world', tx: 106, ty: 71, facing: 'down' },
    build: (b) => {
      for (let x = 2; x <= 6; x++) b.prop('counter', x, 4);
      b.points.shopkeeper = { x: 4, y: 3 };
      b.points.counter_front = { x: 4, y: 5 };
      b.wallProp('shelf_books2', 2, 1);
      b.wallProp('shelf_dishes2', 3, 1);
      b.wallProp('cabinet', 5, 1);
      b.wallProp('drawers', 6, 1);
      b.prop('sacks', 8, 6);
      b.prop('barrels', 8, 3);
      b.prop('crate_rack', 2, 7);
      b.wallProp('torch_wall', 8, 1, { light: { radius: 120, color: 0xffb060, flicker: true } });
    },
  },
  {
    id: 'healer', name: 'Şifacı', w: 10, h: 9, floor: 'floor_check', wall: 'wall_plaster', music: 'village', dark: 0.3,
    exit: { x: 4, to: 'world', tx: 116, ty: 71, facing: 'down' },
    build: (b) => {
      for (let x = 2; x <= 5; x++) b.prop('counter', x, 4);
      b.points.healer = { x: 3, y: 3 };
      b.points.counter_front = { x: 3, y: 5 };
      b.wallProp('bookshelf', 2, 1);
      b.wallProp('dish_shelf', 4, 1);
      b.prop('pots', 6, 3);
      b.prop('bed', 8, 5);
      // kurutulan otlar: saksı (toplanabilir şifalı ot görseli yalnızca dünyadaki toplama noktalarında)
      b.prop('pots', 1, 7);
      b.prop('side_table', 7, 7);
      b.wallProp('torch_wall', 7, 1, { light: { radius: 120, color: 0xffd090, flicker: true } });
    },
  },
  // ------------------------------------------------------------ 0.2.0
  {
    id: 'bakery', name: 'Fırın', w: 10, h: 9, floor: 'floor_wood', wall: 'wall_plaster', music: 'village', dark: 0.28,
    exit: { x: 4, to: 'world', tx: 158, ty: 70, facing: 'down' },
    build: (b) => {
      for (let x = 2; x <= 6; x++) b.prop('counter', x, 4);
      b.points.baker = { x: 4, y: 3 };
      b.points.counter_front = { x: 4, y: 5 };
      b.prop('fireplace', 8, 1, { light: { radius: 210, color: 0xff8a3a, flicker: true } });
      b.block(8, 0, 8, 2);
      b.wallProp('shelf_dishes2', 2, 1);
      b.wallProp('cabinet', 4, 1);
      b.wallProp('dish_shelf', 6, 1);
      b.prop('sacks', 8, 6);
      b.prop('barrels', 1, 6);
      b.prop('table_round', 6, 7);
      b.points.queue = { x: 6, y: 5 };
    },
  },
  {
    id: 'tailor', name: 'Terzi', w: 10, h: 9, floor: 'floor_check', wall: 'wall_plaster', music: 'village', dark: 0.25,
    exit: { x: 5, to: 'world', tx: 185, ty: 70, facing: 'down' },
    build: (b) => {
      for (let x = 3; x <= 6; x++) b.prop('counter', x, 4);
      b.points.tailor = { x: 5, y: 3 };
      b.points.counter_front = { x: 5, y: 5 };
      b.prop('wardrobe', 1, 3);
      b.wallProp('drawers', 7, 1);
      b.wallProp('shelf_books2', 3, 1);
      b.prop('armor_stand', 8, 4);
      b.prop('table_round', 7, 7);
      b.prop('side_table', 2, 7);
      b.wallProp('torch_wall', 5, 1, { light: { radius: 120, color: 0xffd090, flicker: true } });
      b.points.queue = { x: 7, y: 5 };
    },
  },
  {
    id: 'tannery', name: 'Tabakhane', w: 11, h: 9, floor: 'floor_flag2', wall: 'wall_stone', music: 'village', dark: 0.38,
    exit: { x: 4, to: 'world', tx: 194, ty: 93, facing: 'down' },
    build: (b) => {
      for (let x = 2; x <= 5; x++) b.prop('counter', x, 4);
      b.points.tanner = { x: 3, y: 3 };
      b.points.counter_front = { x: 3, y: 5 };
      b.prop('barrels', 8, 3);
      b.prop('barrels', 9, 6);
      b.prop('sacks', 1, 6);
      b.prop('crate_rack', 6, 7);
      b.prop('pots', 9, 2);
      b.wallProp('torch_wall', 6, 1, { light: { radius: 130, color: 0xffb060, flicker: true } });
      b.points.queue = { x: 6, y: 5 };
    },
  },
  {
    id: 'lodge', name: 'Avcı Kulübesi', w: 9, h: 8, floor: 'floor_wood2', wall: 'wall_wood', music: 'village', dark: 0.4,
    exit: { x: 4, to: 'world', tx: 133, ty: 27, facing: 'down' },
    build: (b) => {
      for (let x = 2; x <= 4; x++) b.prop('counter', x, 3);
      b.points.hunter = { x: 3, y: 2 };
      b.points.counter_front = { x: 3, y: 4 };
      b.prop('weapon_rack', 1, 4);
      b.prop('fireplace', 7, 1, { light: { radius: 190, color: 0xff8a3a, flicker: true } });
      b.block(7, 0, 7, 2);
      b.prop('chest', 1, 6);
      b.prop('table_round', 6, 5);
      b.prop('stool', 7, 6);
      b.points.queue = { x: 5, y: 4 };
    },
  },
  {
    id: 'farmhouse', name: 'Haldor\'un Çiftlik Evi', w: 11, h: 9, floor: 'floor_wood', wall: 'wall_wood', music: 'village', dark: 0.38,
    exit: { x: 5, to: 'world', tx: 146, ty: 37, facing: 'down' },
    build: (b) => {
      b.prop('fireplace', 2, 1, { light: { radius: 220, color: 0xff8a3a, flicker: true } });
      b.block(2, 0, 2, 2);
      b.prop('table_round', 5, 4);
      b.prop('stool', 4, 5);
      b.prop('stool', 7, 4);
      b.points.haldor = { x: 6, y: 5 };
      b.prop('bed', 9, 4);
      b.prop('sacks', 1, 6);
      b.prop('barrels', 9, 7);
      b.wallProp('dish_shelf', 5, 1);
      b.wallProp('clock', 7, 1);
    },
  },
  {
    // Bölüm II: Değirmen bodrumu (f_cellar). Kapı yalnızca görev sırasında açılır (director.beforeWarp).
    id: 'mill_cellar', name: 'Değirmen Bodrumu', w: 14, h: 11, floor: 'floor_flag', wall: 'wall_stone', music: 'night', dark: 0.62,
    exit: { x: 4, to: 'world', tx: 64, ty: 91, facing: 'down' },
    build: (b) => {
      b.prop('sacks', 2, 3);
      b.prop('sacks', 3, 3);
      b.prop('barrels', 10, 3);
      b.prop('barrels', 11, 4);
      b.prop('crate_rack', 7, 3);
      b.prop('sacks', 11, 8);
      b.prop('barrels', 1, 8);
      b.wallProp('torch_wall', 2, 1, { light: { radius: 140, color: 0xffa050, flicker: true } });
      b.wallProp('torch_wall', 11, 1, { light: { radius: 140, color: 0xffa050, flicker: true } });
      b.points.rats = { x: 8, y: 6 };
      b.points.rats2 = { x: 10, y: 6 };
      b.points.entry = { x: 4, y: 8 };
      b.points.vera = { x: 5, y: 8 };
      b.points.lina = { x: 3, y: 8 };
    },
  },
];

export function buildInteriors(floors: Record<string, number>): Record<string, MapData> {
  const out: Record<string, MapData> = {};
  for (const r of ROOMS) {
    const b = new Builder(r.w, r.h);
    // çevre: üst 2 sıra duvar, yanlar ve alt
    b.block(0, 0, r.w - 1, 1);
    b.block(0, 0, 0, r.h - 1);
    b.block(r.w - 1, 0, r.w - 1, r.h - 1);
    b.block(0, r.h - 1, r.w - 1, r.h - 1);
    if (r.exit.x >= 0) {
      const ew = r.exit.w ?? 1;
      b.open(r.exit.x, r.h - 1, r.exit.x + ew - 1, r.h - 1);
      for (let i = 0; i < ew; i++) {
        b.warps.push({ x: r.exit.x + i, y: r.h - 1, w: 1, h: 1, to: r.exit.to, tx: r.exit.tx, ty: r.exit.ty, facing: r.exit.facing ?? 'down', label: 'Dışarı' });
        b.doors.push({ x: r.exit.x + i, y: r.h - 1, dir: 'down', sprite: 'exit', warp: true, label: 'Dışarı' });
      }
      b.points.exit = { x: r.exit.x, y: r.h - 2 };
    }
    r.build(b);
    const terrain = new Uint8Array(r.w * r.h).fill(TERRAIN.floor);
    const floorTiles = new Int16Array(r.w * r.h);
    const fi = floors[r.floor] ?? 0;
    for (let i = 0; i < floorTiles.length; i++) floorTiles[i] = fi;
    out[r.id] = {
      id: r.id, name: r.name, short: r.short, w: r.w, h: r.h, indoor: true, terrain, solid: b.solid, hard: b.hard, colliders: b.colliders, floorTiles,
      wallTiles: [{ x: 0, y: 0, h: 2, style: r.wall }, ...b.walls],
      props: b.props, buildings: [], zones: [{ id: r.id, x: 0, y: 0, w: r.w, h: r.h, name: r.name, safe: true }],
      spawns: [], warps: b.warps, doors: b.doors, triggers: b.triggers, gathers: [], music: r.music, ambientDark: r.dark, points: b.points,
    };
  }
  return out;
}
