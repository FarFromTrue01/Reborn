// Geliştirici aracı: dünya haritasını PNG'ye döker (npx vite-node tools/dev/mapdump.ts out.png)
import fs from 'node:fs';
import { buildWorld, type BuildingMeta } from '../../src/world/worldgen';
import { TERRAIN } from '../../src/world/types';
import bjson from '../../assets/gfx/buildings/buildings.json';
const bmeta = bjson as unknown as Record<string, BuildingMeta>;
const m = buildWorld(bmeta);
const S = Number(process.env.S ?? 4);
const W = m.w * S, H = m.h * S;
const px = Buffer.alloc(W * H * 3);
const col: Record<number, [number, number, number]> = {
  [TERRAIN.grass]: [80, 140, 60], [TERRAIN.flowers]: [100, 150, 70], [TERRAIN.forest]: [40, 80, 45], [TERRAIN.sand]: [216, 192, 112],
  [TERRAIN.dirt]: [168, 133, 79], [TERRAIN.mud]: [107, 74, 42], [TERRAIN.farm]: [122, 85, 48], [TERRAIN.cobble]: [138, 138, 150], [TERRAIN.water]: [42, 111, 168],
};
const put = (x: number, y: number, c: [number, number, number]) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 3; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; };
for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
  let c = col[m.terrain[y * m.w + x]] ?? [255, 0, 255];
  if (m.solid[y * m.w + x]) c = [Math.floor(c[0] * 0.45), Math.floor(c[1] * 0.45), Math.floor(c[2] * 0.45)];
  for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) put(x * S + xx, y * S + yy, c);
}
const cols = (m as any).colliders as { x: number; y: number; w: number; h: number }[] | undefined;
if (cols) for (const r of cols) for (let y = Math.floor(r.y * S / 32); y < Math.ceil((r.y + r.h) * S / 32); y++) for (let x = Math.floor(r.x * S / 32); x < Math.ceil((r.x + r.w) * S / 32); x++) put(x, y, [255, 60, 60]);
for (const b of m.buildings) { const bm = bmeta[b.id]; const x0 = b.tx * S, y1 = b.tyBottom * S, w = bm.w / 32 * S, h = bm.h / 32 * S; for (let x = x0; x < x0 + w; x++) { put(x, Math.round(y1 - h), [255, 255, 0]); put(x, y1 - 1, [255, 255, 0]); } for (let y = Math.round(y1 - h); y < y1; y++) { put(x0, y, [255, 255, 0]); put(Math.round(x0 + w - 1), y, [255, 255, 0]); } }
for (const p of Object.values(m.points)) for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) put(p.x * S + xx, p.y * S + yy, [255, 255, 255]);
// PPM → PNG yerine PPM yaz (python ile çevrilir)
fs.writeFileSync(process.argv[2] ?? 'map.ppm', Buffer.concat([Buffer.from(`P6 ${W} ${H} 255\n`), px]));
console.log('props', m.props.length, 'buildings', m.buildings.length, 'w', m.w, 'h', m.h, 'trees', m.props.filter((p) => p.key.startsWith('tree_')).length);
