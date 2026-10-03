// A5/A6/A7: dekorların çarpışma kutuları görünen tabanlarına oturur, küçük eşyaların üstünden geçilir,
// yürünebilir yollar (kasıtlı engeller hariç) hiçbir şeyle kapanmaz, ağaçlar yalnızca gövdeleriyle engel olur.
import { describe, it, expect } from 'vitest';
import { buildMaps } from '../src/world/maps';
import { PROP_INFO, WALK_OVER, propBox } from '../src/data/props';
import { BARRIER_X, ROAD_TERRAINS, PLAZA_DECOR, type BuildingMeta } from '../src/world/worldgen';
import { TERRAIN, TILE, type MapData } from '../src/world/types';
import buildingsJson from '../assets/gfx/buildings/buildings.json';
import terrainJson from '../assets/gfx/tiles/terrain.json';
import propsJson from '../assets/gfx/props.json';

const frames = (propsJson as any).frames as Record<string, { frame: { w: number; h: number } }>;
const { world, interiors } = buildMaps(buildingsJson as unknown as Record<string, BuildingMeta>, (terrainJson as any).floors);
const maps: MapData[] = [world, ...Object.values(interiors)];

describe('Dekor çarpışma kutuları', () => {
  it('Her kutu kendi görselinin tabanı içinde kalıyor', () => {
    for (const [key, info] of Object.entries(PROP_INFO)) {
      if (!info.box) continue;
      const fr = frames[key];
      expect(fr, `${key}: atlas karesi`).toBeTruthy();
      const { w, h } = fr.frame;
      const r = propBox(key, 0, 0)!;
      // görsel: x ∈ [-w/2, w/2], y ∈ [-(h - baseY), baseY]
      expect(r.x, `${key}: sol`).toBeGreaterThanOrEqual(-w / 2);
      expect(r.x + r.w, `${key}: sağ`).toBeLessThanOrEqual(w / 2);
      expect(r.y, `${key}: üst`).toBeGreaterThanOrEqual(-(h - info.baseY));
      expect(r.y + r.h, `${key}: alt`).toBeLessThanOrEqual(info.baseY);
    }
  });
  it('Haritalardaki her kutu bir dekorun görsel alanı içinde', () => {
    for (const m of maps)
      for (const c of m.colliders) {
        const p = m.props.find((p) => p.key === c.key && Math.abs(p.x - (c.x + c.w / 2)) < 1);
        expect(p, `${m.id}: ${c.key} kutusunun dekoru`).toBeTruthy();
      }
  });
  it('Üstünden geçilebilir küçük nesnelerin hiç çarpışması yok', () => {
    for (const k of WALK_OVER) expect(PROP_INFO[k]?.box, k).toBeUndefined();
    for (const m of maps) for (const c of m.colliders) expect(WALK_OVER.includes(c.key!), `${m.id}: ${c.key}`).toBe(false);
  });
  it('Ağaçların kutusu yalnızca gövde kadar (en fazla 1,5 karo genişlik, yarım karo yükseklik)', () => {
    for (const [key, info] of Object.entries(PROP_INFO)) {
      if (!key.startsWith('tree_') || key === 'tree_huge') continue;
      const r = propBox(key, 0, 0)!;
      expect(r.w, key).toBeLessThanOrEqual(TILE);
      expect(r.h, key).toBeLessThanOrEqual(TILE / 2);
      void info;
    }
  });
  it('Ağaçlar karo ızgarasında sert engel değil (oyuncu gövdenin yanından geçebilir)', () => {
    for (const p of world.props) {
      if (!p.key.startsWith('tree_')) continue;
      const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
      if (world.terrain[ty * world.w + tx] === TERRAIN.water) continue;
      expect(world.hard[ty * world.w + tx], `${p.key} (${tx},${ty})`).toBe(0);
    }
  });
});

describe('Yollar (A7)', () => {
  const overlaps = (c: { x: number; y: number; w: number; h: number }, tx: number, ty: number) => {
    const x0 = tx * TILE + 4, y0 = ty * TILE + 4, x1 = (tx + 1) * TILE - 4, y1 = (ty + 1) * TILE - 4;
    return c.x < x1 && c.x + c.w > x0 && c.y < y1 && c.y + c.h > y0;
  };
  it('Yürünebilir yol karolarının hiçbiri engelli değil (bariyer hariç)', () => {
    const m = world;
    const bad: string[] = [];
    for (let y = 1; y < m.h - 1; y++)
      for (let x = 1; x < BARRIER_X; x++) {
        const t = m.terrain[y * m.w + x];
        if (!ROAD_TERRAINS.includes(t)) continue;
        if (m.hard[y * m.w + x]) { bad.push(`(${x},${y}) sert`); continue; }
        for (const c of m.colliders) {
          if (!overlaps(c, x, y)) continue;
          if (t === TERRAIN.cobble && PLAZA_DECOR.includes(c.key!)) continue; // meydan dekoru (kasıtlı)
          bad.push(`(${x},${y}) ${c.key}`);
        }
      }
    expect(bad.length, bad.join(' ')).toBe(0);
  });
  it('Fener ve tabelalar yolun kenarında', () => {
    for (const p of world.props) {
      if (p.key !== 'lantern' && p.key !== 'signpost') continue;
      const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
      expect(ROAD_TERRAINS.includes(world.terrain[ty * world.w + tx]), `${p.key} (${tx},${ty})`).toBe(false);
    }
  });
  it('Binalar birbirinin üstüne binmiyor', () => {
    const bm = buildingsJson as any;
    const rects = world.buildings.map((b) => ({ id: b.id, x0: b.tx, x1: b.tx + bm[b.id].w / TILE, y0: b.tyBottom - bm[b.id].h / TILE, y1: b.tyBottom }));
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        const ov = a.x0 < b.x1 - 0.5 && a.x1 > b.x0 + 0.5 && a.y0 < b.y1 - 1.5 && a.y1 > b.y0 + 0.5;
        expect(ov, `${a.id} ↔ ${b.id}`).toBe(false);
      }
  });
});
