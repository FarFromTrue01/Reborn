#!/usr/bin/env python3
"""
Bina dış görünüşleri: LPC Thatched-roof Cottage (bluecarrot16) duvar panelleri,
saman çatı dokuları ve LPC Base Assets kapı/pencere/arduvaz parçalarından
birleştirilir.

Çıktı: assets/gfx/buildings/<id>.png + buildings.json
 json: {id: {w, h, wallTop, doors:[{x,y}], collide:{x,y,w,h}}}  (piksel, sol üst köşeye göre)
"""
import os, json, random
from PIL import Image, ImageDraw, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = os.path.join(ROOT, 'tools', '.cache', 'oga')
OUT = os.path.join(ROOT, 'assets', 'gfx', 'buildings')
T = 32

cottage = Image.open(os.path.join(S, 'cottage.png')).convert('RGBA')
thatch = Image.open(os.path.join(S, 'thatched-roof.png')).convert('RGBA')
base = Image.open(os.path.join(S, 'atlas1', 'base_out_atlas.png')).convert('RGBA')
deco = Image.open(os.path.join(S, 'decoration_medieval', 'decoration_medieval', 'decorations-medieval.png')).convert('RGBA')


def ct(c, r):
    return cottage.crop((c * T, r * T, c * T + T, r * T + T))


WALLS = {
    # (L, M, R) sütunları × 3 satır, panel başlangıç satırı
    'tan': 0,
    'cream': 4,
    'stone': 8,
}

ROOFS = {
    'thatch': thatch.crop((224, 160, 256, 192)),
    'thatch_dark': thatch.crop((224, 384, 256, 416)),
    'slate': base.crop((64, 472, 96, 504)),
}
ROOF_EDGE = {
    'thatch': thatch.crop((224, 192, 256, 224)),
    'thatch_dark': thatch.crop((224, 416, 256, 448)),
    'slate': None,
}
DOOR = base.crop((96, 288, 128, 338))
WINDOW = base.crop((226, 288, 256, 318))
STONE = base.crop((128, 440, 160, 472))


def tile_fill(dst, tex, x0, y0, x1, y1):
    for y in range(y0, y1, tex.height):
        for x in range(x0, x1, tex.width):
            t = tex.crop((0, 0, min(tex.width, x1 - x), min(tex.height, y1 - y)))
            dst.paste(t, (x, y))


def wall_layer(w, rows, style):
    """Yarı ahşap duvar: sıva/taş dolgu, ahşap kirişler ve çapraz destekler."""
    oy = {'tan': 0, 'cream': 128, 'stone': 256}[style]
    W, H = w * T, rows * T
    img = Image.new('RGBA', (W, H))
    if style == 'stone':
        tile_fill(img, cottage.crop((10, oy + 10, 86, oy + 58)), 0, 0, W, H)
    else:
        tile_fill(img, cottage.crop((22, oy + 14, 74, oy + 54)), 0, 0, W, H)
    beam_top = cottage.crop((8, oy, 88, oy + 6))
    beam_mid = cottage.crop((8, oy + 62, 88, oy + 69))
    brace = cottage.crop((32, oy + 69, 64, oy + 88))
    beam_bot = cottage.crop((8, oy + 88, 88, oy + 96))
    post = cottage.crop((0, oy, 6, oy + 96))
    by = H - 34  # alt destek bandı
    if style != 'stone':
        tile_fill(img, brace, 0, by + 7, W, by + 26)
        tile_fill(img, beam_mid, 0, by, W, by + 7)
    tile_fill(img, beam_top, 0, 0, W, 6)
    tile_fill(img, beam_bot, 0, H - 8, W, H)
    xs = list(range(0, W, 3 * T)) + [W - 6]
    for x in xs:
        tile_fill(img, post, x, 0, x + 6, H)
    return img


def shingles(w_px, h_px, base_col, seed):
    rnd = random.Random(seed)
    img = Image.new('RGBA', (w_px, h_px), base_col)
    d = ImageDraw.Draw(img)
    row = 0
    for y in range(0, h_px, 7):
        off = 6 if row % 2 else 0
        for x in range(-off, w_px, 12):
            v = rnd.randint(-14, 14)
            c = tuple(max(0, min(255, base_col[i] + v)) for i in range(3)) + (255,)
            d.rectangle([x, y, x + 11, y + 6], fill=c)
            d.line([(x, y + 6), (x + 11, y + 6)], fill=(25, 25, 35, 255))
            d.line([(x, y), (x, y + 6)], fill=(35, 35, 48, 255))
            d.line([(x + 1, y + 1), (x + 10, y + 1)], fill=tuple(min(255, c[i] + 25) for i in range(3)) + (255,))
        row += 1
    return img


