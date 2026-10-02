// Açık dünya haritası: başlangıç ormanı + Brindlewood köyü.
// Deterministik (tohumlu) üretim + elle yerleştirilmiş önemli yerler.
import { TERRAIN, TILE, type MapData, type PropPlacement, type BuildingPlacement, type SpawnDef, type Zone, type Gather, type Warp, type Trigger } from './types';
import { PROP_INFO, TREE_KEYS_FOREST, TREE_KEYS_LIGHT, BUSH_KEYS } from '../data/props';

export function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const WORLD_W = 150;
export const WORLD_H = 110;

export interface BuildingMeta {
  w: number;
  h: number;
  wallTop: number;
  doors: { x: number; y: number }[];
  collide: { x: number; y: number; w: number; h: number };
}

export function buildWorld(bmeta: Record<string, BuildingMeta>): MapData {
  const W = WORLD_W, H = WORLD_H;
  const rnd = mulberry32(1337);
  const terrain = new Uint8Array(W * H).fill(TERRAIN.grass);
  const solid = new Uint8Array(W * H);
  const reserved = new Uint8Array(W * H); // ağaç konmayacak yerler
  const props: PropPlacement[] = [];
  const buildings: BuildingPlacement[] = [];
  const zones: Zone[] = [];
  const spawns: SpawnDef[] = [];
  const warps: Warp[] = [];
  const triggers: Trigger[] = [];
  const gathers: Gather[] = [];
  const points: Record<string, { x: number; y: number }> = {};

  const idx = (x: number, y: number) => y * W + x;
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const set = (x: number, y: number, t: number) => { if (inb(x, y)) terrain[idx(x, y)] = t; };
  const get = (x: number, y: number) => (inb(x, y) ? terrain[idx(x, y)] : TERRAIN.forest);
  const reserve = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inb(x, y)) reserved[idx(x, y)] = 1;
  };
  const rect = (t: number, x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t);
  };
  const disc = (t: number, cx: number, cy: number, r: number, jag = 0.25, only?: (cur: number) => boolean) => {
    for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y++)
      for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) {
        const d = Math.hypot(x - cx, y - cy);
        const rr = r * (1 + (Math.sin(x * 1.7 + y * 0.9) + Math.cos(x * 0.6 - y * 1.3)) * jag * 0.5);
        if (d <= rr && (!only || only(get(x, y)))) set(x, y, t);
      }
  };
  const path = (t: number, pts: [number, number][], width: number, wobble = 0.6) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
      for (let k = 0; k <= n; k++) {
        const u = k / n;
        const x = x0 + (x1 - x0) * u + Math.sin((x0 + k) * 0.35) * wobble;
        const y = y0 + (y1 - y0) * u + Math.cos((y0 + k) * 0.3) * wobble;
        for (let dy = -width; dy <= width; dy++)
          for (let dx = -width; dx <= width; dx++) {
            if (dx * dx + dy * dy <= width * width + 0.5) {
              const xx = Math.round(x + dx), yy = Math.round(y + dy);
              if (get(xx, yy) !== TERRAIN.water || t === TERRAIN.water) set(xx, yy, t);
              reserve(xx - 1, yy - 1, xx + 1, yy + 1);
            }
          }
      }
    }
  };
  const solidRect = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inb(x, y)) solid[idx(x, y)] = 1;
  };
  const prop = (key: string, tx: number, ty: number, extra: Partial<PropPlacement> = {}) => {
    const info = PROP_INFO[key] ?? { baseY: 0 };
    const p: PropPlacement = { key, x: tx * TILE + TILE / 2, y: ty * TILE + TILE - 2, sway: !!info.sway, flat: info.flat, ...extra };
    props.push(p);
    if (info.solid) solidRect(tx + info.solid[0], ty + info.solid[1], tx + info.solid[2], ty + info.solid[3]);
    reserve(tx - 1, ty - 1, tx + 1, ty + 1);
    return p;
  };

  // ============================================================ büyük hatlar
  // Batı: orman zemini
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const edge = 54 + Math.round(Math.sin(y * 0.15) * 3 + Math.cos(y * 0.07) * 2);
      if (x < edge) set(x, y, TERRAIN.forest);
      // kuzey ve doğu kenar ormanları
      if (y < 14 + Math.round(Math.sin(x * 0.2) * 2) && x > 60) set(x, y, TERRAIN.forest);
      if (y > H - 7 + Math.round(Math.sin(x * 0.3) * 2)) set(x, y, TERRAIN.forest);
    }

  // Nehir: kuzeyden güneye kıvrılarak
  const riverX = (y: number) => 58 + Math.sin(y * 0.09) * 2.5 + Math.sin(y * 0.031 + 1) * 2;
  for (let y = 0; y < H; y++) {
    const cx = riverX(y);
    for (let x = Math.floor(cx - 2); x <= Math.ceil(cx + 2); x++) {
      if (Math.abs(x - cx) <= 1.7) set(x, y, TERRAIN.water);
      else if (Math.abs(x - cx) <= 2.6 && rnd() < 0.5) set(x, y, TERRAIN.sand);
    }
    reserve(Math.floor(cx - 3), y, Math.ceil(cx + 3), y);
  }

  // Göletler
  disc(TERRAIN.water, 40, 82, 3.2, 0.3);
  disc(TERRAIN.sand, 40, 82, 4.4, 0.3, (c) => c !== TERRAIN.water);
  disc(TERRAIN.water, 12, 96, 4, 0.35);
  disc(TERRAIN.water, 8, 40, 2.5, 0.3);
  reserve(34, 76, 46, 88);
  reserve(6, 90, 18, 102);

  // Açıklıklar
  const clearings: [number, number, number][] = [[24, 64, 5], [31, 31, 6], [18, 13, 8], [44, 52, 3], [14, 76, 3], [36, 100, 3]];
  for (const [cx, cy, r] of clearings) {
    disc(TERRAIN.grass, cx, cy, r, 0.3, (c) => c === TERRAIN.forest);
    reserve(cx - r, cy - r, cx + r, cy + r);
  }
  disc(TERRAIN.flowers, 24, 64, 2.2, 0.2);
  disc(TERRAIN.mud, 18, 13, 5, 0.3); // goblin kampı çamurlu
  disc(TERRAIN.flowers, 31, 31, 2.5, 0.4);

  // ============================================================ yollar
  // Uyanış açıklığından köprüye, oradan meydana
  path(TERRAIN.dirt, [[27, 64], [33, 62], [40, 60], [47, 58], [53, 58], [62, 58]], 1, 0.8);
  // Ormana patikalar
  path(TERRAIN.dirt, [[38, 60], [36, 50], [33, 40], [31, 34]], 0, 0.6);
  path(TERRAIN.dirt, [[31, 28], [28, 22], [23, 17], [20, 14]], 0, 0.7);
  path(TERRAIN.dirt, [[40, 60], [41, 70], [40, 77]], 0, 0.5);
  // Köy içi
  path(TERRAIN.dirt, [[62, 58], [70, 58], [80, 57], [88, 58]], 1, 0.4);
  path(TERRAIN.dirt, [[102, 58], [112, 58], [122, 57], [132, 57], [142, 57], [149, 57]], 1, 0.4);
  path(TERRAIN.dirt, [[95, 52], [95, 44], [96, 34], [100, 30]], 1, 0.3); // kuzey tarlalara
  path(TERRAIN.dirt, [[95, 64], [92, 72], [86, 80], [76, 88], [69, 92]], 1, 0.4); // güney, değirmen
  path(TERRAIN.dirt, [[100, 64], [103, 71], [118, 71]], 0, 0.3);
  path(TERRAIN.dirt, [[88, 62], [82, 66], [77, 68]], 0, 0.3);
  path(TERRAIN.dirt, [[70, 58], [70, 52], [72, 48]], 0, 0.3);

  // Meydan: kaldırım
  for (let y = 51; y <= 64; y++)
    for (let x = 87; x <= 103; x++) {
      const dx = (x - 95) / 8.5, dy = (y - 57.5) / 7;
      if (dx * dx + dy * dy <= 1.05) set(x, y, TERRAIN.cobble);
    }
  reserve(84, 48, 106, 67);

  // Tarlalar
  const field = (x0: number, y0: number, x1: number, y1: number, crop: string) => {
    rect(TERRAIN.farm, x0, y0, x1, y1);
    reserve(x0 - 1, y0 - 1, x1 + 1, y1 + 1);
    for (let y = y0 + 1; y < y1; y += 2)
      for (let x = x0 + 1; x < x1; x += 2) if (rnd() < 0.8) props.push({ key: crop, x: x * TILE + 16, y: y * TILE + 28, sway: true });
  };
  field(99, 22, 110, 30, 'crop_cabbage');
  field(113, 22, 126, 30, 'crop_corn');
  field(78, 90, 90, 98, 'crop_carrot');
  field(93, 90, 102, 97, 'crop_tomato');
  // Buğday tarlası (çimen üstünde buğday öbekleri)
  for (let y = 36; y <= 42; y += 2) for (let x = 128; x <= 140; x += 4) props.push({ key: 'wheat', x: x * TILE, y: y * TILE + 30, sway: true });
  reserve(126, 34, 142, 44);

  // ============================================================ binalar
  const place = (id: string, name: string, tx: number, tyBottom: number, enter: BuildingPlacement['enter'], extra: Partial<BuildingPlacement> = {}) => {
    const m = bmeta[id];
    if (!m) return;
    buildings.push({ id, name, tx, tyBottom, enter, ...extra });
    const px = tx * TILE, py = tyBottom * TILE - m.h;
    const c = m.collide;
    const x0 = Math.floor((px + c.x + 4) / TILE), x1 = Math.floor((px + c.x + c.w - 4) / TILE);
    const y0 = Math.floor((py + c.y + 8) / TILE), y1 = tyBottom - 1;
    solidRect(x0, y0, x1, y1);
    reserve(x0 - 1, y0 - 2, x1 + 1, y1 + 2);
    // önündeki zemin
    for (const d of m.doors) {
      const dx = Math.floor((px + d.x) / TILE);
      if (enter) warps.push({ x: dx, y: tyBottom, w: 1, h: 1, to: enter.map, tx: enter.x, ty: enter.y, facing: 'up', label: name, hours: extra.hours });
      else warps.push({ x: dx, y: tyBottom, w: 1, h: 1, to: '', tx: 0, ty: 0, facing: 'up', label: name, closedMsg: extra.locked ?? 'Kapı kilitli.' });
      points['door_' + id] = { x: dx, y: tyBottom };
    }
  };

  place('inn', 'Yorgun Yaban Domuzu Hanı', 84, 50, { map: 'inn', x: 7, y: 12 }, { sign: 'sign_inn' });
  place('guild', 'Maceracılar Loncası', 105, 56, { map: 'guild', x: 6, y: 11 }, { sign: 'sign_sword', hours: [7, 21] });
  place('smithy', 'Demirci', 75, 67, { map: 'smithy', x: 4, y: 9 }, { sign: 'sign_tools', hours: [8, 18] });
  place('shop', 'Genel Dükkân', 104, 70, { map: 'shop', x: 4, y: 8 }, { sign: 'sign_bag', hours: [8, 19] });
  place('healer', 'Şifacı', 113, 70, { map: 'healer', x: 4, y: 8 }, { sign: 'sign_potion', hours: [9, 17] });
  place('house_a', 'Ev', 71, 47, null, { locked: 'Kapı kilitli. İçeriden çocuk sesleri geliyor.' });
  place('house_b', 'Ev', 115, 48, null, { locked: 'Kapı kilitli.' });
  place('house_c', 'Ev', 79, 79, null, { locked: 'Kapı kilitli. Kapının arkasında bir köpek havlıyor.' });
  place('house_d', 'Ev', 103, 85, null, { locked: 'Kapı kilitli.' });
  place('house_e', 'Ev', 121, 64, null, { locked: 'Kapı kilitli. Ekmek kokusu geliyor.' });
  place('house_b', 'Ev', 124, 79, null, { locked: 'Kapı kilitli.' });
  place('house_a', 'Ev', 64, 79, null, { locked: 'Kapı kilitli.' });
  place('house_c', 'Ev', 88, 86, null, { locked: 'Kapı kilitli.' });
  place('barn', 'Ahır', 116, 41, null, { locked: 'Ahırın kapısı sürgülü. İçeriden inek sesi geliyor.' });
  place('mill', 'Değirmen', 63, 98, null, { locked: 'Değirmenci kapıyı içeriden kilitlemiş.' });
  place('guardhouse', 'Karakol', 135, 54, null, { locked: 'Karakolun kapısı muhafızlara ait.' });

  // ============================================================ köy dekorları
  prop('well', 95, 58);
  points.well = { x: 95, y: 59 };
  points.plaza = { x: 95, y: 61 };
  prop('stall_orange', 90, 62);
  prop('stall_blue', 100, 62);
  prop('stall_orange', 99, 53, { flipX: true });
  prop('cart', 88, 55);
  prop('bench', 92, 64);
  prop('bench', 98, 64);
  prop('trough', 104, 60);
  prop('hay_pile', 86, 60);
  prop('signpost', 103, 57);
  points.board = { x: 104, y: 57 };
  // fenerler (gece ışık)
  for (const [x, y] of [[84, 57], [104, 55], [88, 51], [102, 51], [92, 65], [98, 65], [70, 57], [112, 57], [124, 56], [80, 64], [110, 69], [96, 47]] as [number, number][])
    prop('lantern', x, y, { light: { radius: 120, color: 0xffc070, flicker: true, night: true } });
  // han çevresi
  prop('barrels', 83, 50);
  prop('firewood', 95, 50);
  prop('table_out', 82, 53);
  prop('stool', 81, 53);
  // demirci önü
  prop('anvil', 84, 66);
  prop('weapon_rack_out', 85, 64);
  prop('logpile', 73, 67);
  // ev bahçeleri
  prop('clothesline', 79, 46);
  prop('woodshed', 120, 50);
  prop('outhouse', 69, 80);
  prop('hay_roll', 114, 39);
  prop('hay_bales', 126, 42);
  prop('cart', 112, 42);
  prop('scarecrow', 105, 26);
  prop('scarecrow', 120, 27);
  prop('scarecrow', 85, 94);
  prop('trough', 127, 40);
  prop('hay_pile', 92, 99);
  // çitler
  for (let x = 98; x <= 127; x += 4) prop('fence_h', x, 32);
  for (let x = 78; x <= 102; x += 4) prop('fence_h', x, 100);
  // meyve ağaçları (elma toplama)
  for (const [x, y, id] of [[108, 47, 'apple1'], [126, 69, 'apple2'], [68, 69, 'apple3']] as [number, number, string][]) {
    prop('tree_round', x, y, { tint: 0xffffff });
    gathers.push({ id, x, y: y + 1, item: 'apple', kind: 'apple' });
  }

  // Antrenman alanı (meydanın batısı, nehre yakın)
  points.training = { x: 70, y: 52 };
  prop('chop_block', 66, 53, { interact: 'train_chop' });
  prop('firewood', 64, 53);
  prop('boulder2', 68, 55, { interact: 'train_lift' });
  prop('target_straw', 72, 53);
  prop('target', 74, 53, { interact: 'archery_target' });
  prop('signpost2', 69, 50, { interact: 'train_run' });
  for (const [x, y] of [[65, 49], [76, 49], [76, 56], [65, 56]] as [number, number][]) prop('weapon_rack_out', x, y);
  reserve(63, 48, 78, 57);
  zones.push({ id: 'training', x: 63, y: 48, w: 15, h: 10, name: 'Antrenman Alanı', safe: true });

  // Köprü (nehir üstünde ahşap) — terrain'de su kalır, üstüne zemin karosu ve engel kalkar
  const bridgeY0 = 57, bridgeY1 = 59;
  const bx0 = Math.floor(riverX(58) - 2.2), bx1 = Math.ceil(riverX(58) + 2.2);
  points.bridge = { x: Math.round(riverX(58)), y: 58 };

  // Kontrol noktası
  prop('fence_h', 141, 55);
  prop('fence_h', 141, 59);
  prop('lantern', 139, 55, { light: { radius: 140, color: 0xffc070, flicker: true, night: true } });
  prop('lantern', 139, 60, { light: { radius: 140, color: 0xffc070, flicker: true, night: true } });
  points.checkpoint = { x: 140, y: 57 };
  // Bariyer: x=143 boyunca geçilmez
  solidRect(143, 0, 149, H - 1);
  zones.push({ id: 'checkpoint', x: 132, y: 50, w: 12, h: 14, name: 'Şehir Yolu Kontrol Noktası', safe: true });
  // Uzaktaki şehir (görsel, yarı saydam, mavimsi)
  prop('fence_h', 144, 57);
  props.push({ key: '__city', x: 146.5 * TILE, y: 51 * TILE, flat: false, alpha: 0.8, scale: 0.35, tint: 0xb8c8e8, depthOffset: -4000 });

  // Goblin kampı
  points.goblin_camp = { x: 18, y: 13 };
  prop('tent_big', 14, 10);
  prop('tent_small', 23, 9);
  prop('tent_small', 12, 17, { flipX: true });
  props.push({ key: 'campfire_0', x: 18 * TILE + 16, y: 14 * TILE + 26, anim: ['campfire_0', 'campfire_1', 'campfire_2', 'campfire_3', 'campfire_4'], light: { radius: 170, color: 0xff9a40, flicker: true } });
  solidRect(18, 14, 18, 14);
  prop('cauldron', 20, 15);
  prop('barrels', 22, 16);
  prop('logpile', 16, 16);
  prop('weapon_rack_out', 24, 13);
  for (const [x, y] of [[9, 8], [27, 8], [8, 18], [28, 18], [17, 4]] as [number, number][]) prop('grave', x, y); // kemik/işaret direkleri
  zones.push({ id: 'goblin_camp', x: 8, y: 4, w: 21, h: 16, name: 'Goblin Kampı', danger: 3 });

  // Uyanış yeri
  points.wake = { x: 24, y: 64 };
  prop('stump_big', 21, 62);
  prop('mushrooms', 26, 61);
  prop('rocks_tiny', 22, 66);

  // ============================================================ bölgeler
  zones.push({ id: 'village', x: 62, y: 30, w: 80, h: 72, name: 'Brindlewood', safe: true, music: 'village' });
  zones.push({ id: 'forest_deep', x: 0, y: 0, w: 54, h: 22, name: 'Ormanın Derinlikleri', danger: 2, music: 'forest' });
  zones.push({ id: 'forest_mid', x: 0, y: 22, w: 56, h: 24, name: 'Orman (Orta)', danger: 1, music: 'forest' });
  zones.push({ id: 'forest_outer', x: 0, y: 46, w: 56, h: 64, name: 'Ormanın Kenarı', danger: 0, music: 'forest' });
  zones.push({ id: 'north_woods', x: 62, y: 0, w: 88, h: 18, name: 'Kuzey Korusu', music: 'forest' });

  // ============================================================ canavarlar
  const sp = (id: string, monster: string, x: number, y: number, radius: number, count: number, respawn = 360) =>
    spawns.push({ id, monster, x, y, radius, count, respawn });
  // Dış orman
  sp('rat1', 'rat', 34, 66, 4, 2);
  sp('rat2', 'rat', 44, 70, 4, 2);
  sp('rat3', 'rat', 30, 88, 5, 3);
  sp('rat4', 'rat', 50, 92, 4, 2);
  sp('rat5', 'rat', 66, 103, 3, 2); // değirmenin arkası
  sp('slime1', 'slime', 40, 76, 3, 2);
  sp('slime2', 'slime', 14, 90, 3, 2);
  sp('slime3', 'slime', 22, 78, 3, 1);
  sp('slime4', 'slime', 46, 100, 3, 2);
  sp('rabbit1', 'rabbit', 18, 58, 5, 2, 240);
  sp('rabbit2', 'rabbit', 36, 96, 5, 2, 240);
  sp('rabbit3', 'rabbit', 100, 10, 8, 3, 240);
  sp('rabbit4', 'rabbit', 46, 48, 4, 1, 240);
  // Orta orman: kurt sürüleri
  sp('wolves1', 'wolf', 31, 31, 5, 3, 600);
  sp('wolves2', 'wolf', 12, 36, 4, 2, 600);
  sp('wolf3', 'wolf', 46, 30, 4, 2, 600);
  // Derin orman: goblinler
  sp('gob1', 'goblin', 36, 14, 4, 2, 600);
  sp('gob2', 'goblin', 44, 6, 4, 2, 600);
  sp('gob3', 'goblin', 6, 26, 3, 1, 600);
  sp('camp_gob', 'goblin', 18, 12, 5, 3, 900);
  sp('camp_shaman', 'goblin_shaman', 20, 10, 3, 1, 900);
  sp('camp_chief', 'goblin_chief', 15, 13, 2, 1, 1440 * 3);

  // Toplama noktaları: şifalı ot
  let hid = 0;
  for (let i = 0; i < 400 && hid < 30; i++) {
    const x = 3 + Math.floor(rnd() * 52), y = 3 + Math.floor(rnd() * (H - 8));
    if (get(x, y) !== TERRAIN.forest || reserved[idx(x, y)]) continue;
    gathers.push({ id: 'herb' + hid, x, y, item: 'herb', kind: 'herb' });
    props.push({ key: 'herb_plant', x: x * TILE + 16, y: y * TILE + 28, sway: true });
    reserve(x - 1, y - 1, x + 1, y + 1);
    hid++;
  }

  // ============================================================ ağaçlar ve çalılar
  const occ = new Uint8Array(W * H);
  const canTree = (x: number, y: number, r: number) => {
    for (let yy = y - r; yy <= y + r; yy++)
      for (let xx = x - r; xx <= x + r; xx++) if (!inb(xx, yy) || occ[idx(xx, yy)] || reserved[idx(xx, yy)] || solid[idx(xx, yy)]) return false;
    return true;
  };
  const markTree = (x: number, y: number, r: number) => {
    for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) if (inb(xx, yy)) occ[idx(xx, yy)] = 1;
  };
  // Harita kenarı: sık orman
  const border = (x: number, y: number) => x < 3 || y < 2 || y > H - 4 || (x > W - 4 && x < 143);
  for (let i = 0; i < 26000; i++) {
    const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H);
    const t = get(x, y);
    if (t === TERRAIN.water || t === TERRAIN.dirt || t === TERRAIN.cobble || t === TERRAIN.farm || t === TERRAIN.sand) continue;
    if (x >= 143) continue;
    const forest = t === TERRAIN.forest || border(x, y);
    const villageArea = x > 62 && x < 142 && y > 16 && y < 104;
    if (villageArea && !border(x, y) && rnd() > 0.012) continue;
    if (!forest && rnd() > 0.06) continue;
    const big = forest && rnd() < 0.45;
    const r = big ? 2 : 1;
    if (!canTree(x, y, r)) continue;
    const key = forest ? TREE_KEYS_FOREST[Math.floor(rnd() * (big ? 6 : TREE_KEYS_FOREST.length))] : TREE_KEYS_LIGHT[Math.floor(rnd() * TREE_KEYS_LIGHT.length)];
    const info = PROP_INFO[key];
    props.push({ key, x: x * TILE + 16, y: y * TILE + 30, sway: true, flipX: rnd() < 0.5 });
    if (info.solid) solidRect(x + info.solid[0], y + info.solid[1], x + info.solid[2], y + info.solid[3]);
    markTree(x, y, r);
  }
  // çalılar, mantarlar, kayalar
  for (let i = 0; i < 9000; i++) {
    const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H);
    const t = get(x, y);
    if (t !== TERRAIN.forest && t !== TERRAIN.grass && t !== TERRAIN.flowers) continue;
    if (occ[idx(x, y)] || solid[idx(x, y)] || x >= 143) continue;
    if (reserved[idx(x, y)] && rnd() < 0.85) continue;
    const villageArea = x > 62 && x < 142 && y > 16 && y < 104;
    if (villageArea && rnd() < 0.85) continue;
    const roll = rnd();
    let key = BUSH_KEYS[Math.floor(rnd() * 5)];
    if (roll < 0.08) key = 'mushrooms';
    else if (roll < 0.12) key = 'rock_small';
    else if (roll < 0.14) key = 'amanita';
    else if (roll < 0.17 && t === TERRAIN.forest) key = 'stump';
    else if (roll < 0.19) key = 'rocks_tiny';
    else if (roll < 0.21 && t === TERRAIN.forest) key = 'boulder';
    else if (roll < 0.24 && t === TERRAIN.forest) key = 'bush_big';
    const info = PROP_INFO[key];
    props.push({ key, x: x * TILE + 16, y: y * TILE + 30, sway: !!info.sway, flipX: rnd() < 0.5, flat: info.flat });
    if (info.solid) solidRect(x + info.solid[0], y + info.solid[1], x + info.solid[2], y + info.solid[3]);
    occ[idx(x, y)] = 1;
  }
  // Su kenarı sazlar ve nilüferler
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      if (get(x, y) === TERRAIN.water && rnd() < 0.03 && !reserved[idx(x, y)]) props.push({ key: rnd() < 0.5 ? 'lily1' : 'lily2', x: x * TILE + 16, y: y * TILE + 26, flat: true });
      if (get(x, y) === TERRAIN.sand && rnd() < 0.08 && !occ[idx(x, y)]) props.push({ key: 'cattail', x: x * TILE + 16, y: y * TILE + 30, sway: true });
    }

  // ============================================================ çarpışma: su
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (terrain[idx(x, y)] === TERRAIN.water) solid[idx(x, y)] = 1;
  // Köprü: suyu geçilebilir yap
  for (let y = bridgeY0; y <= bridgeY1; y++) for (let x = bx0; x <= bx1; x++) solid[idx(x, y)] = 0;
  // Harita kenarı
  for (let x = 0; x < W; x++) { solid[idx(x, 0)] = 1; solid[idx(x, H - 1)] = 1; }
  for (let y = 0; y < H; y++) { solid[idx(0, y)] = 1; solid[idx(W - 1, y)] = 1; }

  // Hikâye tetikleyicileri
  triggers.push({ id: 'village_enter', x: 61, y: 52, w: 4, h: 12, once: true });
  triggers.push({ id: 'checkpoint_near', x: 136, y: 52, w: 5, h: 10 });
  triggers.push({ id: 'camp_near', x: 8, y: 2, w: 22, h: 20 });

  return {
    id: 'world', name: 'Elonth', w: W, h: H, indoor: false, terrain, solid, props, buildings, zones, spawns, warps, triggers, gathers,
    music: 'forest', points,
    bridge: { x0: bx0, x1: bx1, y0: bridgeY0, y1: bridgeY1 },
  } as MapData & { bridge: any };
}
