#!/usr/bin/env python3
"""
Grup 5A (D1–D7) silah görselleri: önce / sonra tabloları (en yakın komşu ile büyütülmüş).

Kullanım:
  mkdir -p /tmp/old && git archive 0a23787 assets/gfx/chars/joseph | tar -x -C /tmp/old
  python3 tools/qa/g5a_weapons.py /tmp/old/assets/gfx/chars/joseph
Çıktı: tools/qa/g5a/d*_*.png — her tabloda üst satırlar "önce" (0.7.0), alt satırlar "sonra" (0.8.0).
"""
import os, sys, json, math
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
NEW = os.path.join(ROOT, 'assets', 'gfx', 'chars', 'joseph')
OLD = sys.argv[1] if len(sys.argv) > 1 else None
OUT = os.path.join(ROOT, 'tools', 'qa', 'g5a')
F = 64
BG = (70, 110, 70, 255)
_cache = {}


def L(d, name):
    k = (d, name)
    if k not in _cache:
        p = os.path.join(d, name + '.png')
        _cache[k] = Image.open(p).convert('RGBA') if os.path.exists(p) else None
    return _cache[k]


def cell(d, layers, row, col, big=None):
    """128 px hücre: layers (64 px katmanlar), big: [(ad, boyut, yön, sütun)] — büyük kare (merkez ortak)."""
    c = Image.new('RGBA', (128, 128), BG)
    for spec in layers:
        if isinstance(spec, tuple):
            name, size, di, bc = spec
            im = L(d, name)
            if im is None:
                continue
            fr = im.crop((bc * size, di * size, bc * size + size, di * size + size))
            off = (128 - size) // 2
            if off >= 0:
                c.alpha_composite(fr, (off, off))
            else:
                c.alpha_composite(fr.crop((-off, -off, -off + 128, -off + 128)))
        else:
            im = L(d, spec)
            if im is None:
                continue
            c.alpha_composite(im.crop((col * F, row * F, col * F + F, row * F + F)), (32, 32))
    return c


def sheet(name, rows, labels, crop=(16, 8, 112, 120), z=4):
    x0, y0, x1, y1 = crop
    w, h = (x1 - x0) * z, (y1 - y0) * z
    cols = max(len(r) for r in rows)
    out = Image.new('RGBA', (cols * w + 8 * cols, len(rows) * h), (24, 24, 24, 255))
    d = ImageDraw.Draw(out)
    for ri, r in enumerate(rows):
        for ci, im in enumerate(r):
            out.paste(im.crop(crop).resize((w, h), Image.NEAREST), (ci * (w + 8), ri * h))
        d.text((4, ri * h + 2), labels[ri], fill=(255, 255, 0, 255))
    out.convert('RGB').quantize(256, dither=Image.Dither.NONE).save(os.path.join(OUT, name + '.png'), optimize=True)
    print(name)


BODY = ['body', 'head', 'a_shirt', 'a_pants']


