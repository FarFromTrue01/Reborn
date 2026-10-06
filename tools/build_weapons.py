#!/usr/bin/env python3
"""
Joseph'in silah katmanları (Grup 4B).

Universal-LPC-Spritesheet-Character-Generator deposundan (sanderfrenken) kılıç/sopa sayfalarını
alır, Joseph'in klasik LPC düzenine (832x1344, 64 px kare) uyarlar ve oyun için şunları üretir
(hepsi assets/gfx/chars/joseph/ altında):

  - Elde taşıma katmanları (64 px, klasik satırlar): w_stick, w_stick_cracked, w_arming_rusty(_bg),
    w_arming_steel(_bg). Sopa yürüme kareleri eski w_club (çekiç) karelerinden yeniden çizilir:
    metal kafa kalkar, sap uca doğru kalınlaşan ahşap bir sopaya dönüşür.
  - Büyük kare katmanlar: saldırı (slash) sayfaları 128/192 px, pala yürüme sayfası 128 px.
    Büyük karenin merkezi, karakterin 64 px karesinin merkeziyle çakışır (LPC jeneratörü mantığı).
  - Taşıma (sırt/bel) katmanları: <silah>_carry.png (önde) ve <silah>_carry_bg.png (arkada),
    walk (8–11), spellcast (0–3) ve hurt (20, ilk 3 kare) satırlarında; gövdenin salınımını izler.
  - Tek parça silah görüntüsü <silah>_item.png ve weapons.json (tutma noktası, yöne göre
    sırttaki konum/açı) — sırta koyma/çekme animasyonunda havada süzülen silah için.

Kullanım:  python3 tools/build_weapons.py <lpc-repo-klasoru>
"""
import json, os, sys, math, subprocess
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JD = os.path.join(ROOT, 'assets', 'gfx', 'chars', 'joseph')
CACHE = os.path.join(ROOT, 'tools', '.cache', 'lpc')
REPO = sys.argv[1] if len(sys.argv) > 1 else None
W, H, F = 832, 1344, 64
DIRS = ['up', 'left', 'down', 'right']


# ----------------------------------------------------------------------------- yardımcılar
def fetch(path):
    """spritesheets/... PNG'si (seyrek/blobless klonda git show ile; önbellekli)."""
    cp = os.path.join(CACHE, path)
    if not os.path.exists(cp):
        os.makedirs(os.path.dirname(cp), exist_ok=True)
        src = os.path.join(REPO, path)
        if os.path.exists(src):
            data = open(src, 'rb').read()
        else:
            r = subprocess.run(['git', '-C', REPO, 'show', 'HEAD:' + path], capture_output=True)
            if r.returncode != 0:
                raise SystemExit('bulunamadı: ' + path)
            data = r.stdout
        open(cp, 'wb').write(data)
    return Image.open(cp).convert('RGBA')


def joseph(name):
    return Image.open(os.path.join(JD, name)).convert('RGBA')


def save(img, name):
    img.save(os.path.join(JD, name), optimize=True)
    print('  ', name, img.size)


def recolor(img, mapping):
    """Paleti eşleme tablosuyla değiştirir (alfa korunur)."""
    out = img.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            p = px[x, y]
            if p[3] == 0:
                continue
            q = mapping.get(p[:3])
            if q:
                px[x, y] = q + (p[3],)
    return out


def crop_frame(sheet, row, col, size=F):
    return sheet.crop((col * size, row * size, col * size + size, row * size + size))


# ----------------------------------------------------------------------------- paletler
# Sopa: LPC club (bluecarrot16) tonları; yürüme kareleri de aynı tonlarla çizilir.
WOOD = {'out': (43, 28, 29), 'dark': (72, 36, 33), 'base': (98, 53, 28), 'mid': (143, 80, 48),
        'light': (157, 102, 57), 'hi': (170, 133, 80)}
# Çatlak Sopa: kurumuş, açık renkli, grileşmiş ahşap.
WOOD_CRACKED = {'out': (46, 36, 32), 'dark': (92, 70, 54), 'base': (128, 101, 72), 'mid': (163, 133, 96),
                'light': (179, 152, 112), 'hi': (199, 180, 140)}
CRACKED_MAP = {WOOD[k]: WOOD_CRACKED[k] for k in WOOD}

# Paslı kısa kılıç: arming/iron tonları pas rengine kayar (parlaklık korunur).
def rust_map(src):
    out = {}
    for c in src:
        r, g, b = c
        lum = 0.3 * r + 0.59 * g + 0.11 * b
        rust = (min(255, lum * 1.18 + 22), lum * 0.92, lum * 0.7)
        k = 0.45
        out[c] = tuple(int(round(c[i] * (1 - k) + rust[i] * k)) for i in range(3))
    return out

