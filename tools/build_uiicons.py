#!/usr/bin/env python3
"""
Arayüz simge atlası (0.3.0): renkli, emoji tarzı simgeler + lonca rütbe rozetleri.

- Simgeler: Twemoji (c) Twitter/X ve katkıda bulunanlar, CC-BY 4.0 — https://github.com/jdecked/twemoji
  PNG olarak oyuna gömülür; sistem emoji yazı tipine güvenilmez (her cihazda aynı görünür).
- Rütbe rozetleri (G → X): bu betikte elle çizilir; G sade tahta, ortalar bronz/gümüş,
  A ve S değerli taşlı altın, X efsanevi ve parıltılı.

Çıktı: assets/gfx/uiicons.png + uiicons.json (Phaser atlası, 72x72 kareler).
Kullanım: python3 tools/build_uiicons.py   (Twemoji PNG'lerini tools/.cache/twemoji altına indirir)
"""
import os, json, math, urllib.request
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, 'tools', '.cache', 'twemoji')
OUT = os.path.join(ROOT, 'assets', 'gfx')
BASE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/'
C = 72

# anahtar → Twemoji kod noktası
EMOJI = {
    # temel değerler
    'hp': '2764', 'mp': '1f4a7', 'stamina': '26a1', 'exp': '2728', 'level': '2b50', 'light': '1f31f',
    'money': '1f4b0', 'coin': '1fa99', 'prestige': '1f451', 'points': '1f3c5', 'debt': '1f4c9',
    # statlar
    'STR': '1f4aa', 'VIT': '1f6e1', 'AGI': '1fab6', 'DEX': '1f3af', 'MNA': '1f52e', 'INT': '1f4d8', 'LUK': '1f340',
    # kimlik
    'identity': '1f464', 'race': '1f9ec', 'gender': '1f6bb', 'age': '23f3', 'title': '1f3c6', 'caste': '1f3db',
    'guild': '1f3f0', 'rank': '1f396', 'skills': '1f4a0', 'equipment': '2694', 'inventory': '1f392', 'traits': '1f512',
    'status': '2699', 'stats': '1f4ca', 'appraisal': '1f50d', 'eye': '1f441', 'history': '1f4ac', 'settings': '1f527',
    'save': '1f4be', 'map': '1f5fa', 'quests': '1f4dc', 'main_quest': '2757', 'side_quest': '1f4cc', 'board_quest': '1f4cb',
    'target': '1f4cd', 'reward': '1f381', 'risk': '26a0', 'check': '2705', 'cross': '274c', 'lock': '1f512', 'clock': '1f552',
    'card': '1f3ab', 'group': '1f465', 'companion': '1f91d', 'dev': '1f6e0', 'fullscreen': '1f5a5', 'joystick': '1f579',
    'sword': '1f5e1', 'bow': '1f3f9', 'fist': '1f44a', 'shield': '1f6e1', 'sleep': '1f4a4', 'home': '1f3e0', 'phone': '1f4f2',
    # envanter sekmeleri
    'inv_all': '1f4e6', 'inv_equip': '2694', 'inv_food': '1f356', 'inv_material': '1fab5', 'inv_other': '1f4ce', 'inv_cards': '1f3ab',
    # harita işaretleri
    'm_inn': '1f37a', 'm_guild': '2694', 'm_smithy': '2692', 'm_shop': '1f6cd', 'm_healer': '1f33f', 'm_bakery': '1f35e',
    'm_tailor': '1f9f5', 'm_tannery': '1f97e', 'm_lodge': '1f3f9', 'm_farm': '1f33e', 'm_mill': '1f33e', 'm_guard': '1f482',
    'm_checkpoint': '1f6a7', 'm_camp': '2620', 'm_wake': '2728', 'm_plaza': '26f2', 'm_training': '1f3cb', 'm_manor': '1f3db',
    'm_oak': '1f333', 'm_pasture': '1f411', 'm_pond': '1f30a', 'm_house': '1f3e1', 'm_quest': '1f4cd', 'm_city': '1f3f0',
    # servis koşturmacası
    's_beer': '1f37a', 's_stew': '1f372', 's_bread': '1f35e', 's_plate': '1f37d', 's_angry': '1f620', 's_happy': '1f60a',
    # ayarlar bölümleri (0.5.0; mevcut atlasın sonuna eklendi)
    'sound': '1f50a', 'gameplay': '1f3ae',
}

LETTERS = 'GFEDCBASX'


def fetch(code):
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, code + '.png')
    if not os.path.exists(p):
        with urllib.request.urlopen(BASE + code + '.png') as r, open(p, 'wb') as f:
            f.write(r.read())
    return Image.open(p).convert('RGBA').resize((C, C), Image.LANCZOS)


# ---------------------------------------------------------------------------- rozetler
def font(size):
    for f in ('Cinzel.ttf',):
        p = os.path.join(ROOT, 'assets', 'fonts', f)
        if os.path.exists(p):
            ft = ImageFont.truetype(p, size)
            try:
                ft.set_variation_by_axes([800])
            except Exception:
                pass
            return ft
    return ImageFont.load_default()


