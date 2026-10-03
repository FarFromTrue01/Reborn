// Açık dünya haritası: başlangıç ormanı + Brindlewood köyü.
// Deterministik (tohumlu) üretim + elle yerleştirilmiş önemli yerler.
// 0.3.0: köy yaklaşık %60'ına sıkıştırıldı (bina sayısı aynı), şehir yolu kısaldı,
// çarpışma iki katmanlı: sert karolar (hard) + dekorların piksel kutuları (colliders).
import { TERRAIN, TILE, type MapData, type PropPlacement, type BuildingPlacement, type SpawnDef, type Zone, type Gather, type Warp, type Trigger, type DoorDef, type ColliderRect } from './types';
import { PROP_INFO, TREE_KEYS_FOREST, TREE_KEYS_LIGHT, BUSH_KEYS, ROADSIDE, propBox, rectTiles } from '../data/props';

export function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const WORLD_W = 169;
export const WORLD_H = 120;
/** Kontrol noktası bariyeri: bu x'ten doğusu kraliyet şehrine giden yol (geçilmez). */
export const BARRIER_X = 152;
/** Köyün batı sınırı (nehrin doğusu). */
export const VILLAGE_X0 = 62;
/** Ormanda ağaçlar arasına fazladan bir karo boşluk bırakılma olasılığı (0.3.0: ~%30 seyrek orman). */
const GAP_P = 0.3;

export interface BuildingMeta {
  w: number;
  h: number;
  wallTop: number;
  doors: { x: number; y: number }[];
  collide: { x: number; y: number; w: number; h: number };
}

/** Yol karoları (kasıtlı engeller hariç hiçbir şey bunları kapatmamalı; tests/collision.test.ts). */
export const ROAD_TERRAINS: number[] = [TERRAIN.dirt, TERRAIN.cobble];
/** Meydanlarda (kaldırım) kasıtlı duran dekorlar. */
export const PLAZA_DECOR = ['well', 'fountain', 'stall_orange', 'stall_blue', 'bench', 'cart', 'trough'];