# Goblin satırı: pala (scimitar) — mat, kirli demir bıçak; altın kabza yerine koyu deri/kemik.
CLEAVER_MAP = {
    (171, 174, 172): (138, 136, 120), (141, 142, 144): (106, 104, 92), (215, 217, 214): (170, 166, 146),
    (85, 88, 86): (66, 64, 56),
    (228, 172, 38): (120, 84, 52), (141, 104, 17): (78, 52, 34), (237, 224, 117): (150, 112, 70),
    (113, 83, 13): (62, 40, 26),
}


def palette_of(img):
    return {img.getpixel((x, y))[:3] for y in range(img.height) for x in range(img.width) if img.getpixel((x, y))[3] > 0}


# ----------------------------------------------------------------------------- sopa çizimi
def draw_stick(img, gx, gy, ang, length, r0, r1, pal, cracked=False, knots=True):
    """
    Ahşap sopa: (gx,gy) tutma ucu, `ang` derece (ekran, saat yönü) uç yönü, uca doğru r0 → r1 kalınlaşır,
    uç yuvarlak. Piksel merkezlerine göre doldurur, dış hat ekler; ışık üst-soldan.
    Çatlak: ortadan boydan boya koyu çizgi. Budak: gölge tarafında tek koyu piksel.
    """
    ux, uy = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    nx, ny = -uy, ux  # dik
    lit = 1 if (nx * -0.6 + ny * -0.8) > 0 else -1  # +d tarafı ışığa bakıyorsa 1
    inside = {}
    x0, x1 = int(min(gx, gx + ux * length) - r1 - 3), int(max(gx, gx + ux * length) + r1 + 3)
    y0, y1 = int(min(gy, gy + uy * length) - r1 - 3), int(max(gy, gy + uy * length) + r1 + 3)
    rad = lambda t: r0 + (r1 - r0) * max(0.0, min(1.0, t / length)) ** 1.4
    ex, ey = gx + ux * length, gy + uy * length
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            px, py = x + 0.5 - gx, y + 0.5 - gy
            t = px * ux + py * uy
            d = px * nx + py * ny
            if t < -0.3:
                continue
            if t > length:
                if (x + 0.5 - ex) ** 2 + (y + 0.5 - ey) ** 2 > (r1 * 0.95) ** 2:
                    continue
                r = r1
            else:
                r = rad(t)
                if abs(d) >= r - 0.02:
                    continue
            side = lit * d / max(r, 0.01)  # >0: ışık tarafı
            if side > 0.4:
                c = pal['hi'] if r > 1.5 else pal['light']
            elif side > -0.3:
                c = pal['mid']
            else:
                c = pal['base']
            tt = t / length
            if cracked and r > 0.9 and 0.12 < tt:
                # 0.8.0 (D7): boydan boya zikzak çatlak (dış hat tonunda, koyu) ve yanında açık kıymık; uçta yarık
                z = 0.45 if int(t / 3) % 2 == 0 else -0.45
                if t > length - 1.5 and abs(d) < 0.7:
                    continue  # yarık: kalın uç ikiye ayrılmış
                if abs(d - z) < 0.55:
                    c = pal['out']
                elif 0.55 <= (d - z) * lit < 1.4:
                    c = pal['hi']
            inside[(x, y)] = c
    if knots and not cracked:
        for tk in (0.5, 0.8):
            t = tk * length
            r = rad(t)
            kx, ky = gx + ux * t - nx * lit * r * 0.45, gy + uy * t - ny * lit * r * 0.45
            k = (int(kx), int(ky))
            if k in inside:
                inside[k] = pal['dark']
    px = img.load()
    for (x, y), c in inside.items():
        if 0 <= x < img.width and 0 <= y < img.height:
            px[x, y] = c + (255,)
    for (x, y) in inside:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if q not in inside and 0 <= q[0] < img.width and 0 <= q[1] < img.height:
                px[q[0], q[1]] = pal['out'] + (255,)


HAMMER_HANDLE = {(98, 53, 28), (65, 30, 5)}
HAMMER_HEAD = {(138, 170, 171), (74, 80, 87), (134, 126, 127), (129, 139, 139), (114, 107, 126)}


