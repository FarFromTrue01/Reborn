// Tüm iç mekânları ve dünya haritasını tarar: her kapı/geçiş görünür bir görsele sahip,
// yönüne uygun bir duvarda duruyor ve önündeki kare yürünebilir.
// Yeni eklenen her bina ve oda da bu testten geçmek zorunda.
import { describe, it, expect } from 'vitest';
import { type BuildingMeta } from '../src/world/worldgen';
import { buildMaps } from '../src/world/maps';
import { DOOR_SPRITES, type MapData, type DoorDef } from '../src/world/types';

import buildingsJson from '../assets/gfx/buildings/buildings.json';
import terrainJson from '../assets/gfx/tiles/terrain.json';
import propsJson from '../assets/gfx/props.json';

const bmeta = buildingsJson as unknown as Record<string, BuildingMeta>;
const floors = (terrainJson as any).floors as Record<string, number>;
const props = (propsJson as any).frames as Record<string, unknown>;

const { world, interiors } = buildMaps(bmeta, floors);
const maps: MapData[] = [world, ...Object.values(interiors)];

const solidAt = (m: MapData, x: number, y: number) => (x < 0 || y < 0 || x >= m.w || y >= m.h ? true : !!m.solid[y * m.w + x]);
const walkable = (m: MapData, x: number, y: number) => !solidAt(m, x, y);
const doorAt = (m: MapData, x: number, y: number): DoorDef | undefined =>
  m.doors.find((d) => d.x === x && y >= d.y && y < d.y + (d.h ?? 1));

describe('Kapılar ve geçişler', () => {
  it('Her harita taranıyor (dünya + tüm iç mekânlar)', () => {
    expect(maps.length).toBeGreaterThan(5);
    for (const m of maps) expect(Array.isArray(m.doors)).toBe(true);
  });

  for (const m of maps) {
    describe(m.id, () => {
      it('Her warp (harita geçişi) bir kapı görseline bağlı', () => {
        for (const w of m.warps) {
          const d = doorAt(m, w.x, w.y);
          expect(d, `${m.id}: (${w.x},${w.y}) → ${w.to || 'kilitli'} için kapı yok`).toBeTruthy();
          expect(d!.warp).toBe(true);
        }
      });

      it('Her kapının bilinen bir görseli var ve görsel gerçekten mevcut', () => {
        for (const d of m.doors) {
          expect(DOOR_SPRITES).toContain(d.sprite);
          if (d.sprite === 'building') {
            const b = m.buildings.find((b) => b.id === d.building && d.y === b.tyBottom);
            expect(b, `${m.id}: ${d.building} binası (${d.x},${d.y})`).toBeTruthy();
            const meta = bmeta[b!.id];
            expect(meta, `${b!.id} bina görseli`).toBeTruthy();
            // kapı görseli bina resminde, warp karosunun tam üstünde
            const hasDoor = meta.doors.some((dd) => Math.floor((b!.tx * 32 + dd.x) / 32) === d.x && dd.y === meta.h);
            expect(hasDoor, `${b!.id}: kapı görseli (${d.x}) bina resminde yok`).toBe(true);
          }
          if (d.sprite === 'ladder') {
            const lad = m.props.some((p) => p.key === 'ladder' && Math.floor(p.x / 32) === d.x && Math.floor(p.y / 32) === d.y - 1);
            expect(lad, `${m.id}: (${d.x},${d.y}) merdiven dekoru yok`).toBe(true);
            expect(props.ladder).toBeTruthy();
          }
        }
      });

      it('Kapılar yönlerine uygun duvarda duruyor', () => {
        for (const d of m.doors) {
          const h = d.h ?? 1;
          if (d.dir === 'up') {
            // üstünde bina/merdiven gibi geçilmez bir şey var
            expect(solidAt(m, d.x, d.y - 1), `${m.id}: (${d.x},${d.y}) yukarı kapının üstü dolu olmalı`).toBe(true);
          } else if (d.dir === 'down') {
            expect(d.y, `${m.id}: aşağı kapı alt duvarda olmalı`).toBe(m.h - 1);
            expect(solidAt(m, d.x - 1, d.y) && solidAt(m, d.x + 1, d.y) || m.doors.some((o) => o !== d && o.y === d.y && Math.abs(o.x - d.x) === 1), `${m.id}: (${d.x},${d.y}) çıkışın yanları duvar olmalı`).toBe(true);
          } else {
            // dikey duvar: açıklığın üstü ve altı duvar, açıklık yürünebilir
            expect(solidAt(m, d.x, d.y - 1), `${m.id}: yan kapının üstü duvar olmalı`).toBe(true);
            expect(solidAt(m, d.x, d.y + h), `${m.id}: yan kapının altı duvar olmalı`).toBe(true);
            expect(m.wallTiles?.some((w) => w.x === d.x && w.style === 'beam'), `${m.id}: yan kapı bir iç duvar üzerinde olmalı`).toBe(true);
            // duvar çizimi açıklığın içinden geçmemeli (kapı görünür kalsın)
            for (const w of m.wallTiles ?? []) {
              if (w.x !== d.x || w.style !== 'beam') continue;
              const overlap = w.y < d.y + h && w.y + w.h > d.y;
              expect(overlap, `${m.id}: duvar (${w.x},${w.y}..${w.y + w.h - 1}) kapı açıklığını örtüyor`).toBe(false);
            }
          }
        }
      });

      it('Kapı karosu ve önündeki kare yürünebilir', () => {
        for (const d of m.doors) {
          const h = d.h ?? 1;
          for (let y = d.y; y < d.y + h; y++) expect(walkable(m, d.x, y), `${m.id}: kapı karosu (${d.x},${y}) dolu`).toBe(true);
          if (d.dir === 'up') expect(walkable(m, d.x, d.y + 1), `${m.id}: (${d.x},${d.y + 1}) kapının önü dolu`).toBe(true);
          else if (d.dir === 'down') expect(walkable(m, d.x, d.y - 1), `${m.id}: (${d.x},${d.y - 1}) çıkışın önü dolu`).toBe(true);
          else
            for (let y = d.y; y < d.y + h; y++) {
              expect(walkable(m, d.x - 1, y), `${m.id}: (${d.x - 1},${y}) yan kapının solu dolu`).toBe(true);
              expect(walkable(m, d.x + 1, y), `${m.id}: (${d.x + 1},${y}) yan kapının sağı dolu`).toBe(true);
            }
        }
      });

      it('Warp hedefleri var olan, yürünebilir bir kareye çıkıyor', () => {
        const all: Record<string, MapData> = { world, ...interiors };
        for (const w of m.warps) {
          if (!w.to) continue;
          const t = all[w.to];
          expect(t, `${m.id}: hedef harita ${w.to}`).toBeTruthy();
          expect(walkable(t, w.tx, w.ty), `${m.id} → ${w.to} (${w.tx},${w.ty}) dolu`).toBe(true);
        }
      });
    });
  }
});