export function buildWorld(bmeta: Record<string, BuildingMeta>): MapData {
  const W = WORLD_W, H = WORLD_H;
  const rnd = mulberry32(1337);
  const terrain = new Uint8Array(W * H).fill(TERRAIN.grass);
  const solid = new Uint8Array(W * H);
  const hard = new Uint8Array(W * H);
  const reserved = new Uint8Array(W * H); // ağaç konmayacak yerler
  const colliders: ColliderRect[] = [];
  const props: PropPlacement[] = [];
  const buildings: BuildingPlacement[] = [];
  const zones: Zone[] = [];
  const spawns: SpawnDef[] = [];
  const warps: Warp[] = [];
  const doors: DoorDef[] = [];
  const triggers: Trigger[] = [];
  const gathers: Gather[] = [];
  const points: Record<string, { x: number; y: number }> = {};

  const idx = (x: number, y: number) => y * W + x;
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const set = (x: number, y: number, t: number) => { if (inb(x, y)) terrain[idx(x, y)] = t; };
  const get = (x: number, y: number) => (inb(x, y) ? terrain[idx(x, y)] : TERRAIN.forest);
  const isRoad = (x: number, y: number) => ROAD_TERRAINS.includes(get(x, y));
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
  const ellipse = (t: number, cx: number, cy: number, rx: number, ry: number) => {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
      for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1.05) set(x, y, t);
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
  /** Sert engel (bina, bariyer, kenar): hem oyuncu hem yol bulma için. */
  const hardRect = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inb(x, y)) { solid[idx(x, y)] = 1; hard[idx(x, y)] = 1; }
  };
  /** Bir dekorun piksel kutusunu ekler; kapladığı karolar NPC yol bulmasında dolu sayılır. */
  const addBox = (key: string, p: PropPlacement) => {
    if (p.flat) return;
    const r = propBox(key, p.x, p.y, p.scale ?? 1);
    if (!r) return;
    colliders.push({ ...r, key });
    for (const [x, y] of rectTiles(r)) if (inb(x, y)) solid[idx(x, y)] = 1;
  };
  const prop = (key: string, tx: number, ty: number, extra: Partial<PropPlacement> = {}) => {
    const info = PROP_INFO[key] ?? { baseY: 0 };
    const p: PropPlacement = { key, x: tx * TILE + TILE / 2, y: ty * TILE + TILE - 2, sway: !!info.sway, flat: info.flat, ...extra };
    props.push(p);
    addBox(key, p);
    reserve(tx - 1, ty - 1, tx + 1, ty + 1);
    return p;
  };
  // Yol kenarı dekorları (fener, tabela, korkuluk): tüm yollar çizildikten sonra yerleştirilir;
  // yolun üstüne düşerse en yakın yol kenarı karosuna kaydırılır (A7).
  const roadside: [string, number, number, Partial<PropPlacement>][] = [];
  const side = (key: string, tx: number, ty: number, extra: Partial<PropPlacement> = {}) => roadside.push([key, tx, ty, extra]);
  // Çit hatları: patikanın geçtiği parçalar boş bırakılır.
  const fences: [number, number, number][] = [];
  const fenceLine = (x0: number, x1: number, y: number) => fences.push([x0, x1, y]);

  // ============================================================ büyük hatlar
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const edge = 54 + Math.round(Math.sin(y * 0.15) * 3 + Math.cos(y * 0.07) * 2);
      if (x < edge) set(x, y, TERRAIN.forest);
      // kuzey ve güney kenar ormanları
      if (y < 24 + Math.round(Math.sin(x * 0.2) * 2) && x > 60) set(x, y, TERRAIN.forest);
      if (y > H - 6 + Math.round(Math.sin(x * 0.3) * 2)) set(x, y, TERRAIN.forest);
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

  // Göletler (orman)
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
  path(TERRAIN.dirt, [[31, 28], [28, 22], [24, 18]], 0, 0.7);
  path(TERRAIN.dirt, [[40, 60], [41, 70], [40, 77]], 0, 0.5);
  // Ana yol: köprü → meydan → Doğu Mahallesi → kontrol noktası (0.2.0'a göre ~%40 kısa)
  path(TERRAIN.dirt, [[62, 58], [70, 57], [77, 57]], 1, 0.4);
  path(TERRAIN.dirt, [[91, 57], [100, 57], [112, 57], [124, 57], [136, 57], [BARRIER_X + 1, 57]], 1, 0.3);
  // Kuzey: meydan → tarlalar, Haldor, avcı kulübesi
  path(TERRAIN.dirt, [[85, 52], [85, 46], [86, 40], [87, 35]], 1, 0.3);
  path(TERRAIN.dirt, [[76, 35], [87, 35], [100, 35], [116, 35]], 0, 0.2);
  path(TERRAIN.dirt, [[87, 35], [87, 30]], 0, 0.1); // tarlaya giden patika (çitte açıklık)
  path(TERRAIN.dirt, [[85, 46], [98, 46], [110, 46], [124, 46], [133, 46], [133, 44]], 0, 0.2);
  path(TERRAIN.dirt, [[114, 35], [114, 36]], 0, 0); // avcı kulübesi kapısı
  path(TERRAIN.dirt, [[110, 45], [111, 45]], 0, 0); // ahır kapısı
  // Meydan çevresi kapı patikaları
  path(TERRAIN.dirt, [[76, 53], [78, 55]], 0, 0.1); // han
  path(TERRAIN.dirt, [[92, 54], [92, 56]], 0, 0.1); // lonca
  path(TERRAIN.dirt, [[104, 54], [104, 56]], 0, 0.1); // ev
  path(TERRAIN.dirt, [[111, 55], [111, 56]], 0, 0.1); // karakol
  // Güney: meydan → dükkân sokağı → güney çiftlikleri
  path(TERRAIN.dirt, [[85, 64], [85, 100]], 1, 0.3);
  path(TERRAIN.dirt, [[85, 72], [96, 72], [109, 72]], 0, 0.2); // dükkân ve şifacı sokağı
  path(TERRAIN.dirt, [[70, 67], [77, 67], [79, 65]], 0, 0.1); // demirci
  path(TERRAIN.dirt, [[85, 79], [74, 79], [64, 79]], 0, 0.2); // batı evleri
  path(TERRAIN.dirt, [[85, 88], [75, 89], [64, 91]], 1, 0.3); // değirmen
  path(TERRAIN.dirt, [[85, 83], [91, 83], [103, 83]], 0, 0.2); // güney evleri
  path(TERRAIN.dirt, [[105, 67], [105, 72]], 0, 0.1);
  // Güney çiftlik yolu
  path(TERRAIN.dirt, [[70, 100], [85, 100], [100, 100], [115, 100], [128, 100], [140, 100]], 1, 0.3);
  path(TERRAIN.dirt, [[73, 97], [73, 99]], 0, 0);
  // Doğu Mahallesi
  path(TERRAIN.dirt, [[128, 58], [128, 62]], 1, 0.1);
  path(TERRAIN.dirt, [[128, 70], [128, 100]], 1, 0.3);
  path(TERRAIN.dirt, [[120, 80], [136, 80]], 0, 0.1);
  path(TERRAIN.dirt, [[120, 89], [143, 89]], 0, 0.1);
  path(TERRAIN.dirt, [[143, 87], [143, 89]], 0, 0);
  path(TERRAIN.dirt, [[114, 69], [118, 69], [122, 67]], 0, 0.1); // fırın
  path(TERRAIN.dirt, [[140, 69], [135, 68]], 0, 0.1); // terzi
  path(TERRAIN.dirt, [[146, 71], [141, 69]], 0, 0.1); // köşe ev
  path(TERRAIN.dirt, [[119, 56], [119, 56]], 0, 0); // konak

  // Meydan: kaldırım
  ellipse(TERRAIN.cobble, 84, 58.5, 7.5, 6);
  reserve(75, 51, 93, 66);

  // Tarlalar
  const field = (x0: number, y0: number, x1: number, y1: number, crop: string) => {
    rect(TERRAIN.farm, x0, y0, x1, y1);
    reserve(x0 - 1, y0 - 1, x1 + 1, y1 + 1);
    for (let y = y0 + 1; y < y1; y += 2)
      for (let x = x0 + 1; x < x1; x += 2) if (rnd() < 0.8) props.push({ key: crop, x: x * TILE + 16, y: y * TILE + 28, sway: true });
  };
  field(76, 28, 85, 33, 'crop_cabbage');
  field(89, 28, 99, 33, 'crop_corn');
  // Haldor'un buğday tarlası
  rect(TERRAIN.farm, 117, 38, 128, 43);
  for (let y = 39; y <= 43; y += 2) for (let x = 119; x <= 128; x += 4) props.push({ key: 'wheat', x: x * TILE, y: y * TILE + 30, sway: true });
  reserve(116, 37, 129, 44);
  points.haldor_field = { x: 123, y: 45 };

  // ============================================================ binalar
  const place = (id: string, name: string, tx: number, tyBottom: number, enter: BuildingPlacement['enter'], extra: Partial<BuildingPlacement> = {}) => {
    const m = bmeta[id];
    if (!m) return;
    buildings.push({ id, name, tx, tyBottom, enter, ...extra });
    const px = tx * TILE, py = tyBottom * TILE - m.h;
    const c = m.collide;
    const x0 = Math.floor((px + c.x + 4) / TILE), x1 = Math.floor((px + c.x + c.w - 4) / TILE);
    const y0 = Math.floor((py + c.y + 8) / TILE), y1 = tyBottom - 1;
    hardRect(x0, y0, x1, y1);
    reserve(x0 - 1, y0 - 2, x1 + 1, y1 + 2);
    for (const d of m.doors) {
      const dx = Math.floor((px + d.x) / TILE);
      if (enter) warps.push({ x: dx, y: tyBottom, w: 1, h: 1, to: enter.map, tx: enter.x, ty: enter.y, facing: 'up', label: name, hours: extra.hours });
      else warps.push({ x: dx, y: tyBottom, w: 1, h: 1, to: '', tx: 0, ty: 0, facing: 'up', label: name, closedMsg: extra.locked ?? 'Kapı kilitli.' });
      doors.push({ x: dx, y: tyBottom, dir: 'up', sprite: 'building', warp: true, building: id, label: name });
      if (!points['door_' + id]) points['door_' + id] = { x: dx, y: tyBottom };
    }
  };

  // Batı Meydanı çevresi
  place('inn', 'Yorgun Yaban Domuzu Hanı', 72, 52, { map: 'inn', x: 7, y: 12 }, { sign: 'sign_inn' });
  place('guild', 'Maceracılar Loncası', 88, 53, { map: 'guild', x: 6, y: 11 }, { sign: 'sign_sword', hours: [7, 21] });
  place('smithy', 'Demirci', 68, 66, { map: 'smithy', x: 4, y: 9 }, { sign: 'sign_tools', hours: [8, 18] });
  place('shop', 'Genel Dükkân', 87, 71, { map: 'shop', x: 4, y: 8 }, { sign: 'sign_bag', hours: [8, 19] });
  place('healer', 'Şifacı', 95, 71, { map: 'healer', x: 4, y: 8 }, { sign: 'sign_potion', hours: [9, 17] });
  place('house_a', 'Ev', 64, 45, null, { locked: 'Kapı kilitli. İçeriden çocuk sesleri geliyor.' });
  place('house_b', 'Ev', 100, 53, null, { locked: 'Kapı kilitli.' });
  place('house_c', 'Ev', 73, 77, null, { locked: 'Kapı kilitli. Kapının arkasında bir köpek havlıyor.' });
  place('house_d', 'Ev', 88, 82, null, { locked: 'Kapı kilitli.' });
  place('house_e', 'Ev', 103, 66, null, { locked: 'Kapı kilitli. Ekmek kokusu geliyor.' });
  place('house_b', 'Ev', 99, 81, null, { locked: 'Kapı kilitli.' });
  place('house_a', 'Ev', 63, 77, null, { locked: 'Kapı kilitli.' });
  place('house_c', 'Ev', 77, 86, null, { locked: 'Kapı kilitli.' });
  place('barn', 'Ahır', 107, 44, null, { locked: 'Ahırın kapısı sürgülü. İçeriden inek sesi geliyor.' });
  place('mill', 'Değirmen', 62, 90, null, { locked: 'Değirmenci kapıyı içeriden kilitlemiş.' });
  place('guardhouse', 'Karakol', 109, 54, null, { locked: 'Karakolun kapısı muhafızlara ait.' });
  // Haldor'un çiftliği ve avcı kulübesi (kuzeydoğu)
  place('farmhouse', 'Haldor\'un Çiftlik Evi', 130, 43, { map: 'farmhouse', x: 5, y: 7 }, { sign: 'sign_wheat' });
  place('lodge', 'Avcı Kulübesi', 112, 34, { map: 'lodge', x: 4, y: 6 }, { sign: 'sign_bow', hours: [6, 21] });
  // Doğu Mahallesi
  place('manor', 'Tüccar Konağı', 115, 55, null, { locked: 'Kapıdaki hizmetkâr başını sallıyor: "Efendi Aurelio köksüz misafir kabul etmez."' });
  place('bakery', 'Fırın', 112, 68, { map: 'bakery', x: 4, y: 7 }, { sign: 'sign_bread', hours: [5, 18] });
  place('tailor', 'Terzi', 137, 68, { map: 'tailor', x: 5, y: 7 }, { sign: 'sign_scissors', hours: [9, 18] });
  place('house_a', 'Ev', 145, 70, null, { locked: 'Kapı kilitli. İçeride biri şarkı söylüyor.' });
  place('house_f', 'Muhtarın Evi', 117, 79, null, { locked: 'Muhtar Godric\'in evi. Kapı tokmağı bile cilalı.' });
  place('house_g', 'Ev', 134, 79, null, { locked: 'Kapı kilitli.' });
  place('house_h', 'Ev', 119, 88, null, { locked: 'Kapı kilitli. Bir bebek ağlıyor.' });
  place('house_e', 'Ev', 130, 88, null, { locked: 'Kapı kilitli. Pencerede kuruyan çamaşırlar.' });
  place('tannery', 'Tabakhane', 141, 86, { map: 'tannery', x: 4, y: 7 }, { sign: 'sign_hide', hours: [8, 18] });
  // Güney Çiftlikleri
  place('farmhouse2', 'Jonas\'ın Çiftliği', 88, 98, null, { locked: 'Kapı kilitli. İçeriden süt kokusu geliyor.' });
  place('stable', 'Ahır', 112, 98, null, { locked: 'Ahırın kapısı sürgülü. İçeride atlar kişniyor.' });
  place('barn', 'Samanlık', 132, 97, null, { locked: 'Samanlığın kapısı zincirli.' });
  place('house_c', 'Ev', 79, 98, null, { locked: 'Kapı kilitli.' });
  place('house_g', 'Ev', 72, 96, null, { locked: 'Kapı kilitli. Bir köpek hırlıyor.' });

  // ============================================================ köy dekorları
  // Batı Meydanı
  prop('well', 84, 59);
  points.well = { x: 84, y: 60 };
  points.plaza = { x: 84, y: 62 };
  prop('stall_orange', 80, 63);
  prop('stall_blue', 89, 63);
  prop('stall_orange', 88, 55, { flipX: true });
  prop('cart', 79, 55);
  prop('bench', 81, 64);
  prop('bench', 87, 64);
  prop('trough', 93, 60);
  prop('hay_pile', 75, 61);
  side('signpost', 91, 57);
  points.board = { x: 92, y: 55 };
  // fenerler (gece ışık)
  const LANTERN = { light: { radius: 120, color: 0xffc070, flicker: true, night: true } };
  for (const [x, y] of [[71, 55], [78, 53], [90, 52], [77, 64], [91, 64], [98, 55], [108, 59], [125, 59], [131, 59], [86, 44], [96, 70], [86, 36]] as [number, number][])
    side('lantern', x, y, LANTERN);
  // han çevresi
  prop('table_out', 74, 54);
  prop('stool', 72, 54);
  // demirci önü
  prop('anvil', 73, 69);
  prop('weapon_rack_out', 76, 69);
  prop('logpile', 66, 64);
  // ev bahçeleri
  prop('clothesline', 71, 42);
  prop('woodshed', 126, 52);
  prop('outhouse', 69, 75);
  prop('hay_roll', 104, 42);
  prop('hay_bales', 122, 36);
  prop('cart', 102, 39);
  prop('scarecrow', 80, 31);
  prop('scarecrow', 94, 31);
  prop('scarecrow', 70, 81);
  prop('trough', 128, 37);
  // çitler (patikaların geçtiği parçalar boş kalır)
  fenceLine(75, 100, 34);
  fenceLine(66, 78, 85);
  // meyve ağaçları (elma toplama)
  for (const [x, y, id] of [[90, 41, 'apple1'], [110, 64, 'apple2'], [64, 62, 'apple3']] as [number, number, string][]) {
    prop('tree_round', x, y, { tint: 0xffffff });
    gathers.push({ id, x, y: y + 1, item: 'apple', kind: 'apple' });
  }
  rect(TERRAIN.farm, 66, 81, 75, 84);
  for (let y = 82; y <= 84; y += 2) for (let x = 67; x < 75; x += 2) props.push({ key: 'crop_carrot', x: x * TILE + 16, y: y * TILE + 28, sway: true });
  reserve(65, 80, 76, 85);

  // ============================================================ Doğu Mahallesi
  ellipse(TERRAIN.cobble, 128, 66, 7, 5);
  reserve(118, 59, 138, 73);
  prop('fountain', 128, 66);
  points.fountain = { x: 128, y: 68 };
  points.east_plaza = { x: 128, y: 69 };
  prop('stall_orange', 123, 64);
  prop('stall_blue', 133, 64);
  prop('bench', 124, 70);
  prop('bench', 132, 70);
  prop('barrels', 110, 68);
  prop('clothesline', 144, 74);
  prop('cart', 135, 61);
  prop('trough', 149, 88);
  prop('hay_pile', 150, 82);
  prop('barrels', 139, 85);
  side('signpost', 126, 59);

  // ============================================================ Güney Çiftlikleri
  // Yaşlı Meşe: buluşma yeri
  prop('tree_huge', 103, 96);
  reserve(97, 90, 109, 99);
  prop('bench', 100, 97);
  prop('bench', 106, 97);
  points.oak = { x: 103, y: 98 };
  field(108, 103, 118, 108, 'crop_cabbage');
  field(120, 103, 128, 108, 'crop_corn');
  field(88, 103, 97, 107, 'crop_carrot');
  field(76, 103, 84, 107, 'crop_tomato');
  // mera
  fenceLine(132, 150, 102);
  fenceLine(132, 150, 113);
  prop('hay_roll', 135, 105);
  prop('hay_bales', 144, 106);
  prop('trough', 146, 111);
  prop('scarecrow', 113, 105);
  prop('scarecrow', 92, 105);
  points.pasture = { x: 140, y: 108 };
  reserve(131, 101, 151, 114);
  // Çamaşır göleti
  disc(TERRAIN.water, 68, 107, 3, 0.3);
  disc(TERRAIN.sand, 68, 107, 4.2, 0.3, (c) => c !== TERRAIN.water);
  reserve(62, 101, 74, 113);
  points.pond = { x: 68, y: 102 };
  // Oduncu
  prop('woodshed', 100, 111);
  prop('logpile', 104, 112);
  prop('chop_block', 106, 112);
  points.woodcut = { x: 103, y: 110 };
  // Meyve ağaçları
  for (const [x, y, id] of [[122, 94, 'apple4'], [148, 75, 'apple5']] as [number, number, string][]) {
    prop('tree_round', x, y);
    gathers.push({ id, x, y: y + 1, item: 'apple', kind: 'apple' });
  }
  // Fenerler
  for (const [x, y] of [[121, 72], [135, 72], [126, 82], [130, 99], [100, 101], [115, 101], [113, 36], [127, 45], [143, 55]] as [number, number][])
    side('lantern', x, y, LANTERN);

  // Antrenman alanı (meydanın batısı, nehre yakın)
  points.training = { x: 67, y: 50 };
  prop('chop_block', 64, 52, { interact: 'train_chop' });
  prop('firewood', 63, 50);
  prop('boulder2', 67, 54, { interact: 'train_lift' });
  prop('target_straw', 69, 51);
  prop('target', 71, 51, { interact: 'archery_target' });
  prop('signpost2', 66, 48, { interact: 'train_run' });
  for (const [x, y] of [[63, 47], [71, 47], [71, 54], [63, 55]] as [number, number][]) prop('weapon_rack_out', x, y);
  reserve(62, 46, 72, 55);
  zones.push({ id: 'training', x: 62, y: 46, w: 11, h: 10, name: 'Antrenman Alanı', safe: true });

  // Köprü (nehir üstünde ahşap) — terrain'de su kalır, üstüne zemin karosu ve engel kalkar
  const bridgeY0 = 57, bridgeY1 = 59;
  const bx0 = Math.floor(riverX(58) - 2.2), bx1 = Math.ceil(riverX(58) + 2.2);
  points.bridge = { x: Math.round(riverX(58)), y: 58 };

  // Kontrol noktası (köyün doğu ucu)
  const CX = BARRIER_X - 3;
  prop('fence_h', CX + 1, 54);
  prop('fence_h', CX + 1, 60);
  side('lantern', CX - 1, 55, { light: { radius: 140, color: 0xffc070, flicker: true, night: true } });
  side('lantern', CX - 1, 59, { light: { radius: 140, color: 0xffc070, flicker: true, night: true } });
  points.checkpoint = { x: CX, y: 57 };
  points.door_checkpoint = { x: CX - 2, y: 57 };
  // Bariyer: BARRIER_X boyunca geçilmez (kasıtlı engel)
  hardRect(BARRIER_X, 0, W - 1, H - 1);
  zones.push({ id: 'checkpoint', x: CX - 8, y: 50, w: 12, h: 14, name: 'Şehir Yolu Kontrol Noktası', safe: true, music: 'village' });
  // Uzaktaki şehir (görsel, yarı saydam, mavimsi)
  props.push({ key: 'fence_h', x: (BARRIER_X + 1) * TILE + 16, y: 57 * TILE + 30 });
  props.push({ key: '__city', x: (BARRIER_X + 3.5) * TILE, y: 51 * TILE, flat: false, alpha: 0.8, scale: 0.35, tint: 0xb8c8e8, depthOffset: -4000 });
  points.city = { x: BARRIER_X + 3, y: 50 };
  points.city_gate = { x: BARRIER_X - 1, y: 57 };

  // Goblin kampı
  points.goblin_camp = { x: 18, y: 13 };
  prop('tent_big', 14, 10);
  prop('tent_small', 23, 9);
  prop('tent_small', 12, 17, { flipX: true });
  const fire: PropPlacement = { key: 'campfire_0', x: 18 * TILE + 16, y: 14 * TILE + 26, anim: ['campfire_0', 'campfire_1', 'campfire_2', 'campfire_3', 'campfire_4'], light: { radius: 170, color: 0xff9a40, flicker: true } };
  props.push(fire);
  addBox('campfire_0', fire);
  prop('cauldron', 20, 15);
  prop('barrels', 22, 16);
  prop('logpile', 16, 16);
  prop('weapon_rack_out', 24, 13);
  for (const [x, y] of [[9, 8], [27, 8], [8, 18], [28, 18], [17, 4]] as [number, number][]) prop('grave', x, y); // kemik/işaret direkleri
  zones.push({ id: 'goblin_camp', x: 8, y: 4, w: 21, h: 16, name: 'Goblin Kampı', danger: 3 });

  // Uyanış yeri
  points.wake = { x: 24, y: 64 };
  points.forest_edge = { x: 50, y: 62 };
  prop('stump_big', 21, 62);
  prop('mushrooms', 26, 61);
  prop('rocks_tiny', 22, 66);

  // NPC programları için adlandırılmış noktalar (data/schedules.ts)
  const P = (name: string, x: number, y: number) => (points[name] = { x, y });
  P('plaza_w', 79, 59); P('plaza_e', 90, 59); P('plaza_n', 83, 54); P('plaza_s', 85, 65);
  P('bench_w1', 81, 65); P('bench_w2', 87, 65); P('inn_front', 78, 54); P('guild_front', 93, 55);
  P('road_w', 68, 58); P('road_mid', 100, 58); P('road_e', 138, 58); P('guardpost', 113, 57); P('riverbank', 64, 60);
  P('field_cabbage', 83, 30); P('field_corn', 91, 30); P('barn_yard', 104, 45); P('lodge_yard', 114, 36); P('north_lane', 100, 36);
  P('smithy_yard', 74, 67); P('shop_lane', 92, 73); P('healer_garden', 101, 73); P('field_carrot', 70, 83); P('west_houses', 70, 79);
  P('south_houses', 95, 84); P('mill_yard', 67, 91); P('beggar_spot', 94, 61);
  P('ep_w', 122, 67); P('ep_e', 134, 67); P('ep_s', 128, 71); P('manor_front', 119, 57); P('bakery_front', 114, 70);
  P('tailor_front', 140, 70); P('carpentry', 133, 62); P('headman_house', 119, 80); P('tannery_yard', 146, 89); P('east_lane', 136, 90); P('wash_line', 143, 75);
  P('oak_w', 99, 99); P('oak_e', 107, 99); P('farm_yard', 92, 100); P('south_road', 110, 101); P('stable_yard', 116, 100);
  P('field_s1', 110, 104); P('field_s2', 124, 105); P('field_s3', 94, 104); P('field_s4', 80, 105); P('pasture_n', 138, 104);

  // ============================================================ bölgeler
  zones.push({ id: 'village', x: VILLAGE_X0, y: 26, w: BARRIER_X - VILLAGE_X0, h: 90, name: 'Brindlewood', safe: true, music: 'village' });
  zones.push({ id: 'east_quarter', x: 110, y: 59, w: BARRIER_X - 110, h: 32, name: 'Doğu Mahallesi', safe: true, music: 'village' });
  zones.push({ id: 'south_farms', x: VILLAGE_X0, y: 91, w: BARRIER_X - VILLAGE_X0, h: 25, name: 'Güney Çiftlikleri', safe: true, music: 'village' });
  zones.push({ id: 'haldor_farm', x: 115, y: 33, w: 24, h: 13, name: 'Haldor\'un Çiftliği', safe: true, music: 'village' });
  zones.push({ id: 'forest_deep', x: 0, y: 0, w: 54, h: 22, name: 'Ormanın Derinlikleri', danger: 2, music: 'forest' });
  zones.push({ id: 'forest_mid', x: 0, y: 22, w: 56, h: 24, name: 'Orman (Orta)', danger: 1, music: 'forest' });
  zones.push({ id: 'forest_outer', x: 0, y: 46, w: 56, h: H - 46, name: 'Ormanın Kenarı', danger: 0, music: 'forest' });
  zones.push({ id: 'north_woods', x: VILLAGE_X0, y: 0, w: BARRIER_X - VILLAGE_X0, h: 26, name: 'Kuzey Korusu', music: 'forest' });

  // ============================================================ canavarlar
  const sp = (id: string, monster: string, x: number, y: number, radius: number, count: number, respawn = 360) =>
    spawns.push({ id, monster, x, y, radius, count, respawn });
  // Dış orman
  sp('rat1', 'rat', 34, 66, 4, 2);
  sp('rat2', 'rat', 44, 70, 4, 2);
  sp('rat3', 'rat', 30, 88, 5, 3);
  sp('rat4', 'rat', 50, 92, 4, 2);
  sp('rat5', 'rat', 65, 94, 3, 2); // değirmenin arkası
  sp('slime1', 'slime', 40, 76, 3, 2);
  sp('slime2', 'slime', 14, 90, 3, 2);
  sp('slime3', 'slime', 22, 78, 3, 1);
  sp('slime4', 'slime', 46, 100, 3, 2);
  sp('rabbit1', 'rabbit', 18, 58, 5, 2, 240);
  sp('rabbit2', 'rabbit', 36, 96, 5, 2, 240);
  sp('rabbit3', 'rabbit', 92, 14, 8, 3, 240);
  sp('rabbit4', 'rabbit', 46, 48, 4, 1, 240);
  sp('rabbit5', 'rabbit', 116, 112, 6, 2, 240); // güney tarlalarının kenarı
  sp('rabbit6', 'rabbit', 132, 12, 8, 2, 240);
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

  // ============================================================ yol kenarı dekorları ve çitler
  const roadTile = (x: number, y: number) => isRoad(x, y);
  const boxHitsRoad = (key: string, tx: number, ty: number) => {
    const r = propBox(key, tx * TILE + TILE / 2, ty * TILE + TILE - 2);
    if (!r) return roadTile(tx, ty);
    return rectTiles(r).some(([x, y]) => roadTile(x, y));
  };
  for (const [key, tx, ty, extra] of roadside) {
    let px = tx, py = ty;
    if (boxHitsRoad(key, tx, ty) || solid[idx(tx, ty)]) {
      // en yakın: yol olmayan, boş ve bir yol karosuna komşu kare
      let best: [number, number] | null = null;
      let bd = 1e9;
      for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++) {
          const x = tx + dx, y = ty + dy;
          if (!inb(x, y) || solid[idx(x, y)] || boxHitsRoad(key, x, y) || get(x, y) === TERRAIN.water) continue;
          let nearRoad = false;
          for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (roadTile(x + ox, y + oy)) nearRoad = true;
          if (!nearRoad) continue;
          const d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = [x, y]; }
        }
      if (!best) continue; // yer yoksa koyma
      [px, py] = best;
    }
    prop(key, px, py, extra);
  }
  for (const [x0, x1, y] of fences) {
    for (let x = x0 + 2; x <= x1 - 1; x += 4) {
      const r = propBox('fence_h', x * TILE + TILE / 2, y * TILE + TILE - 2)!;
      const blocked = rectTiles(r).some(([tx, ty]) => roadTile(tx, ty) || solid[idx(tx, ty)]);
      if (!blocked) prop('fence_h', x, y);
    }
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
  const isPath = (x: number, y: number) => {
    const t = get(x, y);
    return t === TERRAIN.water || t === TERRAIN.dirt || t === TERRAIN.cobble || t === TERRAIN.farm || t === TERRAIN.sand;
  };
  // Harita kenarı: sık orman
  const border = (x: number, y: number) => x < 3 || y < 2 || y > H - 4;
  for (let i = 0; i < 40000; i++) {
    const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H);
    if (isPath(x, y)) continue;
    if (x >= BARRIER_X) continue;
    const t = get(x, y);
    const forest = t === TERRAIN.forest || border(x, y);
    const villageArea = x > VILLAGE_X0 && x < BARRIER_X - 4 && y > 26 && y < H - 6;
    if (villageArea && !border(x, y) && rnd() > 0.02) continue;
    if (!forest && rnd() > 0.06) continue;
    const big = forest && rnd() < 0.45;
    // 0.3.0: ağaçlar arası en az bir karo boşluk (r+1), orman ~%30 seyrek
    const r = big ? 2 : 1;
    const gap = forest && !border(x, y) && rnd() < GAP_P ? 1 : 0;
    if (!canTree(x, y, r + gap)) continue;
    const key = forest ? TREE_KEYS_FOREST[Math.floor(rnd() * (big ? 6 : TREE_KEYS_FOREST.length))] : TREE_KEYS_LIGHT[Math.floor(rnd() * TREE_KEYS_LIGHT.length)];
    const p: PropPlacement = { key, x: x * TILE + 16, y: y * TILE + 30, sway: true, flipX: rnd() < 0.5 };
    props.push(p);
    addBox(key, p);
    markTree(x, y, r);
  }
  // çalılar, mantarlar, kayalar
  for (let i = 0; i < 14000; i++) {
    const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H);
    const t = get(x, y);
    if (t !== TERRAIN.forest && t !== TERRAIN.grass && t !== TERRAIN.flowers) continue;
    if (occ[idx(x, y)] || solid[idx(x, y)] || x >= BARRIER_X) continue;
    if (reserved[idx(x, y)] && rnd() < 0.85) continue;
    const villageArea = x > VILLAGE_X0 && x < BARRIER_X - 4 && y > 26 && y < H - 6;
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
    // köyde ve yol kenarında engel olabilecek büyük şeyler olmasın
    const info = PROP_INFO[key];
    if (info.box && (reserved[idx(x, y)] || villageArea)) continue;
    const p: PropPlacement = { key, x: x * TILE + 16, y: y * TILE + 30, sway: !!info.sway, flipX: rnd() < 0.5, flat: info.flat };
    props.push(p);
    addBox(key, p);
    occ[idx(x, y)] = 1;
  }
  // Su kenarı sazlar ve nilüferler
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      if (get(x, y) === TERRAIN.water && rnd() < 0.03 && !reserved[idx(x, y)]) props.push({ key: rnd() < 0.5 ? 'lily1' : 'lily2', x: x * TILE + 16, y: y * TILE + 26, flat: true });
      if (get(x, y) === TERRAIN.sand && rnd() < 0.08 && !occ[idx(x, y)]) props.push({ key: 'cattail', x: x * TILE + 16, y: y * TILE + 30, sway: true });
    }

  // ============================================================ çarpışma: su
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (terrain[idx(x, y)] === TERRAIN.water) { solid[idx(x, y)] = 1; hard[idx(x, y)] = 1; }
  // Köprü: suyu geçilebilir yap
  for (let y = bridgeY0; y <= bridgeY1; y++) for (let x = bx0; x <= bx1; x++) { solid[idx(x, y)] = 0; hard[idx(x, y)] = 0; }
  // Harita kenarı
  for (let x = 0; x < W; x++) { hardRect(x, 0, x, 0); hardRect(x, H - 1, x, H - 1); }
  for (let y = 0; y < H; y++) { hardRect(0, y, 0, y); hardRect(W - 1, y, W - 1, y); }

  // Hikâye tetikleyicileri
  triggers.push({ id: 'village_enter', x: 61, y: 52, w: 4, h: 12, once: true });
  triggers.push({ id: 'checkpoint_near', x: BARRIER_X - 7, y: 52, w: 5, h: 10 });
  triggers.push({ id: 'camp_near', x: 8, y: 2, w: 22, h: 20 });
  triggers.push({ id: 'forest_edge', x: 46, y: 56, w: 8, h: 10 });

  return {
    id: 'world', name: 'Elonth', w: W, h: H, indoor: false, terrain, solid, hard, colliders, props, buildings, zones, spawns, warps, doors, triggers, gathers,
    music: 'forest', points,
    bridge: { x0: bx0, x1: bx1, y0: bridgeY0, y1: bridgeY1 },
  } as MapData & { bridge: any };
}

/** İç mekân çıkışlarını dünya haritasındaki bina kapılarına bağlar (kapının bir altı). */
export function linkInteriors(world: MapData, interiors: Record<string, MapData>) {
  for (const b of world.buildings) {
    if (!b.enter) continue;
    const room = interiors[b.enter.map];
    const door = world.points['door_' + b.id];
    if (!room || !door) continue;
    for (const w of room.warps) if (w.to === 'world') { w.tx = door.x; w.ty = door.y + 1; }
  }
}
