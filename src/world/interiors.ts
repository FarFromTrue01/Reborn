// İç mekân haritaları. Her oda: zemin karosu, üst duvar (2 karo), çevre engelleri, mobilyalar.
import { TERRAIN, TILE, type MapData, type PropPlacement, type Warp, type Trigger } from './types';
import { PROP_INFO } from '../data/props';

interface RoomSpec {
  id: string;
  name: string;
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
  triggers: Trigger[] = [];
  points: Record<string, { x: number; y: number }> = {};
  walls: { x: number; y: number; h: number; style: string }[] = [];
  solid: Uint8Array;
  floorMask: Uint8Array;
  constructor(public w: number, public h: number) {
    this.solid = new Uint8Array(w * h);
    this.floorMask = new Uint8Array(w * h).fill(1);
  }
  block(x0: number, y0: number, x1: number, y1: number) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.solid[y * this.w + x] = 1;
  }
  open(x0: number, y0: number, x1: number, y1: number) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.solid[y * this.w + x] = 0;
  }
  prop(key: string, tx: number, ty: number, extra: Partial<PropPlacement> = {}) {
    const info = PROP_INFO[key] ?? { baseY: 0 };
    const p: PropPlacement = { key, x: tx * TILE + TILE / 2, y: ty * TILE + TILE - 2, ...extra };
    this.props.push(p);
    if (info.solid && !extra.flat) this.block(tx + info.solid[0], ty + info.solid[1], tx + info.solid[2], ty + info.solid[3]);
    return p;
  }
  /** Duvara asılı (engelsiz) dekor. */
  wallProp(key: string, tx: number, ty: number, extra: Partial<PropPlacement> = {}) {
    const p: PropPlacement = { key, x: tx * TILE + TILE / 2, y: ty * TILE + TILE - 2, depthOffset: -2000, ...extra };
    this.props.push(p);
    return p;
  }
  /** Dikey iç duvar (bölme). */
  vwall(x: number, y0: number, y1: number, gapFrom = -1, gapTo = -1) {
    for (let y = y0; y <= y1; y++) {
      if (y >= gapFrom && y <= gapTo) continue;
      this.block(x, y, x, y);
    }
    this.walls.push({ x, y: y0, h: y1 - y0 + 1, style: 'beam' });
    if (gapFrom >= 0) this.walls.push({ x, y: gapFrom, h: gapTo - gapFrom + 1, style: 'gap' });
  }
  warp(x: number, y: number, to: string, tx: number, ty: number, facing: string, label?: string) {
    this.warps.push({ x, y, w: 1, h: 1, to, tx, ty, facing, label });
  }
}

const ROOMS: RoomSpec[] = [
  {
    id: 'inn', name: 'Yorgun Yaban Domuzu Hanı', w: 21, h: 14, floor: 'floor_wood', wall: 'wall_wood', music: 'inn', dark: 0.35,
    exit: { x: 7, to: 'world', tx: 88, ty: 51, facing: 'down' },
    build: (b) => {
      // Mutfak bölmesi (sağda)
      b.vwall(14, 2, 12, 8, 9);
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
      b.prop('tavern_table', 4, 9);
      b.prop('tavern_table', 9, 9);
      b.prop('tavern_table2', 11, 6);
      b.prop('tavern_table2', 8, 6);
      b.prop('stool', 3, 10);
      b.prop('stool', 5, 8);
      b.prop('stool', 10, 10);
      b.prop('stool', 8, 8);
      b.points.table_vera = { x: 9, y: 7 };
      b.points.table_lina = { x: 10, y: 7 };
      b.points.table_a = { x: 3, y: 8 };
      b.points.table_b = { x: 5, y: 10 };
      b.points.table_c = { x: 10, y: 10 };
      b.points.table_d = { x: 12, y: 7 };
      b.points.entrance = { x: 7, y: 11 };
      // Tavan arasına merdiven
      b.prop('ladder', 13, 2);
      b.block(13, 0, 13, 1);
      b.warp(13, 3, 'inn_attic', 2, 4, 'down', 'Tavan Arası');
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
      b.warp(2, 3, 'inn', 13, 4, 'down', 'Aşağı');
      b.prop('bed', 7, 4, { interact: 'bed_attic' });
      b.points.bed = { x: 6, y: 4 };
      b.prop('chest', 8, 2);
      b.prop('sacks', 4, 5);
      b.prop('crate_rack', 5, 2);
      b.wallProp('window_small', 6, 1, { light: { radius: 90, color: 0x9fb8ff, night: false } });
    },
  },
  {
    id: 'guild', name: 'Maceracılar Loncası — Brindlewood Şubesi', w: 15, h: 13, floor: 'floor_flag', wall: 'wall_stone', music: 'guild', dark: 0.3,
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
      b.points.adv2 = { x: 2, y: 10 };
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
      b.prop('herb_plant', 1, 6);
      b.prop('herb_plant', 1, 7);
      b.prop('side_table', 7, 7);
      b.wallProp('torch_wall', 7, 1, { light: { radius: 120, color: 0xffd090, flicker: true } });
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
      for (let i = 0; i < ew; i++) b.warp(r.exit.x + i, r.h - 1, r.exit.to, r.exit.tx, r.exit.ty, r.exit.facing ?? 'down', 'Dışarı');
      b.points.exit = { x: r.exit.x, y: r.h - 2 };
    }
    r.build(b);
    const terrain = new Uint8Array(r.w * r.h).fill(TERRAIN.floor);
    const floorTiles = new Int16Array(r.w * r.h);
    const fi = floors[r.floor] ?? 0;
    for (let i = 0; i < floorTiles.length; i++) floorTiles[i] = fi;
    out[r.id] = {
      id: r.id, name: r.name, w: r.w, h: r.h, indoor: true, terrain, solid: b.solid, floorTiles,
      wallTiles: [{ x: 0, y: 0, h: 2, style: r.wall }, ...b.walls],
      props: b.props, buildings: [], zones: [{ id: r.id, x: 0, y: 0, w: r.w, h: r.h, name: r.name, safe: true }],
      spawns: [], warps: b.warps, triggers: b.triggers, gathers: [], music: r.music, ambientDark: r.dark, points: b.points,
    };
  }
  return out;
}