def roof_layer(w_px, h_px, style, seed):
    """Ön eğim: doku, saman katmanları, alt saçak, mahya ve yan gölgeler."""
    rnd = random.Random(seed)
    if style == 'slate':
        img = shingles(w_px, h_px, (78, 82, 104), seed)
    else:
        tex = ROOFS[style]
        img = Image.new('RGBA', (w_px, h_px))
        for y in range(0, h_px, T):
            for x in range(0, w_px, T):
                t = tex if rnd.random() < 0.6 else tex.transpose(Image.FLIP_LEFT_RIGHT)
                img.paste(t, (x, y))
        ov = Image.new('RGBA', img.size)
        d = ImageDraw.Draw(ov)
        # saman katmanları (dalgalı koyu çizgiler)
        for y in range(14, h_px - 10, 13):
            for x in range(0, w_px, 2):
                yy = y + int(2 * __import__('math').sin((x + seed.__hash__() % 7) / 7.0))
                d.point((x, yy), fill=(60, 35, 10, 110))
                d.point((x, yy + 1), fill=(255, 235, 170, 40))
        img = Image.alpha_composite(img, ov)
        edge = ROOF_EDGE[style]
        if edge is not None:
            for x in range(0, w_px, T):
                img.paste(edge, (x, h_px - T), edge)
    shade = Image.new('RGBA', (w_px, h_px))
    d = ImageDraw.Draw(shade)
    for y in range(h_px):
        t = y / max(1, h_px - 1)
        d.line([(0, y), (w_px, y)], fill=(20, 10, 0, int(85 * (1 - t) ** 1.5)))
    img = Image.alpha_composite(img, shade)
    ov = Image.new('RGBA', img.size)
    d = ImageDraw.Draw(ov)
    ridge = (64, 40, 18, 255) if style != 'slate' else (44, 44, 58, 255)
    d.rectangle([0, 0, w_px - 1, 6], fill=ridge)
    d.line([(0, 2), (w_px, 2)], fill=(255, 230, 160, 70) if style != 'slate' else (160, 160, 185, 90))
    d.line([(0, 7), (w_px, 7)], fill=(0, 0, 0, 100))
    # kalça çatı yanları: üçgen gölgeler
    for i in range(h_px):
        a = int(110 * (1 - i / h_px))
        wdt = int(18 * (1 - i / h_px)) + 3
        d.line([(0, i), (wdt, i)], fill=(20, 10, 0, a))
        d.line([(w_px - 1 - wdt, i), (w_px - 1, i)], fill=(20, 10, 0, a))
    d.rectangle([0, 0, w_px - 1, h_px - 1], outline=(25, 15, 5, 255))
    return Image.alpha_composite(img, ov)


def chimney(h):
    img = Image.new('RGBA', (20, h))
    for y in range(0, h, T):
        img.paste(STONE.crop((0, 0, 20, T)), (0, y))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 19, 4], fill=(70, 70, 78, 255))
    d.rectangle([2, 1, 17, 3], fill=(20, 20, 22, 255))
    d.rectangle([0, 0, 19, h - 1], outline=(25, 25, 30, 255))
    return img