def stick_walk_layer(pal, cracked):
    """w_club (çekiç) yürüme karelerinden ahşap sopa: tutma ucu ve yön çekiçten okunur."""
    src = joseph('w_club.png')
    out = Image.new('RGBA', (W, H))
    for row in range(8, 12):
        for col in range(9):
            fr = crop_frame(src, row, col)
            handle, head = [], []
            for y in range(F):
                for x in range(F):
                    p = fr.getpixel((x, y))
                    if p[3] < 200:
                        continue
                    if p[:3] in HAMMER_HANDLE:
                        handle.append((x, y))
                    elif p[:3] in HAMMER_HEAD:
                        head.append((x, y))
            cell = Image.new('RGBA', (F, F))
            if handle and len(head) >= 6:
                hx = sum(p[0] for p in head) / len(head) + 0.5
                hy = sum(p[1] for p in head) / len(head) + 0.5
                g = max(handle, key=lambda p: (p[0] + 0.5 - hx) ** 2 + (p[1] + 0.5 - hy) ** 2)
                gx, gy = g[0] + 0.5, g[1] + 0.5
                L = math.hypot(hx - gx, hy - gy)
                ang = math.degrees(math.atan2(hy - gy, hx - gx))
                draw_stick(cell, gx - math.cos(math.radians(ang)), gy - math.sin(math.radians(ang)), ang, L + 2, 0.8, 2.0, pal, cracked)
            elif handle:
                # kafa görünmüyor (sırttan bakış): sapın yalnızca boyası değişir
                for (x, y) in handle:
                    p = fr.getpixel((x, y))
                    cell.putpixel((x, y), (pal['mid'] if p[:3] == (98, 53, 28) else pal['base']) + (255,))
                for y in range(F):
                    for x in range(F):
                        p = fr.getpixel((x, y))
                        if p[3] > 200 and p[:3] == (29, 19, 30):
                            near = any((x + a, y + b) in set(handle) for a in (-1, 0, 1) for b in (-1, 0, 1))
                            if near:
                                cell.putpixel((x, y), pal['out'] + (255,))
            out.alpha_composite(cell, (col * F, row * F))
    return out


# ----------------------------------------------------------------------------- dönen sprite (RotSprite benzeri)
def scale2x(img):
    w, h = img.size
    src = img.load()
    out = Image.new('RGBA', (w * 2, h * 2))
    o = out.load()
    for y in range(h):
        for x in range(w):
            P = src[x, y]
            A = src[x, y - 1] if y > 0 else P
            B = src[x + 1, y] if x < w - 1 else P
            C = src[x - 1, y] if x > 0 else P
            D = src[x, y + 1] if y < h - 1 else P
            e0 = C if (C == A and C != D and A != B) else P
            e1 = A if (A == B and A != C and B != D) else P
            e2 = C if (D == C and D != B and C != A) else P
            e3 = B if (B == D and B != A and D != C) else P
            o[2 * x, 2 * y] = e0
            o[2 * x + 1, 2 * y] = e1
            o[2 * x, 2 * y + 1] = e2
            o[2 * x + 1, 2 * y + 1] = e3
    return out


_rot_cache = {}


def rotated(item, pivot, deg):
    """item'i pivot etrafında `deg` (ekran, saat yönü) döndürür; pivot ortada olan kare tuval döner."""
    key = (id(item), pivot, round(deg, 1))
    if key in _rot_cache:
        return _rot_cache[key]
    R = int(math.ceil(max(math.hypot(pivot[0] - x, pivot[1] - y) for x in (0, item.width) for y in (0, item.height)))) + 2
    S = 2 * R
    canvas = Image.new('RGBA', (S, S))
    canvas.alpha_composite(item, (R - int(pivot[0]), R - int(pivot[1])))
    big = scale2x(scale2x(scale2x(canvas)))
    big = big.rotate(-deg, resample=Image.NEAREST, center=(R * 8, R * 8))
    small = Image.new('RGBA', (S, S))
    bp, sp = big.load(), small.load()
    for y in range(S):
        for x in range(S):
            sp[x, y] = bp[x * 8 + 4, y * 8 + 4]
    _rot_cache[key] = (small, R)
    return small, R


# ----------------------------------------------------------------------------- silah görüntüsü (item)
def extract_item(sheet, row, col, size=F, largest=False):
    """Tek karedeki silahı alır (saydam kenarlar kırpılır); `largest`: yalnızca en büyük parça (ok vb. atılır)."""
    fr = crop_frame(sheet, row, col, size)
    if largest:
        px = fr.load()
        seen, best = set(), []
        for y in range(size):
            for x in range(size):
                if px[x, y][3] == 0 or (x, y) in seen:
                    continue
                comp, stack = [], [(x, y)]
                seen.add((x, y))
                while stack:
                    cx, cy = stack.pop()
                    comp.append((cx, cy))
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            q = (cx + dx, cy + dy)
                            if 0 <= q[0] < size and 0 <= q[1] < size and q not in seen and px[q][3] > 0:
                                seen.add(q)
                                stack.append(q)
                if len(comp) > len(best):
                    best = comp
        keep = set(best)
        for y in range(size):
            for x in range(size):
                if (x, y) not in keep:
                    px[x, y] = (0, 0, 0, 0)
    bb = fr.getchannel('A').getbbox()
    return fr.crop(bb)