def main():
    if not OLD:
        print(__doc__)
        sys.exit(1)
    os.makedirs(OUT, exist_ok=True)
    both = [('önce', OLD), ('sonra', NEW)]

    # D1: kısa kılıç saldırısı, geriye çekiş kareleri (0–2), dört yön
    rows, labels = [], []
    for lab, d in both:
        for di in range(4):
            rows.append([cell(d, [('w_arming_steel_atk_bg', 128, di, c)] + BODY + [('w_arming_steel_atk', 128, di, c)], 12 + di, c) for c in range(3)])
            labels.append(f'{lab} yon {di}')
    sheet('d1_sword_hilt', rows, labels, crop=(24, 16, 104, 112), z=5)

    # D2: mızrak ve yay, savaşta yürürken (önce: sırttaki görünüm, sonra: elde)
    for w in ('spear', 'bow'):
        rows, labels = [], []
        for lab, d in both:
            for di in range(4):
                r = []
                for c in (0, 2, 4, 6):
                    if d == OLD:
                        r.append(cell(d, [f'w_{w}_carry_bg'] + BODY + [f'w_{w}_carry'], 8 + di, c))
                    else:
                        r.append(cell(d, [(f'w_{w}_walk_bg', 128, di, c)] + BODY + [(f'w_{w}_walk', 128, di, c)], 8 + di, c))
                rows.append(r)
                labels.append(f'{lab} yon {di}')
        sheet(f'd2_walk_{w}', rows, labels, crop=(16, 0, 112, 120), z=3)

    # D3: hançer yukarı saplama (satır 4)
    rows = [[cell(d, ['w_dagger_bg'] + BODY + ['w_dagger'], 4, c) for c in range(8)] for _, d in both]
    sheet('d3_dagger_up', rows, ['önce', 'sonra'], crop=(16, 0, 112, 120), z=3)

    # D4: pala, vurulma (satır 20, kareler 0–2): önce silah yok; sonra aşağı yöndeki yürüme karesi (poz hep aşağı bakar)
    rows = []
    for lab, d in both:
        lay = BODY[:] if d == OLD else [('w_cleaver_walk_bg', 128, 2, 0)] + BODY + [('w_cleaver_walk', 128, 2, 0)]
        rows.append([cell(d, lay, 20, c) for c in (0, 1, 2)])
    sheet('d4_cleaver_hurt', rows, ['önce', 'sonra'], crop=(8, 0, 120, 120), z=3)

    # D5: sırttaki görünümler (yandan: sol, sağ; aşağı)
    rows, labels = [], []
    for w in ('w_arming_steel', 'w_dagger', 'w_spear'):
        for lab, d in both:
            rows.append([cell(d, [w + '_carry_bg'] + BODY + [w + '_carry'], r, 0) for r in (9, 11, 10)])
            labels.append(f'{w} {lab}')
    sheet('d5_carry', rows, labels, crop=(20, 4, 108, 116), z=4)

    # D6: süzülen yay (sırta koyma yolunun ortası), aşağı ve yukarı
    rows = []
    for lab, d in both:
        r = []
        meta = json.load(open(os.path.join(d, 'weapons.json')))['w_bow']
        item = L(d, 'w_bow_item')
        for dirname, row in (('down', 10), ('up', 8)):
            hand = {'down': (42, 45, 80), 'up': (22, 45, 100)}[dirname]
            back = meta['carry'][dirname]
            ctrl = {'down': (50, 20), 'up': (14, 22)}[dirname]
            for p in (0.35, 0.65):
                c = ctrl if d == OLD else ((hand[0] + back['x']) / 2, (hand[1] + back['y']) / 2)
                x = (1 - p) ** 2 * hand[0] + 2 * (1 - p) * p * c[0] + p * p * back['x']
                y = (1 - p) ** 2 * hand[1] + 2 * (1 - p) * p * c[1] + p * p * back['y']
                da = ((back['a'] - hand[2] + 540) % 360) - 180
                deg = hand[2] + da * p
                k = round(deg / (360 / 32)) % 32
                fr = item.crop(((k % 8) * 80, (k // 8) * 80, (k % 8) * 80 + 80, (k // 8) * 80 + 80))
                if d == NEW:
                    fr = fr.resize((60, 60), Image.NEAREST)
                # gövde: thrust 2. kare (kol omza uzanır), yönün satırı
                trow = 4 + {'up': 0, 'down': 2}[dirname]
                front = (dirname != 'up') if d == OLD else (dirname != 'up' and p >= 0.15)
                pos = (int(32 + x - fr.width / 2), int(32 + y - fr.height / 2))
                img = Image.new('RGBA', (128, 128), BG)
                if not front:
                    img.alpha_composite(fr, pos)
                for nm in BODY:
                    img.alpha_composite(L(d, nm).crop((2 * F, trow * F, 3 * F, (trow + 1) * F)), (32, 32))
                if front:
                    img.alpha_composite(fr, pos)
                r.append(img)
        rows.append(r)
    sheet('d6_bow_float', rows, ['önce', 'sonra'], crop=(8, 0, 120, 120), z=3)

    # D7: Çatlak Sopa ve Budaklı Sopa, elde (sağ, sol)
    rows = []
    for lab, d in both:
        rows.append([cell(d, BODY + [s], r, 0) for s in ('w_stick_cracked', 'w_stick') for r in (11, 9)])
    sheet('d7_cracked_stick', rows, ['önce', 'sonra'], crop=(16, 16, 112, 104), z=5)


if __name__ == '__main__':
    main()
