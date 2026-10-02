#!/usr/bin/env python3
"""
Canavar sprite'larını tek tip bir sayfa formatına dönüştürür.

Çıktı: assets/gfx/monsters/<id>.png  (64x64 hücreler)
Satır düzeni: her animasyon için 4 yön satırı (yukarı, sol, aşağı, sağ).
assets/gfx/monsters/monsters.json → {id: {anims: {walk: {row, frames, fps}, ...}}}
"""
import os, sys, json
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', '.cache', 'oga')
OUT = os.path.join(ROOT, 'assets', 'gfx', 'monsters')
C = 64
DIRS = ['up', 'left', 'down', 'right']


def place(frame, cell=C, scale=1):
    """Kareyi hücrenin altına ortalar."""
    if scale != 1:
        frame = frame.resize((int(frame.width * scale), int(frame.height * scale)), Image.NEAREST)
    out = Image.new('RGBA', (cell, cell))
    bb = frame.getbbox()
    if not bb:
        return out
    f = frame.crop(bb)
    x = (cell - f.width) // 2
    y = cell - f.height - 6
    out.paste(f, (x, max(0, y)), f)
    return out


class Sheet:
    def __init__(self):
        self.rows = []  # list of list of frames
        self.anims = {}

    def add(self, name, frames_by_dir, fps):
        row0 = len(self.rows)
        n = 0
        for d in DIRS:
            fr = frames_by_dir[d]
            self.rows.append(fr)
            n = max(n, len(fr))
        self.anims[name] = {'row': row0, 'frames': n, 'fps': fps}

    def save(self, path):
        cols = max(len(r) for r in self.rows)
        im = Image.new('RGBA', (cols * C, len(self.rows) * C))
        for ri, r in enumerate(self.rows):
            for ci, f in enumerate(r):
                im.paste(f, (ci * C, ri * C))
        im.save(path, optimize=True)
        return {'frameW': C, 'frameH': C, 'cols': cols, 'anims': self.anims}


def grid(im, x, y, w, h, n, dx=None):
    dx = dx or w
    return [im.crop((x + i * dx, y, x + i * dx + w, y + h)) for i in range(n)]


def rat():
    im = Image.open(os.path.join(SRC, 'lpccatratdog.png')).convert('RGBA')
    # 32x32, satırlar: aşağı, sol, sağ, yukarı; 3 kare
    rows = {'down': 0, 'left': 1, 'right': 2, 'up': 3}
    s = Sheet()
    walk = {d: [place(f, scale=1) for f in grid(im, 0, r * 32, 32, 32, 3)] for d, r in rows.items()}
    for d in DIRS:
        walk[d] = walk[d] + [walk[d][1]]
    s.add('walk', walk, 10)
    return s


def rabbit():
    im = Image.open(os.path.join(SRC, 'rabbit_2.png')).convert('RGBA')
    s = Sheet()
    hop = {d: [place(f) for f in grid(im, 0, i * 72, 72, 72, 4)] for i, d in enumerate(DIRS)}
    idle = {d: [place(f) for f in grid(im, 0, (4 + i) * 72, 72, 72, 4)] for i, d in enumerate(DIRS)}
    s.add('walk', hop, 10)
    s.add('idle', idle, 4)
    return s


def slime():
    im = Image.open(os.path.join(SRC, 'lpc-monsters', 'lpc-monsters', 'slime.png')).convert('RGBA')
    s = Sheet()
    move = [place(f) for f in grid(im, 0, 64, 64, 64, 8)]
    jump = [place(f) for f in grid(im, 0, 0, 64, 64, 6)]
    s.add('walk', {d: move for d in DIRS}, 9)
    s.add('attack', {d: jump for d in DIRS}, 10)
    return s


def wolf():
    im = Image.open(os.path.join(SRC, 'wolfsheet1.png')).convert('RGBA')
    s = Sheet()

    def front(y, n):
        return [place(f) for f in grid(im, 0, y, 32, 64, n)]

    def back(y, n):
        return [place(f) for f in grid(im, 160, y, 32, 64, n)]

    def side(y, n):
        return [place(f) for f in grid(im, 320, y, 64, 32, n)]

    walk = {'down': front(64, 4), 'up': back(64, 4), 'right': side(96, 5), 'left': side(288, 5)}
    run = {'down': front(128, 4), 'up': back(128, 4), 'right': side(128, 5), 'left': side(320, 5)}
    bite = {'down': front(256, 5), 'up': back(256, 5), 'right': side(160, 5), 'left': side(352, 5)}
    die = {'down': side(0, 4), 'up': side(192, 4), 'right': side(0, 4), 'left': side(192, 4)}
    s.add('walk', walk, 9)
    s.add('run', run, 12)
    s.add('attack', bite, 12)
    s.add('die', die, 7)
    return s


def main():
    os.makedirs(OUT, exist_ok=True)
    meta = {}
    for name, fn in [('rat', rat), ('rabbit', rabbit), ('slime', slime), ('wolf', wolf)]:
        meta['m_' + name] = fn().save(os.path.join(OUT, name + '.png'))
        meta['m_' + name]['file'] = name + '.png'
        print('canavar', name, meta['m_' + name]['anims'])
    with open(os.path.join(OUT, 'monsters.json'), 'w') as f:
        json.dump(meta, f, indent=1)


if __name__ == '__main__':
    main()
