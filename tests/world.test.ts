// Büyüyen köy ve NPC verilerinin tutarlılığı: her NPC'nin görseli, kastı, replikleri ve programı geçerli;
// program hedefleri gerçekten var olan, yürünebilir kareler; dükkân sahipleri dükkânlarında çalışıyor.
import { describe, it, expect } from 'vitest';
import { type BuildingMeta } from '../src/world/worldgen';
import { buildMaps } from '../src/world/maps';
import { NPCS, CASTE_RANK, scheduleAt, planIndex } from '../src/data/npcs';
import { CHAR_SHEETS, BUILDINGS } from '../src/data/manifest';
import { SHOPS, shopOpen } from '../src/data/shops';
import { nearestFree } from '../src/world/path';
import type { MapData } from '../src/world/types';
import buildingsJson from '../assets/gfx/buildings/buildings.json';
import terrainJson from '../assets/gfx/tiles/terrain.json';

const bmeta = buildingsJson as unknown as Record<string, BuildingMeta>;
const { world, interiors } = buildMaps(bmeta, (terrainJson as any).floors);
const maps: Record<string, MapData> = { world, ...interiors };

describe('Köy', () => {
  it('0.3.0: köy sıkıştı (0.2.0: 151×115 karo), bina sayısı aynı (32), şehir yolu kısa', () => {
    const v = world.zones.find((z) => z.id === 'village')!;
    expect(v.w).toBeLessThanOrEqual(Math.round(151 * 0.65));
    expect(v.h).toBeLessThanOrEqual(Math.round(115 * 0.8));
    expect(world.buildings.length).toBe(32);
    const plaza = world.points.plaza, cp = world.points.checkpoint;
    // 0.2.0'da meydandan kontrol noktasına ~115 karo vardı
    expect(cp.x - plaza.x).toBeLessThanOrEqual(70);
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
    it(`${n.id}: program hedefleri geçerli ve yürünebilir (tüm gün planları)`, () => {
      for (const e of [...n.schedule, ...(n.plans ?? []).flat()]) {
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
  it('Dükkân sahipleri her gün, çalışma saatlerinin tamamında kendi dükkânlarında', () => {
    for (const shop of Object.values(SHOPS)) {
      const keeper = NPCS.find((n) => n.id === shop.keeper)!;
      expect(keeper, shop.id).toBeTruthy();
      for (let day = 1; day <= 21; day++)
        for (let h = shop.hours[0]; h < shop.hours[1]; h++) {
          const e = scheduleAt(keeper, h + 0.5, day);
          expect(e.map, `${keeper.id} gün ${day} saat ${h}`).toBe(shop.map);
        }
      const mid = Math.floor((shop.hours[0] + shop.hours[1]) / 2);
      expect(shopOpen(shop, shop.map, mid)).toBe(true);
      expect(shopOpen(shop, 'world', mid)).toBe(false);
    }
  });
  it('D2: gece herkes handa değil ve handaki kalabalık günden güne değişiyor', () => {
    const crowd = (day: number) => NPCS.filter((n) => scheduleAt(n, 20.5, day).map === 'inn').map((n) => n.id).sort().join(',');
    const nights = new Set<string>();
    for (let d = 1; d <= 7; d++) {
      const c = crowd(d).split(',');
      expect(c.length).toBeLessThan(NPCS.length / 2);
      nights.add(crowd(d));
    }
    expect(nights.size).toBeGreaterThanOrEqual(4);
  });
  it('D2: çoğu NPC\'nin günden güne değişen planı var; aynı NPC her gün aynı saatte aynı yerde değil', () => {
    const withPlans = NPCS.filter((n) => (n.plans?.length ?? 0) > 0);
    expect(withPlans.length).toBeGreaterThanOrEqual(35);
    for (const n of withPlans) {
      const seen = new Set<number>();
      for (let d = 1; d <= 14; d++) seen.add(planIndex(n, d));
      expect(seen.size, n.id).toBeGreaterThan(1);
    }
  });
  it('Paralı asker efendisiyle, Pip annesiyle aynı planı izliyor', () => {
    const by = Object.fromEntries(NPCS.map((n) => [n.id, n]));
    for (let d = 1; d <= 14; d++) {
      expect(planIndex(by.merc_guard, d)).toBe(planIndex(by.merchant, d));
      expect(planIndex(by.pip, d)).toBe(planIndex(by.anna, d));
    }
  });
  it('Kâhya yalnızca belirli günlerde köyde', () => {
    const st = NPCS.find((n) => n.id === 'steward')!;
    expect(scheduleAt(st, 11, 2).map).toBe('world'); // 2. gün = Ateş Günü
    expect(scheduleAt(st, 11, 3).map).toBe('hidden');
  });
});
