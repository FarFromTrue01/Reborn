// Büyüyen köy ve NPC verilerinin tutarlılığı: her NPC'nin görseli, kastı, replikleri ve programı geçerli;
// program hedefleri gerçekten var olan, yürünebilir kareler; dükkân sahipleri dükkânlarında çalışıyor.
import { describe, it, expect } from 'vitest';
import { buildWorld, type BuildingMeta } from '../src/world/worldgen';
import { buildInteriors } from '../src/world/interiors';
import { NPCS, CASTE_RANK, scheduleAt } from '../src/data/npcs';
import { CHAR_SHEETS, BUILDINGS } from '../src/data/manifest';
import { SHOPS, shopOpen } from '../src/data/shops';
import { nearestFree } from '../src/world/path';
import type { MapData } from '../src/world/types';
import buildingsJson from '../assets/gfx/buildings/buildings.json';
import terrainJson from '../assets/gfx/tiles/terrain.json';

const bmeta = buildingsJson as unknown as Record<string, BuildingMeta>;
const world = buildWorld(bmeta);
const interiors = buildInteriors((terrainJson as any).floors);
const maps: Record<string, MapData> = { world, ...interiors };

describe('Köy', () => {
  it('Köy 0.1.0\'a göre en az 2 kat büyük', () => {
    const v = world.zones.find((z) => z.id === 'village')!;
    expect(v.w * v.h).toBeGreaterThanOrEqual(2 * 80 * 72);
    // binalar da en az iki katı
    expect(world.buildings.length).toBeGreaterThanOrEqual(2 * 16);
  });
  it('Her bina görselinin metası var', () => {
    for (const b of world.buildings) expect(bmeta[b.id], b.id).toBeTruthy();
    for (const b of BUILDINGS) expect(bmeta[b], b).toBeTruthy();
  });
  it('Girilebilen her binanın iç mekânı var', () => {
    for (const b of world.buildings) if (b.enter) expect(interiors[b.enter.map], b.id).toBeTruthy();
  });
});

describe('NPC\'ler', () => {
  it('NPC sayısı 0.1.0\'ın (23) en az 2 katı', () => {
    expect(NPCS.length).toBeGreaterThanOrEqual(46);
    expect(new Set(NPCS.map((n) => n.id)).size).toBe(NPCS.length);
  });
  for (const n of NPCS) {
    it(`${n.id}: görsel, kast, Appraisal ve replikler`, () => {
      expect(CHAR_SHEETS[n.sheet], `${n.id} sheet`).toBeTruthy();
      expect(CASTE_RANK[n.caste]).toBeGreaterThan(0);
      expect(n.creature.skills.some((s) => s.id === 'appraisal')).toBe(true);
      const bubbles = Object.values(n.bubbles).flat();
      expect(bubbles.length, `${n.id} balon`).toBeGreaterThan(0);
      expect(n.schedule.length).toBeGreaterThan(0);
    });
    it(`${n.id}: program hedefleri geçerli ve yürünebilir`, () => {
      for (const e of n.schedule) {
        if (e.map === 'hidden') continue;
        const m = maps[e.map];
        expect(m, `${n.id}: ${e.map} haritası`).toBeTruthy();
        let t: [number, number];
        if (Array.isArray(e.at)) t = e.at;
        else {
          const p = m.points[e.at];
          expect(p, `${n.id}: ${e.map}.${e.at} noktası`).toBeTruthy();
          t = [p.x, p.y];
        }
        expect(t[0] >= 0 && t[1] >= 0 && t[0] < m.w && t[1] < m.h, `${n.id}: (${t}) harita dışında`).toBe(true);
        const [fx, fy] = nearestFree(m.solid, m.w, m.h, t[0], t[1]);
        expect(Math.abs(fx - t[0]) + Math.abs(fy - t[1]), `${n.id}: ${e.map} (${t}) yürünemez`).toBeLessThanOrEqual(2);
      }
    });
  }
  it('Dükkân sahipleri çalışma saatinde kendi dükkânlarında', () => {
    for (const shop of Object.values(SHOPS)) {
      const keeper = NPCS.find((n) => n.id === shop.keeper)!;
      expect(keeper, shop.id).toBeTruthy();
      const mid = Math.floor((shop.hours[0] + shop.hours[1]) / 2);
      const e = scheduleAt(keeper, mid, 1);
      expect(e.map, `${keeper.id} saat ${mid}`).toBe(shop.map);
      expect(shopOpen(shop, shop.map, mid)).toBe(true);
      expect(shopOpen(shop, 'world', mid)).toBe(false);
    }
  });
  it('Kâhya yalnızca belirli günlerde köyde', () => {
    const st = NPCS.find((n) => n.id === 'steward')!;
    expect(scheduleAt(st, 11, 2).map).toBe('world'); // 2. gün = Ateş Günü
    expect(scheduleAt(st, 11, 3).map).toBe('hidden');
  });
});
