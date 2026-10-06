#!/usr/bin/env python3
"""İkon atlası: '496 pixel art icons for medieval/fantasy RPG' (CC0, Henrique Lazarini / 7Soul1)."""
import os, json
from PIL import Image
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import custom_icons
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', '.cache', 'oga', 'icons496')
m = json.load(open(os.path.join(ROOT, 'tools', 'icon_map.json')))
C = 34
cols = 16
keys = sorted(m)
rows = (len(keys) + cols - 1) // cols
sheet = Image.new('RGBA', (cols * C, rows * C))
frames = {}
for i, k in enumerate(keys):
    x, y = (i % cols) * C, (i // cols) * C
    if m[k].startswith('draw:'):
        sheet.paste(custom_icons.draw(m[k][5:]), (x, y))  # elle çizilen (tools/custom_icons.py)
    else:
        sheet.paste(Image.open(os.path.join(SRC, m[k])).convert('RGBA'), (x, y))
    frames[k] = {'frame': {'x': x, 'y': y, 'w': C, 'h': C}, 'rotated': False, 'trimmed': False,
                 'spriteSourceSize': {'x': 0, 'y': 0, 'w': C, 'h': C}, 'sourceSize': {'w': C, 'h': C}}
out = os.path.join(ROOT, 'assets', 'gfx')
sheet.save(os.path.join(out, 'icons.png'), optimize=True)
json.dump({'frames': frames, 'meta': {'image': 'icons.png', 'size': {'w': sheet.width, 'h': sheet.height}, 'scale': 1}}, open(os.path.join(out, 'icons.json'), 'w'))
print('ikon:', len(keys))
