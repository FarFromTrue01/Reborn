#!/usr/bin/env python3
"""
Köyün doğu kenarındaki taş sur ve şehir geçidi (0.8.0, Grup 5A B11).

Kaynak: LPC base_out_atlas (gri tuğla duvar, demir parmaklık) — tools/fetch_sources.sh ile indirilir.
Çıktılar (assets/gfx/buildings/):
  - east_wall.png  : sur parçası, 80 x 256 px (8 karo), dikey olarak tekrarlanır. Soldan 16 px batıya bakan
                     yüz (kısaltılmış) ve zemindeki gölge, sonra 64 px sur üstü (yürüyüş yolu + iki yanda mazgallar).
  - east_gate.png  : geçit, 176 x 512 px (16 karo): kuzey ve güney kulesi, aradaki kemer ve kapalı parmaklık.
Haritada: sur BARRIER_X sütunundan başlar (2 karo), geçit yolun (y=57) iki yanında (src/world/worldgen.ts).

Kullanım: python3 tools/build_eastwall.py
"""
import os
from PIL import Image, ImageDraw, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = os.path.join(ROOT, 'tools', '.cache', 'oga')
OUT = os.path.join(ROOT, 'assets', 'gfx', 'buildings')
T = 32
FACE = 16          # batıya bakan yüzün (kısaltılmış) genişliği
TOP = 64           # sur üstü (2 karo)

base = Image.open(os.path.join(S, 'atlas1', 'base_out_atlas.png')).convert('RGBA')
BRICK = base.crop((96, 416, 192, 478))       # gri tuğla yüzey (96 x 62)
GRATE = base.crop((0, 671, 32, 718))         # demir parmaklık

OUTLINE = (38, 36, 46, 255)


def tone(img, k, sat=1.0):
    im = ImageEnhance.Brightness(img).enhance(k)
    return ImageEnhance.Color(im).enhance(sat) if sat != 1 else im


def tile(src, w, h, ox=0, oy=0):
    out = Image.new('RGBA', (w, h))
    for y in range(-oy, h, src.height):
        for x in range(-ox, w, src.width):
            out.paste(src, (x, y), src)
    return out


def merlons(d, x0, x1, y0, y1, along='y', step=16, size=10, light=(150, 148, 162, 255), dark=(92, 90, 104, 255)):
    """Mazgal dişleri: üstten görünen küçük bloklar (açık üst + koyu güney yüzü)."""
    if along == 'y':
        for y in range(y0, y1, step):
            d.rectangle([x0, y, x1, y + size - 1], fill=light, outline=OUTLINE)
            d.rectangle([x0 + 1, y + size - 4, x1 - 1, y + size - 2], fill=dark)
    else:
        for x in range(x0, x1, step):
            d.rectangle([x, y0, x + size - 1, y1], fill=light, outline=OUTLINE)
            d.rectangle([x + 1, y1 - 3, x + size - 2, y1 - 1], fill=dark)


def walkway(w, h, oy=0):
    """Sur üstündeki taş yürüyüş yolu (tuğla, biraz açık)."""
    return tone(tile(BRICK, w, h, 0, oy), 1.12, 0.85)


def west_face(h, oy=0, k=0.62):
    return tone(tile(BRICK, FACE, h, 40, oy), k, 0.8)


def wall_strip(h, oy=0):
    """80 px genişlik: [gölge+batı yüzü 16][sur üstü 64]."""
    img = Image.new('RGBA', (FACE + TOP, h))
    img.alpha_composite(west_face(h, oy), (0, 0))
    img.alpha_composite(walkway(TOP, h, oy), (FACE, 0))
    d = ImageDraw.Draw(img)
    # yüzün dibinde ışık çizgisi, kenar çizgileri
    d.line([(0, 0), (0, h - 1)], fill=OUTLINE)
    d.line([(FACE, 0), (FACE, h - 1)], fill=OUTLINE)
    d.line([(FACE + TOP - 1, 0), (FACE + TOP - 1, h - 1)], fill=OUTLINE)
    # yürüyüş yolunun iki yanında mazgallar (batı ve doğu korkuluk)
    d.rectangle([FACE + 1, 0, FACE + 6, h - 1], fill=(112, 110, 124, 255))
    d.rectangle([FACE + TOP - 7, 0, FACE + TOP - 2, h - 1], fill=(112, 110, 124, 255))
    merlons(d, FACE + 1, FACE + 9, (-oy) % 16 - 16, h, 'y')
    merlons(d, FACE + TOP - 10, FACE + TOP - 2, (8 - oy) % 16 - 16, h, 'y')
    return img


def segment():
    return wall_strip(256)


