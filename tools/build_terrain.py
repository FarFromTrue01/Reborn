#!/usr/bin/env python3
"""
Arazi tileset'i üretir (LPC Tile Atlas'tan).

Her arazi türü için 20 karo: 0..15 köşe durumları (TL=1, TR=2, BL=4, BR=8),
16..18 dolgu varyantları. Köşegen durumlar iki köşe parçasının üst üste
bindirilmesiyle üretilir. Kaldırım ve tarla gibi blok formatında olmayan
dokular, toprak bloğunun kenar maskeleriyle kesilerek oluşturulur.

Çıktı: assets/gfx/tiles/terrain.png + terrain.json
"""
import os, json, sys
from PIL import Image, ImageChops, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'tools', '.cache', 'oga')
OUT = os.path.join(ROOT, 'assets', 'gfx', 'tiles')
T = 32

atlas = Image.open(os.path.join(SRC, 'atlas1', 'terrain_atlas.png')).convert('RGBA')
interior = Image.open(os.path.join(SRC, 'LPC_house_interior_0', 'LPC_house_interior', 'interior.png')).convert('RGBA')


def tile(c, r, src=atlas):
    return src.crop((c * T, r * T, c * T + T, r * T + T))


def block_cases(c0, r0):
    """LPC blok (3x6) → 16 köşe durumu."""
    g = lambda dc, dr: tile(c0 + dc, r0 + dr)
    only = {8: g(0, 2), 4: g(2, 2), 2: g(0, 4), 1: g(2, 4)}
    cases = {}
    cases[0] = Image.new('RGBA', (T, T), (0, 0, 0, 0))
    cases[15] = g(1, 3)
    for k, v in only.items():
        cases[k] = v
    cases[4 | 8] = g(1, 2)  # alt iki köşe → üst kenar parçası
    cases[1 | 2] = g(1, 4)
    cases[2 | 8] = g(0, 3)
    cases[1 | 4] = g(2, 3)
    cases[1 | 2 | 4] = g(1, 0)  # BR eksik
    cases[1 | 2 | 8] = g(2, 0)  # BL eksik
    cases[1 | 4 | 8] = g(1, 1)  # TR eksik
    cases[2 | 4 | 8] = g(2, 1)  # TL eksik
    # köşegenler
    for a, b in ((1, 8), (2, 4)):
        im = Image.alpha_composite(only[a].copy(), only[b])
        cases[a | b] = im
    fills = [g(0, 5), g(1, 5), g(2, 5)]
    return [cases[i] for i in range(16)], fills


def masked_cases(mask_c0, mask_r0, texture_tiles, outline=(0, 0, 0, 90)):
    """Bir bloğun kenar maskelerini başka bir dokuya uygular."""
    mcases, _ = block_cases(mask_c0, mask_r0)
    out = []
    for i, m in enumerate(mcases):
        if i == 0:
            out.append(m)
            continue
        tex = texture_tiles[i % len(texture_tiles)]
        a = m.split()[3].point(lambda v: 255 if v > 100 else 0)
        im = tex.copy()
        im.putalpha(a)
        # ince koyu kenar
        edge = a.filter(ImageFilter.FIND_EDGES)
        sh = Image.new('RGBA', (T, T), outline)
        sh.putalpha(ImageChops.multiply(edge, a).point(lambda v: outline[3] if v > 0 else 0))
        im = Image.alpha_composite(im, sh)
        out.append(im)
    return out


terrains = []  # (id, cases16, fills3)

# Çimen: sadece dolgu (taban). Ayrıca çiçekli varyantlar.
grass_fills = [tile(21, 5), tile(22, 5), tile(23, 5)]
terrains.append(('grass', [Image.new('RGBA', (T, T))] * 16, grass_fills))
flowers = [tile(21, 11), tile(22, 11), tile(23, 11)]
terrains.append(('grass_flowers', [Image.new('RGBA', (T, T))] * 16, flowers))

for tid, (c, r) in [('forest', (6, 24)), ('dirt', (15, 0)), ('mud', (18, 0)), ('sand', (0, 9)), ('water', (9, 9))]:
    cs, fs = block_cases(c, r)
    if tid == 'water':
        fs = [tile(10, 12), tile(8, 14), tile(10, 12)]
    terrains.append((tid, cs, fs))

# Kaldırım (gri arnavut taşı) – toprak maskesiyle
cob = [tile(30, 16), tile(31, 17), tile(30, 18), tile(31, 19), tile(31, 20)]
cs = masked_cases(15, 0, cob, (30, 30, 35, 120))
terrains.append(('cobble', cs, [tile(30, 17), tile(31, 18), tile(31, 19)]))

# Tarla (sürülmüş toprak)
tilled = [tile(6, 20), tile(7, 20), tile(6, 20).transpose(Image.FLIP_LEFT_RIGHT)]
cs = masked_cases(15, 0, tilled, (40, 25, 10, 140))
terrains.append(('farm', cs, tilled))

# Su (çimen kenarlı, yeşil kenar) – göl kıyısı için ayrı tür
cs, fs = block_cases(6, 9)
terrains.append(('pond', cs, [tile(7, 12), tile(8, 14), tile(7, 12)]))

COLS = 20
sheet = Image.new('RGBA', (COLS * T, (len(terrains) + 2) * T), (0, 0, 0, 0))
meta = {'tileSize': T, 'cols': COLS, 'terrains': {}}
for row, (tid, cases, fills) in enumerate(terrains):
    for i, im in enumerate(cases):
        sheet.paste(im, (i * T, row * T))
    for j, im in enumerate(fills):
        sheet.paste(im, ((16 + j) * T, row * T))
    meta['terrains'][tid] = {'row': row, 'base': row * COLS}

# İç mekân zeminleri (son iki satır)
r = len(terrains)
floors = {
    'floor_wood': interior.crop((0, 96, 32, 128)),
    'floor_wood2': interior.crop((0, 96, 32, 128)).transpose(Image.FLIP_LEFT_RIGHT),
    'floor_check': interior.crop((0, 128, 32, 160)),
    'floor_stone': interior.crop((32, 128, 64, 160)),
    'floor_flag': tile(16, 26),
    'floor_flag2': tile(17, 27),
    'floor_flag3': tile(18, 28),
    'floor_tan': tile(22, 29),
    'cobble_fill': tile(30, 17),
    'dirt_fill': tile(16, 5),
}
meta['floors'] = {}
for i, (k, im) in enumerate(floors.items()):
    sheet.paste(im, (i * T, r * T))
    meta['floors'][k] = r * COLS + i

os.makedirs(OUT, exist_ok=True)
sheet.save(os.path.join(OUT, 'terrain.png'), optimize=True)
with open(os.path.join(OUT, 'terrain.json'), 'w') as f:
    json.dump(meta, f, indent=1)
print('terrain:', len(terrains), 'tür', sheet.size)
