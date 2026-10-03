import Phaser from 'phaser';
import { LAYER_ORDER, TERRAIN, TILE, type MapData, type PropPlacement, type DoorDef } from './types';
import { PROP_INFO } from '../data/props';
import type { BuildingMeta } from './worldgen';
import { Occluders } from './occlusion';

export interface LightSource {
  x: number;
  y: number;
  radius: number;
  color: number;
  flicker?: boolean;
  night?: boolean;
  phase: number;
  obj?: Phaser.GameObjects.GameObject;
}

export interface RenderedMap {
  map: Phaser.Tilemaps.Tilemap;
  collide: Phaser.Tilemaps.TilemapLayer;
  layers: Phaser.Tilemaps.TilemapLayer[];
  swayers: { img: Phaser.GameObjects.Image; amp: number; phase: number }[];
  animProps: { img: Phaser.GameObjects.Image; frames: string[]; t: number }[];
  lights: LightSource[];
  objects: Phaser.GameObjects.GameObject[];
  propImages: { img: Phaser.GameObjects.Image; p: PropPlacement }[];
  sails?: Phaser.GameObjects.Image;
  /** Arkasında kalanları gizleyebilecek büyük görseller (ağaç tepeleri, çatılar). */
  occluders: Occluders;
}

function hash(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Kapı ve geçiş görselleri (iç mekân çıkışları ve yan duvardaki kapılar). */
function drawDoor(scene: Phaser.Scene, m: MapData, d: DoorDef, objects: Phaser.GameObjects.GameObject[], lights: LightSource[]) {
  const T = TILE;
  if (d.sprite === 'exit') {
    // alt duvarda açıklık: kasa dikmeleri, eşik ve paspas
    const x = d.x * T, y = (m.h - 1) * T;
    const g = scene.add.graphics().setDepth(-88000);
    g.fillStyle(0x24160b, 1);
    g.fillRect(x, m.h * T - 10, T, 10);
    g.fillStyle(0x8a6038, 1);
    g.fillRect(x + 2, m.h * T - 9, T - 4, 3);
    // kasa dikmeleri
    for (const px of [x - 4, x + T - 4]) {
      g.fillStyle(0x3a2412, 1);
      g.fillRect(px, y - 18, 8, 28);
      g.fillStyle(0x7a5230, 1);
      g.fillRect(px + 1, y - 18, 3, 28);
    }
    // paspas
    g.fillStyle(0x6e2a1e, 0.95);
    g.fillRoundedRect(x + 3, y - 20, T - 6, 16, 3);
    g.lineStyle(1, 0xc89a5a, 0.7);
    g.strokeRoundedRect(x + 5, y - 18, T - 10, 12, 2);
    objects.push(g);
    const arrow = scene.add.triangle(x + T / 2, m.h * T - 4, 0, 0, 12, 0, 6, 7, 0xffd27a, 0.85).setDepth(-87000);
    scene.tweens.add({ targets: arrow, alpha: 0.25, y: arrow.y + 2, yoyo: true, repeat: -1, duration: 700 });
    objects.push(arrow);
    lights.push({ x: x + T / 2, y: y - 8, radius: 60, color: 0xffc070, phase: 0 });
  } else if (d.sprite === 'side') {
    // dikey duvarda kapı: kasa, lento gölgesi, eşik tahtaları, aralık kanat ve yön işareti
    const h = d.h ?? 1;
    const cx = d.x * T + T / 2, y0 = d.y * T, y1 = (d.y + h) * T;
    const floor = scene.add.graphics().setDepth(-88500);
    floor.fillStyle(0x6b4426, 1);
    floor.fillRect(cx - 14, y0, 28, y1 - y0);
    floor.fillStyle(0x4a2e18, 1);
    for (let yy = y0 + 5; yy < y1; yy += 7) floor.fillRect(cx - 14, yy, 28, 1);
    floor.fillStyle(0xffe0a0, 0.12);
    floor.fillRect(cx - 14, y0, 28, y1 - y0);
    objects.push(floor);
    // açık kanat (duvara yaslı, mutfak tarafına açılmış)
    const leaf = scene.add.graphics().setDepth(y0 + 2);
    leaf.fillStyle(0x5a3820, 1);
    leaf.fillRect(cx + 6, y0 - 30, 8, 34);
    leaf.fillStyle(0x8a5a32, 1);
    leaf.fillRect(cx + 7, y0 - 30, 3, 34);
    leaf.fillStyle(0xd9b45a, 1);
    leaf.fillRect(cx + 11, y0 - 14, 2, 3);
    objects.push(leaf);
    // kasa dikmeleri (üst ve alt uç) ve lento
    for (const [py, dep] of [[y0, y0 + 1], [y1, y1 + 1]] as [number, number][]) {
      const post = scene.add.graphics().setDepth(dep);
      post.fillStyle(0x2a180c, 1);
      post.fillRect(cx - 9, py - 40, 18, 44);
      post.fillStyle(0x7a5230, 1);
      post.fillRect(cx - 7, py - 40, 4, 44);
      post.fillStyle(0x140a04, 0.5);
      post.fillRect(cx - 9, py + 2, 18, 4);
      objects.push(post);
    }
    // iki yönlü ok
    const ar = scene.add.graphics().setDepth(-87500);
    const my = (y0 + y1) / 2;
    ar.fillStyle(0xffd27a, 0.9);
    ar.fillTriangle(cx + 6, my - 5, cx + 12, my, cx + 6, my + 5);
    ar.fillTriangle(cx - 6, my - 5, cx - 12, my, cx - 6, my + 5);
    scene.tweens.add({ targets: ar, alpha: 0.3, yoyo: true, repeat: -1, duration: 800 });
    objects.push(ar);
    lights.push({ x: cx, y: my, radius: 70, color: 0xffc070, flicker: true, phase: Math.random() * 6 });
  }
}

export function renderMap(scene: Phaser.Scene, m: MapData, meta: any, bmeta: Record<string, BuildingMeta>): RenderedMap {
  const tm = scene.make.tilemap({ tileWidth: TILE, tileHeight: TILE, width: m.w, height: m.h });
  const ts = tm.addTilesetImage('terrain', 'terrain', TILE, TILE, 0, 0)!;
  const layers: Phaser.Tilemaps.TilemapLayer[] = [];
  const objects: Phaser.GameObjects.GameObject[] = [];
  const swayers: RenderedMap['swayers'] = [];
  const animProps: RenderedMap['animProps'] = [];
  const lights: LightSource[] = [];
  const propImages: RenderedMap['propImages'] = [];
  const occluders = new Occluders();
  const COLS = meta.cols as number;
  const T = meta.terrains;
  const W = m.w, H = m.h;
  const tAt = (x: number, y: number) => m.terrain[Math.max(0, Math.min(H - 1, y)) * W + Math.max(0, Math.min(W - 1, x))];

  if (!m.indoor) {
    // Taban: çimen (çiçekli varyantlarla)
    const base = tm.createBlankLayer('base', ts, 0, 0)!;
    const gb = T.grass.base, fb = T.grass_flowers.base;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const r = hash(x, y);
        const t = tAt(x, y);
        let idx = gb + 16 + Math.floor(r * 3);
        if (t === TERRAIN.flowers || (t === TERRAIN.grass && r > 0.94)) idx = fb + 16 + Math.floor(hash(y, x) * 3);
        base.putTileAt(idx, x, y, false);
      }
    base.setDepth(-100000);
    layers.push(base);
    // Köşe tabanlı otomatik karolama
    const pri: Record<number, number> = {};
    LAYER_ORDER.forEach((l, i) => (pri[l.id] = i + 1));
    const vW = W + 1;
    const vert = new Uint8Array((W + 1) * (H + 1));
    for (let vy = 0; vy <= H; vy++)
      for (let vx = 0; vx <= W; vx++) {
        let best = 0;
        for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
          const p = pri[tAt(vx + dx, vy + dy)] ?? 0;
          if (p > best) best = p;
        }
        vert[vy * vW + vx] = best;
      }
    LAYER_ORDER.forEach((l, i) => {
      const P = i + 1;
      const info = T[l.name];
      if (!info) return;
      const layer = tm.createBlankLayer('t_' + l.name, ts, 0, 0)!;
      let any = false;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const tl = vert[y * vW + x] >= P ? 1 : 0;
          const tr = vert[y * vW + x + 1] >= P ? 2 : 0;
          const bl = vert[(y + 1) * vW + x] >= P ? 4 : 0;
          const br = vert[(y + 1) * vW + x + 1] >= P ? 8 : 0;
          const c = tl | tr | bl | br;
          if (c === 0) continue;
          // Bu türün kendi karosu mu, yoksa üst bir türün altı mı? Tamamen üst türle kaplıysa çizme.
          if (c === 15) {
            const own = tAt(x, y);
            const ownP = pri[own] ?? 0;
            if (ownP > P + 0 && ownP !== P) {
              // üstteki tür zaten tam kaplıyor mu?
              let allHigher = true;
              for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (vert[(y + dy) * vW + x + dx] <= P) allHigher = false;
              if (allHigher) continue;
            }
            layer.putTileAt(info.base + 16 + Math.floor(hash(x + P, y) * 3), x, y, false);
          } else layer.putTileAt(info.base + c, x, y, false);
          any = true;
        }
      layer.setDepth(-99000 + i);
      if (!any) layer.destroy();
      else layers.push(layer);
    });
    // Köprü
    const br = (m as any).bridge;
    if (br) {
      const bl = tm.createBlankLayer('bridge', ts, 0, 0)!;
      for (let y = br.y0; y <= br.y1; y++) for (let x = br.x0; x <= br.x1; x++) bl.putTileAt(meta.floors.floor_wood, x, y, false);
      bl.setDepth(-98000);
      layers.push(bl);
      // korkuluklar
      const g = scene.add.graphics().setDepth(-97000);
      const x0 = br.x0 * TILE, x1 = (br.x1 + 1) * TILE;
      for (const yy of [br.y0 * TILE - 2, (br.y1 + 1) * TILE - 4]) {
        g.fillStyle(0x2a1a0c, 1);
        g.fillRect(x0, yy, x1 - x0, 6);
        g.fillStyle(0x7a5230, 1);
        g.fillRect(x0, yy, x1 - x0, 3);
        for (let x = x0; x <= x1; x += 32) {
          g.fillStyle(0x3a2412, 1);
          g.fillRect(x - 2, yy - 6, 6, 12);
          g.fillStyle(0x8a6038, 1);
          g.fillRect(x - 1, yy - 6, 3, 3);
        }
      }
      g.fillStyle(0x000000, 0.18);
      g.fillRect(x0, (br.y1 + 1) * TILE + 2, x1 - x0, 5);
      objects.push(g);
    }
  } else {
    const fl = tm.createBlankLayer('floor', ts, 0, 0)!;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) fl.putTileAt(m.floorTiles![y * W + x], x, y, false);
    fl.setDepth(-100000);
    layers.push(fl);
  }

  // Çarpışma katmanı (görünmez)
  const collide = tm.createBlankLayer('collide', ts, 0, 0)!;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m.solid[y * W + x]) collide.putTileAt(0, x, y, false);
  collide.setCollision(0);
  collide.setVisible(false);


  // İç mekân duvarları
  if (m.indoor) {
    for (const w of m.wallTiles ?? []) {
      if (w.style === 'beam') {
        const g = scene.add.rectangle(w.x * TILE + 16, w.y * TILE + (w.h * TILE) / 2, 12, w.h * TILE, 0x3a2414).setDepth((w.y + w.h) * TILE - 1);
        const hl = scene.add.rectangle(w.x * TILE + 12, w.y * TILE + (w.h * TILE) / 2, 2, w.h * TILE, 0x6b4426).setDepth((w.y + w.h) * TILE - 1);
        objects.push(g, hl);
      } else {
        const ts2 = scene.add.tileSprite(0, 0, W * TILE, w.h * TILE, w.style).setOrigin(0, 0).setDepth(-90000);
        objects.push(ts2);
      }
    }
    // kenar gölgeleri ve çerçeve
    const g = scene.add.graphics().setDepth(-89000);
    g.fillStyle(0x140b06, 1);
    g.fillRect(0, 0, 10, H * TILE);
    g.fillRect(W * TILE - 10, 0, 10, H * TILE);
    g.fillRect(0, H * TILE - 10, W * TILE, 10);
    g.fillStyle(0x000000, 0.25);
    g.fillRect(0, 2 * TILE, W * TILE, 10);
    objects.push(g);
    for (const d of m.doors) drawDoor(scene, m, d, objects, lights);
  }

  // Binalar
  for (const b of m.buildings) {
    const bm = bmeta[b.id];
    if (!bm) continue;
    const px = b.tx * TILE, py = b.tyBottom * TILE - bm.h;
    const img = scene.add.image(px, py, 'b_' + b.id).setOrigin(0, 0).setDepth(b.tyBottom * TILE - 4);
    objects.push(img);
    occluders.add(img, b.tyBottom * TILE - 4, 0.02, 0.02);
    // kapı önü basamak gölgesi
    for (const d of bm.doors) {
      const st = scene.add.rectangle(px + d.x, b.tyBottom * TILE + 2, 30, 5, 0x2a2018, 0.55).setDepth(-50000);
      objects.push(st);
      // kapı ışığı (gece)
      if (b.enter) lights.push({ x: px + d.x, y: b.tyBottom * TILE - 30, radius: 70, color: 0xffb060, flicker: true, night: true, phase: Math.random() * 10 });
    }
    if (b.sign) {
      const d = bm.doors[0];
      const s = scene.add.image(px + d.x + 30, b.tyBottom * TILE - 70, 'props', b.sign).setOrigin(0.5, 0).setDepth(b.tyBottom * TILE - 3);
      objects.push(s);
    }
    // pencereler gece yanar
    if (b.enter || b.id.startsWith('house')) {
      lights.push({ x: px + bm.w / 2, y: b.tyBottom * TILE - 50, radius: 90, color: 0xffa850, night: true, phase: Math.random() * 10 });
    }
  }
  let sails: Phaser.GameObjects.Image | undefined;
  const mill = m.buildings.find((b) => b.id === 'mill');
  if (mill) {
    const bm = bmeta.mill;
    sails = scene.add.image(mill.tx * TILE + bm.w / 2, mill.tyBottom * TILE - bm.h + bm.wallTop + 36, 'mill_sails').setDepth(mill.tyBottom * TILE - 2);
    objects.push(sails);
  }

  // Dekorlar
  const atlas = scene.textures.get('props');
  for (const p of m.props) {
    let img: Phaser.GameObjects.Image;
    if (p.key.startsWith('__')) {
      const tex = p.key === '__city' ? 'city_wall' : p.key.slice(2);
      img = scene.add.image(p.x, p.y, tex);
      img.setOrigin(0.5, 1);
    } else {
      if (!atlas.has(p.key)) continue;
      img = scene.add.image(p.x, p.y, 'props', p.key);
      const info = PROP_INFO[p.key] ?? { baseY: 0 };
      const fr = atlas.get(p.key);
      img.setOrigin(0.5, 1 - info.baseY / fr.height);
    }
    if (p.scale) img.setScale(p.scale);
    if (p.flipX) img.setFlipX(true);
    if (p.alpha !== undefined) img.setAlpha(p.alpha);
    if (p.tint !== undefined) img.setTint(p.tint);
    const depth = p.flat ? -50000 + p.y * 0.001 : p.y + (p.depthOffset ?? 0);
    img.setDepth(depth);
    objects.push(img);
    propImages.push({ img, p });
    const info = PROP_INFO[p.key];
    // Büyük ağaç ve çalılar: arkasındakileri saklayabilir
    if (!p.flat && !p.key.startsWith('__') && (p.depthOffset ?? 0) >= 0 && img.displayHeight >= 56 && /^(tree_|bush_big|woodshed|tent_|wagon|stall_|well|outhouse|wheat)/.test(p.key)) occluders.add(img, depth);
    if (p.sway && info?.sway) swayers.push({ img, amp: info.sway, phase: hash(Math.floor(p.x), Math.floor(p.y)) * 6.28 });
    if (p.anim) animProps.push({ img, frames: p.anim, t: Math.random() });
    if (p.light) lights.push({ x: p.x, y: p.y - (img.displayHeight * 0.6), radius: p.light.radius, color: p.light.color, flicker: p.light.flicker, night: p.light.night, phase: Math.random() * 10, obj: img });
  }

  return { map: tm, collide, layers, swayers, animProps, lights, objects, propImages, sails, occluders };
}