def far_end(item, pivot):
    best, bd = None, -1
    for y in range(item.height):
        for x in range(item.width):
            if item.getpixel((x, y))[3] > 0:
                d = (x + 0.5 - pivot[0]) ** 2 + (y + 0.5 - pivot[1]) ** 2
                if d > bd:
                    bd, best = d, (x + 0.5, y + 0.5)
    return best


# ----------------------------------------------------------------------------- taşıma (sırt / bel)
# Konumlar 64 px karede, tutma noktası (kabza) için. Açı: ucun yönü (ekran, saat yönü; 0 = sağ, 90 = aşağı).
# 'front': True → önde çizilen katman (z yüksek), False → gövdenin arkasında (z düşük).
CARRY = {
    'back': {
        'up': {'x': 40, 'y': 33, 'a': 122, 'front': True},
        'down': {'x': 21, 'y': 28, 'a': 50, 'front': False},
        # 0.8.0 (D5): yandan sırta daha yakın (eskiden 58° / 122°: dışa açılı)
        'left': {'x': 41, 'y': 28, 'a': 80, 'front': False},
        'right': {'x': 23, 'y': 28, 'a': 100, 'front': False},
    },
    'hip': {
        'up': {'x': 23, 'y': 45, 'a': 104, 'front': True},
        'down': {'x': 41, 'y': 45, 'a': 76, 'front': True},
        'left': {'x': 31, 'y': 44, 'a': 72, 'front': True},
        # 0.8.0 (D5): sağa bakarken belin arka kenarında, bıçağı silüetin dışına taşar (eskiden tamamen gizliydi)
        'right': {'x': 24, 'y': 44, 'a': 128, 'front': False},
    },
}
# Uzun silahlarda (mızrak, yay) tutma noktası silahın ortasıdır; sırtta da ortası omuz hizasına gelir.
# Sağ yön, sol yönün aynası (`flip`): yayın kavisi iki yanda da sırta doğru.
CARRY_LONG = {
    'up': {'x': 32, 'y': 38, 'a': -58, 'front': True},
    'down': {'x': 32, 'y': 38, 'a': -122, 'front': False},
    # 0.8.0 (D5): yandan sap başın arkasından geçer (eskiden başın arka kenarına yapışık, yüzü kesiyor gibiydi)
    'left': {'x': 42, 'y': 38, 'a': -62, 'front': False},
    'right': {'x': 22, 'y': 38, 'a': -118, 'front': False, 'flip': True},
}


ROT_STEPS, ROT_CELL = 32, 80


