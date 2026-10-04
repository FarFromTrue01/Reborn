#!/usr/bin/env python3
"""steps_g4b.mjs kırpıntılarını (screens/g4b) büyütüp (en yakın komşu) tablolara dizer: tools/qa/g4b/*.png"""
import os, sys
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'screens', 'g4b')
OUT = os.path.join(ROOT, 'tools', 'qa', 'g4b')
os.makedirs(OUT, exist_ok=True)
DIRS = ['up', 'left', 'down', 'right']
WEAPONS = ['cracked_stick', 'wooden_club', 'rusty_shortsword', 'iron_shortsword', 'goblin_cleaver', 'hunting_knife', 'iron_spear', 'short_bow']
Z = 3


def load(name):
    p = os.path.join(SRC, name + '.png')
    if not os.path.exists(p):
        return None
    im = Image.open(p).convert('RGB')
    # kırpıntı 112x122 dünya pikseli × kamera yakınlaştırması; tabloda sabit boy (tam sayı oranla, en yakın komşu)
    k = max(1, round(112 * Z / im.width))
    im = im.resize((im.width * k, im.height * k), Image.NEAREST)
    return im.crop((0, 0, 112 * Z, 122 * Z))


def sheet(rows, out, labels=None):
    rows = [[load(n) for n in r] for r in rows]
    w = max(len(r) for r in rows) * 112 * Z
    h = len(rows) * 122 * Z
    o = Image.new('RGB', (w, h), (30, 30, 30))
    for ri, r in enumerate(rows):
        for ci, im in enumerate(r):
            if im:
                o.paste(im, (ci * 112 * Z, ri * 122 * Z))
    if labels:
        d = ImageDraw.Draw(o)
        for ri, t in enumerate(labels):
            d.text((6, ri * 122 * Z + 4), t, fill=(255, 255, 0))
    o.quantize(256, dither=Image.Dither.NONE).save(os.path.join(OUT, out + '.png'), optimize=True)
    print(out)


for wid in WEAPONS:
    sheet([[f'walk_{wid}_hand_{d}' for d in DIRS], [f'walk_{wid}_carry_{d}' for d in DIRS]], f'walk_{wid}', ['elde', 'sirtta'])
for wid in WEAPONS + ['fist']:
    sheet([[f'atk_{wid}_normal_{d}' for d in DIRS], [f'atk_{wid}_heavy_windup_{d}' for d in DIRS], [f'atk_{wid}_heavy_{d}' for d in DIRS]], f'attack_{wid}',
          ['normal (darbe karesi)', 'agir: hazirlanma', 'agir (darbe karesi)'])
for wid in WEAPONS:
    sheet([[f'stow_{wid}_{d}' for d in DIRS], [f'draw_{wid}_{d}' for d in DIRS]], f'sheath_{wid}', ['sirta koyma (orta)', 'cekme (orta)'])
sheet([[f'cape_{w}' for w in WEAPONS[:4]], [f'cape_{w}' for w in WEAPONS[4:]]], 'cape_up')
sheet([['talk_idle']], 'talk_idle')