def building(spec):
    w = spec['w']
    wall_h = spec.get('wall', 3)
    roof_h = spec.get('roof', 3)
    over = 8  # saçak taşması
    W = w * T + over * 2
    roof_px = roof_h * T
    H = roof_px + wall_h * T
    img = Image.new('RGBA', (W, H))
    # duvar
    wall = wall_layer(w, wall_h, spec.get('style', 'tan'))
    img.paste(wall, (over, roof_px), wall)
    # duvar üstünde saçak gölgesi
    sh = Image.new('RGBA', (w * T, 10))
    d = ImageDraw.Draw(sh)
    for y in range(10):
        d.line([(0, y), (w * T, y)], fill=(0, 0, 0, int(120 * (1 - y / 10))))
    img.alpha_composite(sh, (over, roof_px))
    # pencereler
    for c in spec.get('windows', []):
        img.alpha_composite(WINDOW, (over + c * T + 1, roof_px + T // 2 + 6 + (T if wall_h > 3 else 0)))
    # kapılar
    doors = []
    for c in spec.get('doors', []):
        dx = over + c * T
        dy = H - DOOR.height
        img.alpha_composite(DOOR, (dx, dy))
        doors.append({'x': dx + T // 2, 'y': H})
    # baca
    if spec.get('chimney') is not None:
        ch = chimney(roof_px - 10 + 24)
        cx = over + int(spec['chimney'] * T)
        img_ch = Image.new('RGBA', img.size)
        img_ch.alpha_composite(ch, (cx, 0))
    # çatı
    roof = roof_layer(W, roof_px + 6, spec.get('roofStyle', 'thatch'), spec['id'])
    img.alpha_composite(roof, (0, 0))
    if spec.get('chimney') is not None:
        # baca çatının üstünden yükselir: üst kısmı çatı üstünde görünür
        top = Image.new('RGBA', (W, H + 24))
        top.alpha_composite(ch, (cx, 0))
        canvas = Image.new('RGBA', (W, H + 24))
        canvas.alpha_composite(img, (0, 24))
        # bacanın yalnızca çatı üst yarısında görünen kısmı
        chp = ch.crop((0, 0, ch.width, roof_px // 2 + 24))
        canvas.alpha_composite(chp, (cx, 0))
        img = canvas
        for dd in doors:
            dd['y'] += 24
        top_off = 24
    else:
        top_off = 0
    H2 = img.height
    meta = {
        'w': img.width, 'h': H2,
        'wallTop': top_off + roof_px,
        'doors': doors,
        # çarpışma: bina zemini (çatı ön eğiminin alt yarısından duvar altına kadar)
        'collide': {'x': over, 'y': top_off + roof_px // 2, 'w': w * T, 'h': H2 - (top_off + roof_px // 2) - 2},
    }
    return img, meta


BUILDINGS = [
    {'id': 'inn', 'w': 10, 'wall': 3, 'roof': 4, 'style': 'cream', 'roofStyle': 'thatch_dark', 'doors': [4], 'windows': [1, 2, 6, 7, 8], 'chimney': 7.6},
    {'id': 'guild', 'w': 9, 'wall': 3, 'roof': 3, 'style': 'stone', 'roofStyle': 'slate', 'doors': [4], 'windows': [1, 2, 6, 7], 'chimney': 1.2},
    {'id': 'smithy', 'w': 7, 'wall': 3, 'roof': 3, 'style': 'stone', 'roofStyle': 'thatch_dark', 'doors': [2], 'windows': [5], 'chimney': 4.6},
    {'id': 'shop', 'w': 6, 'wall': 3, 'roof': 3, 'style': 'tan', 'roofStyle': 'thatch', 'doors': [2], 'windows': [0, 4]},
    {'id': 'healer', 'w': 6, 'wall': 3, 'roof': 3, 'style': 'cream', 'roofStyle': 'thatch', 'doors': [3], 'windows': [1, 4], 'chimney': 0.6},
    {'id': 'house_a', 'w': 5, 'wall': 3, 'roof': 3, 'style': 'tan', 'roofStyle': 'thatch', 'doors': [1], 'windows': [3], 'chimney': 3.4},
    {'id': 'house_b', 'w': 6, 'wall': 3, 'roof': 3, 'style': 'cream', 'roofStyle': 'thatch_dark', 'doors': [4], 'windows': [1, 2]},
    {'id': 'house_c', 'w': 4, 'wall': 3, 'roof': 2, 'style': 'tan', 'roofStyle': 'thatch_dark', 'doors': [1], 'windows': [3]},
    {'id': 'house_d', 'w': 7, 'wall': 3, 'roof': 3, 'style': 'stone', 'roofStyle': 'thatch', 'doors': [3], 'windows': [1, 5], 'chimney': 5.5},
    {'id': 'house_e', 'w': 5, 'wall': 3, 'roof': 3, 'style': 'cream', 'roofStyle': 'thatch', 'doors': [2], 'windows': [0, 4]},
    {'id': 'mill', 'w': 4, 'wall': 4, 'roof': 3, 'style': 'stone', 'roofStyle': 'thatch_dark', 'doors': [1], 'windows': [2]},
    {'id': 'barn', 'w': 8, 'wall': 3, 'roof': 4, 'style': 'tan', 'roofStyle': 'thatch_dark', 'doors': [3, 4], 'windows': []},
    {'id': 'guardhouse', 'w': 5, 'wall': 3, 'roof': 2, 'style': 'stone', 'roofStyle': 'slate', 'doors': [2], 'windows': [0, 4]},
]


def mill_sails():
    """Değirmen kanatları (oyunda döndürülür)."""
    S = 120
    img = Image.new('RGBA', (S, S))
    d = ImageDraw.Draw(img)
    c = S // 2
    for ang in range(4):
        import math
        a = ang * math.pi / 2
        ux, uy = math.cos(a), math.sin(a)
        px, py = -uy, ux
        # kol
        d.line([(c, c), (c + ux * 58, c + uy * 58)], fill=(92, 60, 30, 255), width=4)
        # bez
        pts = [(c + ux * 14 + px * 2, c + uy * 14 + py * 2), (c + ux * 56 + px * 2, c + uy * 56 + py * 2),
               (c + ux * 56 + px * 15, c + uy * 56 + py * 15), (c + ux * 14 + px * 12, c + uy * 14 + py * 12)]
        d.polygon(pts, fill=(226, 214, 180, 255), outline=(110, 90, 60, 255))
        for k in range(1, 4):
            t = 14 + k * 10.5
            d.line([(c + ux * t + px * 2, c + uy * t + py * 2), (c + ux * t + px * 14, c + uy * t + py * 14)], fill=(150, 130, 95, 255))
    d.ellipse([c - 6, c - 6, c + 6, c + 6], fill=(70, 45, 22, 255), outline=(30, 18, 8, 255))
    return img


def city_wall():
    """Uzaktaki surlu şehir (arka plan)."""
    W, H = 960, 260
    img = Image.new('RGBA', (W, H))
    wall_tex = base.crop((96, 408, 192, 504))
    # sur
    for x in range(0, W, 96):
        img.paste(wall_tex, (x, H - 96))
    d = ImageDraw.Draw(img)
    # mazgallar
    for x in range(0, W, 24):
        d.rectangle([x, H - 108, x + 13, H - 96], fill=(120, 118, 130, 255), outline=(50, 48, 58, 255))
    # kuleler
    cone = base.crop((512, 672, 612, 1024))
    for i, x in enumerate([60, 300, 560, 820]):
        th = 170 if i % 2 else 200
        tw = 72
        for y in range(H - th, H, 96):
            img.paste(wall_tex.crop((0, 0, tw, min(96, H - y))), (x, y))
        d.rectangle([x, H - th, x + tw - 1, H - 1], outline=(50, 48, 58, 255))
        c2 = cone.resize((tw + 12, int(cone.height * (tw + 12) / cone.width)), Image.NEAREST)
        c2 = c2.crop((0, 0, c2.width, min(c2.height, 110)))
        img.alpha_composite(c2, (x - 6, max(0, H - th - c2.height + 10)))
    # kapı
    gx = 430
    d.rectangle([gx, H - 80, gx + 80, H - 1], fill=(30, 24, 22, 255))
    d.pieslice([gx, H - 120, gx + 80, H - 40], 180, 360, fill=(30, 24, 22, 255))
    for k in range(gx + 6, gx + 80, 10):
        d.line([(k, H - 100), (k, H - 1)], fill=(70, 60, 50, 255), width=2)
    # mavimsi uzaklık sisi
    fog = Image.new('RGBA', (W, H), (150, 170, 200, 70))
    fog.putalpha(img.split()[3].point(lambda a: 70 if a else 0))
    img = Image.alpha_composite(img, fog)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    meta = {}
    for spec in BUILDINGS:
        img, m = building(spec)
        img.save(os.path.join(OUT, spec['id'] + '.png'), optimize=True)
        meta[spec['id']] = m
        print('bina', spec['id'], img.size)
    mill_sails().save(os.path.join(OUT, 'mill_sails.png'))
    city_wall().save(os.path.join(OUT, 'city_wall.png'))
    with open(os.path.join(OUT, 'buildings.json'), 'w') as f:
        json.dump(meta, f, indent=1)


if __name__ == '__main__':
    main()