def rot_sheet(item, pivot, base_ang):
    """Süzülen silah için önceden döndürülmüş kareler: k. karede uç k·360/32 derece yönünde, tutma noktası karenin ortasında."""
    out = Image.new('RGBA', (ROT_CELL * 8, ROT_CELL * (ROT_STEPS // 8)))
    for k in range(ROT_STEPS):
        spr, R = rotated(item, pivot, k * 360 / ROT_STEPS - base_ang)
        cell = Image.new('RGBA', (ROT_CELL, ROT_CELL))
        cell.alpha_composite(spr, (ROT_CELL // 2 - R, ROT_CELL // 2 - R)) if R <= ROT_CELL // 2 else \
            cell.alpha_composite(spr.crop((R - ROT_CELL // 2, R - ROT_CELL // 2, R + ROT_CELL // 2, R + ROT_CELL // 2)))
        out.alpha_composite(cell, ((k % 8) * ROT_CELL, (k // 8) * ROT_CELL))
    return out


def head_anchor(head, row, col):
    bb = crop_frame(head, row, col).getchannel('A').getbbox()
    if not bb:
        return (32.0, 20.0)
    return ((bb[0] + bb[2]) / 2, bb[1])


def carry_layers(item, pivot, base_ang, place, sway=0.0):
    """Taşıma katmanları (ön, arka). Gövde salınımı başın konumundan okunur."""
    head = joseph('head.png')
    mirrored = ImageOps.mirror(item)
    fg = Image.new('RGBA', (W, H))
    bg = Image.new('RGBA', (W, H))
    rows = []
    for di, d in enumerate(DIRS):
        rows.append((8 + di, d, 9, (8 + di, 0)))   # walk / idle / koşu
        rows.append((0 + di, d, 7, (8 + di, 0)))   # spellcast (büyü sırasında da sırtta)
    rows.append((20, 'down', 3, (10, 0)))           # hurt / selam (hep aşağı bakar)
    for row, d, n, ref in rows:
        p = place[d]
        rx, ry = head_anchor(head, *ref)
        for col in range(n):
            hx, hy = head_anchor(head, row, col)
            dx, dy = round(hx - rx), round(hy - ry)
            if row == 20:
                dx = 0
            a = p['a']
            if row >= 8 and row <= 11 and col > 0 and sway:
                a += sway * math.sin((col - 1) / 8 * 2 * math.pi)
            if p.get('flip'):
                # ayna: öğe yatay çevrilir, açı da aynalanır (−90° dik eksene göre)
                spr, R = rotated(mirrored, (item.width - pivot[0], pivot[1]), a - (180 - base_ang))
            else:
                spr, R = rotated(item, pivot, a - base_ang)
            dst = fg if p['front'] else bg
            cell = Image.new('RGBA', (F + 2 * R, F + 2 * R))
            cell.alpha_composite(spr, (int(p['x'] + dx), int(p['y'] + dy)))
            dst.alpha_composite(cell.crop((R, R, R + F, R + F)), (col * F, row * F))
    return fg, bg


# ----------------------------------------------------------------------------- elde yürüme (0.8.0, D2)
def walk_grips():
    """Yürüme karelerinde elin (tutma noktasının) yeri: w_club (çekiç) karelerinden. {(row, col): (x, y)} — 64 px kare."""
    src = joseph('w_club.png')
    body = joseph('body.png')
    out = {}
    for row in range(8, 12):
        for col in range(9):
            fr = crop_frame(src, row, col)
            handle, head = [], []
            for y in range(F):
                for x in range(F):
                    p = fr.getpixel((x, y))
                    if p[3] < 200:
                        continue
                    if p[:3] in HAMMER_HANDLE:
                        handle.append((x, y))
                    elif p[:3] in HAMMER_HEAD:
                        head.append((x, y))
            if not handle:
                continue
            # el: sapın deriye (gövde katmanında, dış hat değil) değen pikselleri
            bf = crop_frame(body, row, col)
            def on_hand(p):
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        x, y = p[0] + dx, p[1] + dy
                        if 0 <= x < F and 0 <= y < F:
                            q = bf.getpixel((x, y))
                            if q[3] > 0 and q[:3] not in BODY_OUTLINE:
                                return True
                return False
            touch = [p for p in handle if on_hand(p)] or handle
            if len(head) >= 6:
                hx = sum(p[0] for p in head) / len(head)
                hy = sum(p[1] for p in head) / len(head)
                g = max(touch, key=lambda p: (p[0] - hx) ** 2 + (p[1] - hy) ** 2)
            else:
                # kafa görünmüyor (sırttan): sapın gövdeye en yakın ucu
                g = min(touch, key=lambda p: abs(p[0] - 32))
            out[(row, col)] = (g[0] + 0.5, g[1] + 0.5)
    return out


BODY_OUTLINE = {(39, 25, 32), (80, 55, 52)}

# Elde yürüme açıları (uç yönü, ekran, saat yönü; −90 = yukarı) ve katman (önde mi). Yukarı bakarken gövdenin arkasında.
HAND_WALK = {
    # mızrak dik (tam 90°: ince sap döndürmede kopmaz)
    'spear': {'up': (-90, False), 'left': (-90, True), 'down': (-90, True), 'right': (-90, True)},
    # yay yanda; yandan bakışta hafif öne eğik ve gövdenin arkasında (yüzün önünden geçmez)
    'bow': {'up': (-90, False), 'left': (-100, False), 'down': (-90, True), 'right': (-80, False)},
}


def hand_walk_sheet(item, pivot, base_ang, angles, size=128, sway=2.0):
    """Savaşta elde taşınan yürüme görünümü: silah her karede elin yerinde (walk_grips), verilen açıyla. Büyük kare
    sayfası (size px, 9 sütun, 4 yön satırı; merkez 64 px karenin merkezi)."""
    grips = walk_grips()
    off = (size - F) // 2
    fg = Image.new('RGBA', (size * 9, size * 4))
    bg = Image.new('RGBA', (size * 9, size * 4))
    for di, d in enumerate(DIRS):
        a0, front = angles[d]
        for col in range(9):
            g = grips.get((8 + di, col)) or grips.get((8 + di, 0))
            if not g:
                continue
            a = a0 + (sway * math.sin((col - 1) / 8 * 2 * math.pi) if col > 0 and sway else 0)
            spr, R = rotated(item, pivot, a - base_ang)
            cell = Image.new('RGBA', (size, size))
            cell.alpha_composite(spr, (int(off + g[0] - R), int(off + g[1] - R)))
            (fg if front else bg).alpha_composite(cell, (col * size, di * size))
    return fg, bg


# ----------------------------------------------------------------------------- hançer: yukarı saplama (0.8.0, D3)
def dagger_thrust_up(item, pivot, base_ang):
    """LPC hançerinde yukarı saplama (satır 4) hiç çizilmemiş: hançer hiç görünmüyordu. El sağ omzun dışında; saplamada
    bıçak dik, omuz hizasından başın yanında yükselir (gövdenin arkasında çizilir), hazırlanmada alçakta ve öne eğik."""
    body = joseph('body.png')
    head = joseph('head.png')
    layer = Image.new('RGBA', (F * 8, F))
    for col in range(8):
        bb = crop_frame(body, 4, col).getchannel('A').getbbox()
        hb = crop_frame(head, 4, col).getchannel('A').getbbox()
        # el sağ omzun dışında: bıçak başın yanından görünür (gövdenin arkasında çizilir, silüete girmez)
        gx = max(bb[2], hb[2]) + 0.5
        if col <= 2:
            gx, gy, ang = bb[2] - 0.5, bb[1] + 12 - col * 2, -90 + 30 - col * 10   # hazırlanma: alçakta, öne eğik
        else:
            gy, ang = bb[1] + 4, -90                                               # saplama: dik, omuz hizasından
        spr, R = rotated(item, pivot, ang - base_ang)
        cell = Image.new('RGBA', (F + 2 * R, F + 2 * R))
        cell.alpha_composite(spr, (int(gx), int(gy)))
        layer.alpha_composite(cell.crop((R, R, R + F, R + F)), (col * F, 0))
    return layer


# ----------------------------------------------------------------------------- büyük kareler
def big_sheet(src, size, frames, rows=4):
    """LPC jeneratörünün özel animasyon sayfası (size px kare, frames sütun, 4 yön)."""
    return src.crop((0, 0, size * frames, size * rows))


# 0.8.0 (D1): arming kılıç saldırı sayfası LPC'nin kollu yeni gövdesi için çizilmiş; Joseph'in klasik slash'inde
# geriye çekiş karelerinde kabza ele 1–2 piksel oturmuyordu. Yön (0 yukarı, 1 sol, 2 aşağı, 3 sağ) → kare → (dx, dy).
ARMING_SLASH_OFFSET = {
    0: {1: (1, -1)},
    1: {0: (1, 0), 1: (0, -2), 2: (0, -1)},
    2: {0: (0, -1), 1: (0, -1)},
    3: {1: (0, -2), 2: (0, -1)},
}


def shift_cells(sheet, size, offsets):
    """Büyük kare sayfasında tek tek kareleri kaydırır (kare dışına taşan kırpılır)."""
    out = sheet.copy()
    for d, frames in offsets.items():
        for c, (dx, dy) in frames.items():
            box = (c * size, d * size, (c + 1) * size, (d + 1) * size)
            cell = sheet.crop(box)
            moved = Image.new('RGBA', (size, size))
            moved.alpha_composite(cell.crop((max(0, -dx), max(0, -dy), size - max(0, dx), size - max(0, dy))), (max(0, dx), max(0, dy)))
            out.paste(moved, box[:2])
    return out


def move_row(fg, bg, row, size):
    """fg sayfasındaki bir yön satırını arka katmana taşır (sırtı dönükken silah gövdenin arkasında)."""
    band = fg.crop((0, row * size, fg.width, (row + 1) * size))
    bg = bg.copy()
    bg.alpha_composite(band, (0, row * size))
    fg = fg.copy()
    fg.paste(Image.new('RGBA', band.size), (0, row * size))
    return fg, bg


def main():
    if not REPO:
        print(__doc__)
        sys.exit(1)
    meta = {}
    S = 'spritesheets/weapon/'

    # ------------------------------------------------------------- sopalar
    print('sopa')
    club = fetch(S + 'blunt/club/club.png')
    club_bg = fetch(S + 'blunt/club/background/club.png')
    for name, pal, cracked in (('w_stick', WOOD, False), ('w_stick_cracked', WOOD_CRACKED, True)):
        save(stick_walk_layer(pal, cracked), name + '.png')
        atk, atk_bg = big_sheet(club, 192, 6), big_sheet(club_bg, 192, 6)
        if cracked:
            atk, atk_bg = recolor(atk, CRACKED_MAP), recolor(atk_bg, CRACKED_MAP)
        save(atk, name + '_atk.png')
        save(atk_bg, name + '_atk_bg.png')
        item = Image.new('RGBA', (30, 9))
        draw_stick(item, 1.5, 4.5, 0, 23, 0.8, 2.0, pal, cracked)
        item = item.crop(item.getchannel('A').getbbox())
        pivot = (2.5, item.height / 2)
        fg, bg = carry_layers(item, pivot, 0, CARRY['back'])
        save(fg, name + '_carry.png')
        save(bg, name + '_carry_bg.png')
        save(rot_sheet(item, pivot, 0), name + '_item.png')
        meta[name] = {'item': {'px': pivot[0], 'py': pivot[1], 'a': 0}, 'carry': CARRY['back']}

    # ------------------------------------------------------------- arming (kısa kılıçlar)
    print('arming')
    for name, variant, cmap in (('w_arming_rusty', 'steel', 'rust'), ('w_arming_steel', 'steel', None)):
        uf = fetch(S + f'sword/arming/universal/fg/{variant}.png').crop((0, 0, W, H))
        ub = fetch(S + f'sword/arming/universal/bg/{variant}.png').crop((0, 0, W, H))
        af = shift_cells(big_sheet(fetch(S + f'sword/arming/attack_slash/fg/{variant}.png'), 128, 6), 128, ARMING_SLASH_OFFSET)
        ab = shift_cells(big_sheet(fetch(S + f'sword/arming/attack_slash/bg/{variant}.png'), 128, 6), 128, ARMING_SLASH_OFFSET)
        if cmap == 'rust':
            # savurma izi (açık bej/beyaz) pas tonuna boyanmasın
            trail = {(196, 181, 159), (255, 255, 255)}
            m = rust_map(palette_of(uf) | palette_of(ub) | (palette_of(af) - trail) | (palette_of(ab) - trail))
            uf, ub, af, ab = (recolor(i, m) for i in (uf, ub, af, ab))
        save(uf, name + '.png')
        save(ub, name + '_bg.png')
        save(af, name + '_atk.png')
        save(ab, name + '_atk_bg.png')
        # silah görüntüsü: sağa yürürken yatay duran kılıç (satır 11, kare 7)
        item = extract_item(uf, 11, 7)
        pivot = (2.5, item.height / 2)
        tip = far_end(item, pivot)
        base = math.degrees(math.atan2(tip[1] - pivot[1], tip[0] - pivot[0]))
        fg, bg = carry_layers(item, pivot, base, CARRY['back'])
        save(fg, name + '_carry.png')
        save(bg, name + '_carry_bg.png')
        save(rot_sheet(item, pivot, base), name + '_item.png')
        meta[name] = {'item': {'px': pivot[0], 'py': pivot[1], 'a': round(base, 1)}, 'carry': CARRY['back']}

    # ------------------------------------------------------------- goblin satırı (pala)
    print('pala')
    wf = fetch(S + 'sword/scimitar/walk/scimitar.png')
    wb = fetch(S + 'sword/scimitar/walk/behind/scimitar.png')
    sf = big_sheet(fetch(S + 'sword/scimitar/slash/scimitar.png'), 128, 6)
    sb = big_sheet(fetch(S + 'sword/scimitar/slash/behind/scimitar.png'), 128, 6)
    wf, wb, sf, sb = (recolor(i, CLEAVER_MAP) for i in (wf, wb, sf, sb))
    wf, wb = big_sheet(wf, 128, 9), big_sheet(wb, 128, 9)
    save(wf, 'w_cleaver_walk.png')
    save(wb, 'w_cleaver_walk_bg.png')
    save(sf, 'w_cleaver_atk.png')
    save(sb, 'w_cleaver_atk_bg.png')
    item = extract_item(wb, 3, 0, 128)  # sağa yürürken (arka katmanda)
    # kabza: sarı/kahverengi deri tonlarının ortası
    grip = [(x, y) for y in range(item.height) for x in range(item.width)
            if item.getpixel((x, y))[3] > 0 and item.getpixel((x, y))[:3] in {(120, 84, 52), (78, 52, 34), (150, 112, 70), (62, 40, 26)}]
    gx = min(p[0] for p in grip) + 1.5
    gy = sum(p[1] for p in grip) / len(grip) + 0.5
    pivot = (gx, gy)
    tip = far_end(item, pivot)
    base = math.degrees(math.atan2(tip[1] - pivot[1], tip[0] - pivot[0]))
    fg, bg = carry_layers(item, pivot, base, CARRY['back'])
    save(fg, 'w_cleaver_carry.png')
    save(bg, 'w_cleaver_carry_bg.png')
    save(rot_sheet(item, pivot, base), 'w_cleaver_item.png')
    meta['w_cleaver'] = {'item': {'px': round(pivot[0], 1), 'py': round(pivot[1], 1), 'a': round(base, 1)}, 'carry': CARRY['back']}

    # ------------------------------------------------------------- mevcut silahlar: hançer, mızrak, yay
    print('hançer, mızrak, yay')
    dag = joseph('w_dagger.png')
    item = extract_item(dag, 11, 0)  # sağa bakarken elde
    pivot = (1.5, item.height - 1.5) if item.height > item.width else (1.5, item.height / 2)
    tip = far_end(item, pivot)
    base = math.degrees(math.atan2(tip[1] - pivot[1], tip[0] - pivot[0]))
    fg, bg = carry_layers(item, pivot, base, CARRY['hip'], sway=4)
    save(fg, 'w_dagger_carry.png')
    save(bg, 'w_dagger_carry_bg.png')
    save(rot_sheet(item, pivot, base), 'w_dagger_item.png')
    meta['w_dagger'] = {'item': {'px': pivot[0], 'py': pivot[1], 'a': round(base, 1)}, 'carry': CARRY['hip']}
    # yukarı saplama satırı (arka katman): LPC'de boş
    dbg = joseph('w_dagger_bg.png')
    dbg.paste(Image.new('RGBA', (W, F)), (0, 4 * F))
    dbg.alpha_composite(dagger_thrust_up(item, pivot, base), (0, 4 * F))
    save(dbg, 'w_dagger_bg.png')

    spear = Image.alpha_composite(joseph('w_spear_bg.png'), joseph('w_spear.png'))
    item = extract_item(spear, 7, 4)  # sağa saplama: yatay mızrak
    pivot = (item.width / 2, item.height / 2)
    fg, bg = carry_layers(item, pivot, 0, CARRY_LONG)
    save(fg, 'w_spear_carry.png')
    save(bg, 'w_spear_carry_bg.png')
    save(rot_sheet(item, pivot, 0), 'w_spear_item.png')
    meta['w_spear'] = {'item': {'px': pivot[0], 'py': pivot[1], 'a': 0}, 'carry': CARRY_LONG}
    # elde yürüme: dik, sapın dipten %35'inden tutulur (uç sağda: dip solda)
    wf, wb = hand_walk_sheet(item, (item.width * 0.35, item.height / 2), 0, HAND_WALK['spear'], sway=0)
    save(wf, 'w_spear_walk.png')
    save(wb, 'w_spear_walk_bg.png')

    bow = Image.alpha_composite(joseph('w_bow_bg.png'), joseph('w_bow.png'))
    item = extract_item(bow, 19, 12, largest=True)  # sağa atış sonrası: dik yay, ok yok
    pivot = (item.width / 2, item.height / 2)
    fg, bg = carry_layers(item, pivot, -90, CARRY_LONG)
    save(fg, 'w_bow_carry.png')
    save(bg, 'w_bow_carry_bg.png')
    save(rot_sheet(item, pivot, -90), 'w_bow_item.png')
    # elde yürüme: yay yanda, dik, ortasından tutulur
    wf, wb = hand_walk_sheet(item, pivot, -90, HAND_WALK['bow'])
    save(wf, 'w_bow_walk.png')
    save(wb, 'w_bow_walk_bg.png')
    meta['w_bow'] = {'item': {'px': pivot[0], 'py': pivot[1], 'a': -90}, 'carry': CARRY_LONG}

    for m in meta.values():
        m['rot'] = {'steps': ROT_STEPS, 'cell': ROT_CELL}
    with open(os.path.join(JD, 'weapons.json'), 'w') as f:
        json.dump(meta, f, indent=1)

    # ------------------------------------------------------------- krediler
    credits = []
    for d in ('weapon_blunt_club', 'weapon_sword_arming', 'weapon_sword_scimitar'):
        credits += json.load(open(os.path.join(REPO, 'sheet_definitions', d + '.json')))['credits']
    with open(os.path.join(ROOT, 'tools', 'credits_weapons.json'), 'w') as f:
        json.dump(credits, f, indent=1, ensure_ascii=False)
    print('tamam:', len(meta), 'silah görseli,', len(credits), 'kredi kaydı')


if __name__ == '__main__':
    main()
