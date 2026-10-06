#!/usr/bin/env python3
"""Elle çizilen ikonlar (0.8.0). icon_map.json'da "draw:<ad>" ile seçilir; build_icons.py çağırır.

Kullanım (yalnızca bu ikonları mevcut atlasa yazmak için):  python3 tools/custom_icons.py
"""
import os, json
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = 34

# Yırtık Şort: kahverengi, paçaları yırtık (yırtık şort katmanı a_shorts ile aynı palet)
PAL = {
    'o': (44, 26, 14), 'w': (74, 46, 24), 's': (150, 108, 64),
    'd': (88, 56, 30), 'm': (118, 78, 42), 'l': (150, 102, 58), 'h': (176, 128, 80),
}
TORN_SHORTS = [
    '..oooooooooooooooooooo..',
    '..owwwwwwwwwwwwwwwwwwo..',
    '..owsswwsswwsswwsswwwo..',
    '..oooooooooooooooooooo..',
    '..ohlmmmmmmmdmmmmmmmdo..',
    '.ohlmmmmmmmmdmmmmmmmmdo.',
    '.ohlmmmmmmmmdmmmmmmmmdo.',
    '.olmmmmmmmmodommmmmmmdo.',
    '.olmmmmmmmo..ommmmmmmdo.',
    'olmmmmmmmo....ommmmmmmdo',
    'olmmmmmmdo....odmmmmmmdo',
    'olmmmmmmdo....odmmmmmldo',
    'olmlmmmmdo....odmmmlmmdo',
    'odmmmmmddo....oddmmmmmdo',
    'odmdmmdddo....odddmmdmdo',
    'odo.ododdo....oddodo.odo',
    'oo...o.oo......oo.o...oo',
]


def draw(name):
    rows = {'torn_shorts': TORN_SHORTS}[name]
    w = len(rows[0])
    assert all(len(r) == w for r in rows), name
    im = Image.new('RGBA', (C, C))
    ox, oy = (C - w) // 2, (C - len(rows)) // 2 + 1
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.':
                im.putpixel((ox + x, oy + y), PAL[ch] + (255,))
    return im


if __name__ == '__main__':
    m = json.load(open(os.path.join(ROOT, 'tools', 'icon_map.json')))
    P = os.path.join(ROOT, 'assets', 'gfx', 'icons.png')
    J = json.load(open(os.path.join(ROOT, 'assets', 'gfx', 'icons.json')))
    sheet = Image.open(P).convert('RGBA')
    for k, v in m.items():
        if not v.startswith('draw:'):
            continue
        f = J['frames'][k]['frame']
        sheet.paste(Image.new('RGBA', (f['w'], f['h'])), (f['x'], f['y']))
        sheet.paste(draw(v[5:]), (f['x'], f['y']))
        print('çizildi:', k)
    sheet.save(P, optimize=True)