TIERS = {
    #       gövde (açık, koyu), kenar, yazı, taş, süs seviyesi
    'G': ((150, 108, 64), (92, 62, 34), (60, 40, 22), (246, 230, 200), None, 0),
    'F': ((150, 152, 160), (84, 86, 96), (52, 54, 62), (250, 250, 255), None, 0),
    'E': ((205, 127, 60), (120, 66, 28), (80, 44, 18), (255, 236, 210), None, 1),
    'D': ((214, 140, 70), (128, 72, 30), (232, 196, 120), (255, 242, 220), (60, 160, 90), 1),
    'C': ((214, 220, 230), (120, 128, 144), (80, 86, 100), (40, 48, 64), None, 2),
    'B': ((226, 232, 242), (126, 136, 156), (200, 210, 230), (34, 42, 60), (70, 120, 230), 2),
    'A': ((250, 214, 96), (176, 120, 28), (120, 78, 10), (90, 50, 0), (220, 40, 60), 3),
    'S': ((255, 226, 120), (190, 130, 30), (255, 250, 210), (100, 50, 0), (60, 200, 220), 4),
    'X': ((176, 120, 255), (70, 30, 150), (255, 220, 120), (255, 255, 255), (255, 80, 200), 5),
}


def shield_path(cx, cy, w, h):
    pts = []
    for i in range(0, 41):
        t = i / 40
        # üst kenar düz, yanlar aşağıda sivrilen kalkan
        x = cx - w / 2 + w * t
        pts.append((x, cy - h / 2 + 4 * math.sin(math.pi * t)))
    for i in range(0, 41):
        t = i / 40
        ang = math.pi * t
        x = cx + (w / 2) * math.cos(ang)
        y = cy - h / 2 + h * 0.45 + (h * 0.55) * math.sin(ang) ** 1.4
        pts.append((x, y))
    return pts