def tower(h_top=96, h_face=72, slit=True, banner=False):
    """Kare kule: üstten 96x96 (mazgallı) + güneye bakan yüz; batı yüzü (16 px) solda."""
    W = FACE + 96
    img = Image.new('RGBA', (W, h_top + h_face))
    # batı yüzü (kısaltılmış) — üst ve güney yüz boyunca
    img.alpha_composite(west_face(h_top + h_face, 0, 0.55), (0, 0))
    # üst
    top = tone(tile(BRICK, 96, h_top, 20, 10), 1.05, 0.8)
    img.alpha_composite(top, (FACE, 0))
    # güney yüzü
    face = tone(tile(BRICK, 96, h_face, 0, 0), 0.92, 0.85)
    img.alpha_composite(face, (FACE, h_top))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W - 1, h_top + h_face - 1], outline=OUTLINE)
    d.line([(FACE, 0), (FACE, h_top + h_face - 1)], fill=OUTLINE)
    d.line([(FACE, h_top), (W - 1, h_top)], fill=OUTLINE)
    # üstte iç zemin (kule tepesi) ve dört yanda mazgallar
    d.rectangle([FACE + 12, 12, W - 13, h_top - 13], fill=(104, 100, 112, 255), outline=OUTLINE)
    merlons(d, FACE + 2, W - 2, 2, 11, 'x', step=16, size=10)
    merlons(d, FACE + 2, W - 2, h_top - 11, h_top - 2, 'x', step=16, size=10)
    merlons(d, FACE + 2, FACE + 11, 14, h_top - 14, 'y', step=16, size=10)
    merlons(d, W - 11, W - 2, 14, h_top - 14, 'y', step=16, size=10)
    # güney yüzünde ok mazgalı
    if slit:
        cx = FACE + 48
        d.rectangle([cx - 2, h_top + 16, cx + 2, h_top + 40], fill=(20, 18, 24, 255))
        d.rectangle([cx - 6, h_top + 26, cx + 6, h_top + 30], fill=(20, 18, 24, 255))
    # sancak (Baron Merrow: kırmızı-altın)
    if banner:
        for bx in (FACE + 18, W - 30):
            d.rectangle([bx, h_top + 4, bx + 12, h_top + 44], fill=(150, 36, 40, 255), outline=(60, 14, 16, 255))
            d.polygon([(bx, h_top + 44), (bx + 6, h_top + 52), (bx + 12, h_top + 44)], fill=(150, 36, 40, 255), outline=(60, 14, 16, 255))
            d.rectangle([bx + 4, h_top + 14, bx + 8, h_top + 26], fill=(220, 180, 70, 255))
            d.line([(bx - 1, h_top + 3), (bx + 13, h_top + 3)], fill=(80, 60, 30, 255), width=2)
    return img


def gate():
    """
    176 x 512 (16 karo: dünyada y 48..63). x: 0 = BARRIER_X*32 - 16 (batı yüzü/gölge), sur 16..80, kuleler 16..112.
    Kuzey kule ayak izi: y 53..55, güney kule: y 61..63; geçit (yol, y 56..58) iki kulenin arasında.
    """
    W, H = 176, 512
    Y0 = 48 * T
    img = Image.new('RGBA', (W, H))
    def Y(row):
        return row * T - Y0
    # sur (kuzeyden güneye tek parça; kuleler ve kemer üstüne çizilir)
    img.alpha_composite(wall_strip(H, 48 * T % 256), (0, 0))
    d = ImageDraw.Draw(img)
    # geçidin batı yüzündeki karanlık açıklık (kemer) + kapalı parmaklık + arkada ahşap kapı
    gy0, gy1 = Y(56) - 2, Y(59) + 6
    d.rectangle([0, gy0 + 10, FACE + 30, gy1], fill=(26, 22, 26, 255))
    d.pieslice([0, gy0, FACE + 30, gy0 + 22], 180, 360, fill=(26, 22, 26, 255))
    g = GRATE.resize((FACE + 14, gy1 - gy0 - 8), Image.NEAREST)
    img.alpha_composite(g, (2, gy0 + 8))
    d.rectangle([FACE + 16, gy0 + 10, FACE + 30, gy1 - 2], fill=(78, 48, 26, 255), outline=(30, 18, 8, 255))
    for yy in range(gy0 + 22, gy1 - 6, 24):
        d.line([(FACE + 16, yy), (FACE + 30, yy)], fill=(40, 40, 46, 255), width=2)
    # kuleler (ayak izinin altı = yüzün altı)
    tn = tower(96, 72, slit=True, banner=True)
    img.alpha_composite(tn, (0, Y(56) - tn.height))
    ts = tower(96, 72, slit=True, banner=False)
    img.alpha_composite(ts, (0, Y(64) - ts.height))
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    segment().save(os.path.join(OUT, 'east_wall.png'), optimize=True)
    gate().save(os.path.join(OUT, 'east_gate.png'), optimize=True)
    print('east_wall.png, east_gate.png')


if __name__ == '__main__':
    main()