def badge(letter):
    S = 4  # süper örnekleme
    W = C * S
    im = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    light, dark, edge, txtc, gem, orn = TIERS[letter]
    d = ImageDraw.Draw(im)
    cx, cy = W / 2, W / 2 + (7 if orn >= 3 else 2) * S
    bw, bh = W * (0.68 if orn >= 3 else 0.74), W * (0.74 if orn >= 3 else 0.82)
    # X: dış parıltı
    if letter == 'X':
        glow = Image.new('RGBA', (W, W), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        for r in range(8):
            gd.ellipse([W * 0.06 + r * 4, W * 0.06 + r * 4, W * 0.94 - r * 4, W * 0.94 - r * 4], outline=(255, 180, 255, 40), width=6)
        glow = glow.filter(ImageFilter.GaussianBlur(6))
        im.alpha_composite(glow)
        d = ImageDraw.Draw(im)
        # ışınlar
        for k in range(12):
            a = k * math.pi / 6
            d.polygon([(cx, cy), (cx + math.cos(a - 0.08) * W * 0.5, cy + math.sin(a - 0.08) * W * 0.5), (cx + math.cos(a + 0.08) * W * 0.5, cy + math.sin(a + 0.08) * W * 0.5)], fill=(255, 230, 140, 70))
    # S ve X: kanatlar / taç
    if orn >= 4:
        for sx in (-1, 1):
            d.polygon([(cx + sx * bw * 0.42, cy - bh * 0.22), (cx + sx * W * 0.5, cy - bh * 0.42), (cx + sx * W * 0.47, cy - bh * 0.05), (cx + sx * bw * 0.44, cy + bh * 0.05)], fill=edge + (255,), outline=dark + (255,))
    pts = shield_path(cx, cy, bw, bh)
    d.polygon([(x + 3 * S, y + 4 * S) for x, y in pts], fill=(0, 0, 0, 110))
    d.polygon(pts, fill=dark + (255,))
    inner = shield_path(cx, cy, bw - 9 * S, bh - 9 * S)
    # degrade gövde
    grad = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    gdr = ImageDraw.Draw(grad)
    for y in range(W):
        t = y / W
        col = tuple(int(light[i] * (1 - t * 0.55) + dark[i] * t * 0.55) for i in range(3))
        gdr.line([(0, y), (W, y)], fill=col + (255,))
    mask = Image.new('L', (W, W), 0)
    ImageDraw.Draw(mask).polygon(inner, fill=255)
    im.paste(grad, (0, 0), mask)
    d = ImageDraw.Draw(im)
    # malzeme dokusu
    if letter == 'G':
        for k in range(5):  # tahta damarı
            y = cy - bh * 0.3 + k * bh * 0.14
            d.line([(cx - bw * 0.3, y), (cx + bw * 0.3, y + 3 * S)], fill=(110, 76, 42, 140), width=S)
    if letter == 'F':
        for sx in (-1, 1):  # demir perçinler
            for sy in (-0.28, 0.12):
                d.ellipse([cx + sx * bw * 0.3 - 3 * S, cy + sy * bh - 3 * S, cx + sx * bw * 0.3 + 3 * S, cy + sy * bh + 3 * S], fill=(200, 202, 210, 255), outline=(60, 60, 70, 255))
    # iç kenar parıltısı
    d.line(inner[:41], fill=(255, 255, 255, 120), width=2 * S)
    d.polygon(inner, outline=edge + (255,), width=2 * S if orn < 2 else 3 * S)
    if orn >= 2:  # çift çerçeve
        inner2 = shield_path(cx, cy, bw - 20 * S, bh - 20 * S)
        d.polygon(inner2, outline=edge + (160,), width=S)
    # taç (A ve üstü)
    if orn >= 3:
        ty = cy - bh / 2 - 2 * S
        cw = bw * (0.42 if orn == 3 else 0.52)
        crown = [(cx - cw / 2, ty + 8 * S), (cx - cw / 2, ty - 6 * S), (cx - cw / 4, ty + 2 * S), (cx, ty - 10 * S), (cx + cw / 4, ty + 2 * S), (cx + cw / 2, ty - 6 * S), (cx + cw / 2, ty + 8 * S)]
        d.polygon(crown, fill=(255, 214, 80, 255) if letter != 'X' else (255, 230, 150, 255), outline=(140, 90, 10, 255))
        for px in (cx - cw / 2, cx, cx + cw / 2):
            d.ellipse([px - 3 * S, ty - (14 if px == cx else 10) * S, px + 3 * S, ty - (8 if px == cx else 4) * S], fill=gem + (255,) if gem else (255, 255, 255, 255))
    # değerli taşlar
    if gem:
        n = 1 if orn <= 2 else 3
        for k in range(n):
            gx = cx + (k - (n - 1) / 2) * bw * 0.24
            gy = cy + bh * 0.33
            r = (5 if orn < 4 else 6) * S
            d.polygon([(gx, gy - r), (gx + r, gy), (gx, gy + r), (gx - r, gy)], fill=gem + (255,), outline=(255, 255, 255, 200))
            d.polygon([(gx - r * 0.4, gy - r * 0.3), (gx, gy - r * 0.8), (gx + r * 0.2, gy - r * 0.3)], fill=(255, 255, 255, 170))
    # harf
    f = font(int((30 if orn >= 3 else 34) * S))
    tw = d.textbbox((0, 0), letter, font=f)
    lx = cx - (tw[2] - tw[0]) / 2 - tw[0]
    ly = cy - (tw[3] - tw[1]) / 2 - tw[1] - 4 * S
    lum = 0.3 * txtc[0] + 0.59 * txtc[1] + 0.11 * txtc[2]
    outline = (255, 248, 225, 200) if lum < 128 else (dark[0] // 2, dark[1] // 2, dark[2] // 2, 255)
    d.text((lx + 2 * S, ly + 3 * S), letter, font=f, fill=(0, 0, 0, 120))
    for ox, oy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        d.text((lx + ox * S * 1.5, ly + oy * S * 1.5), letter, font=f, fill=outline)
    d.text((lx, ly), letter, font=f, fill=txtc + (255,))
    # X: yıldız pırıltıları
    if letter == 'X':
        for (sx, sy, r) in ((0.2, 0.22, 7), (0.82, 0.3, 5), (0.74, 0.8, 6), (0.24, 0.74, 4)):
            px, py = W * sx, W * sy
            r *= S
            d.polygon([(px, py - r), (px + r * 0.25, py - r * 0.25), (px + r, py), (px + r * 0.25, py + r * 0.25), (px, py + r), (px - r * 0.25, py + r * 0.25), (px - r, py), (px - r * 0.25, py - r * 0.25)], fill=(255, 255, 255, 240))
    return im.resize((C, C), Image.LANCZOS)


def main():
    keys = list(EMOJI.keys())
    frames = {}
    imgs = {}
    for k, code in EMOJI.items():
        imgs[k] = fetch(code)
    for L in LETTERS:
        imgs['rank_' + L] = badge(L)
    names = list(imgs.keys())
    cols = 16
    rows = (len(names) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * C, rows * C), (0, 0, 0, 0))
    for i, k in enumerate(names):
        x, y = (i % cols) * C, (i // cols) * C
        sheet.alpha_composite(imgs[k], (x, y))
        frames[k] = {'frame': {'x': x, 'y': y, 'w': C, 'h': C}, 'rotated': False, 'trimmed': False,
                     'spriteSourceSize': {'x': 0, 'y': 0, 'w': C, 'h': C}, 'sourceSize': {'w': C, 'h': C}}
    sheet.save(os.path.join(OUT, 'uiicons.png'), optimize=True)
    json.dump({'frames': frames, 'meta': {'image': 'uiicons.png', 'size': {'w': sheet.width, 'h': sheet.height}, 'scale': 1}}, open(os.path.join(OUT, 'uiicons.json'), 'w'))
    # önizleme (QA)
    print('uiicons:', len(names), 'kare,', sheet.size)


if __name__ == '__main__':
    main()
