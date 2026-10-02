#!/usr/bin/env python3
"""
Dekor (prop) atlası: ağaçlar, kayalar, köy eşyaları, iç mekân mobilyaları.
Kaba dikdörtgenler alfa sınırlarına sıkıştırılır ve tek bir atlasa paketlenir.

Çıktı: assets/gfx/props.png + props.json (Phaser JSON Hash)
"""
import os, sys, json
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = os.path.join(ROOT, 'tools', '.cache', 'oga')
OUT = os.path.join(ROOT, 'assets', 'gfx')

_src = {}


def src(name):
    if name not in _src:
        p = {
            'trees': 'lpc-trees/lpc-trees/trees-green.png',
            'trees_pale': 'lpc-trees/lpc-trees/trees-pale.png',
            'trees_dead': 'lpc-trees/lpc-trees/trees-dead.png',
            'terrain': 'atlas1/terrain_atlas.png',
            'base': 'atlas1/base_out_atlas.png',
            'build': 'atlas2/build_atlas.png',
            'misc': 'atlas2/obj_misk_atlas.png',
            'deco': 'decoration_medieval/decoration_medieval/decorations-medieval.png',
            'int': 'LPC_house_interior_0/LPC_house_interior/interior.png',
            'smith': 'lpc-blacksmith/lpc-blacksmith/blacksmith-smelter.png',
            'food': 'lpc-food-v1/lpc-food-v1/food.png',
            'flames': 'flames_0.png',
            'fire': 'WaterAndFire_1.png',
        }[name]
        im = Image.open(os.path.join(S, p)).convert('RGBA')
        if name == 'deco':
            # kaynak sayfadaki yarı saydam sarı yer tutucu blokları temizle
            px = im.load()
            for y in range(im.height):
                for x in range(im.width):
                    r, g, b, a = px[x, y]
                    if r == 225 and g == 215 and b == 0:
                        px[x, y] = (0, 0, 0, 0)
        _src[name] = im
    return _src[name]


def tight(name, box, pad=0):
    im = src(name).crop(box)
    bb = im.getbbox()
    if not bb:
        raise ValueError(f'boş: {name} {box}')
    return im.crop((max(0, bb[0] - pad), max(0, bb[1] - pad), bb[2] + pad, bb[3] + pad))


def raw(name, box):
    return src(name).crop(box)


D2 = 1024  # deco ikinci yarısının y ofseti

PROPS = {
    # ------------------------------------------------ ağaçlar
    'tree_round': ('trees', (130, 100, 226, 222)),
    'tree_oak': ('trees', (318, 95, 420, 218)),
    'tree_oak2': ('trees', (420, 95, 545, 222)),
    'tree_leafy': ('trees', (545, 95, 642, 212)),
    'tree_pine_thin': ('trees', (3, 228, 62, 346)),
    'tree_twist': ('trees', (64, 226, 160, 344)),
    'tree_birch': ('trees', (163, 222, 257, 344)),
    'tree_conifer': ('trees', (62, 352, 128, 508)),
    'tree_lolli': ('trees', (128, 350, 225, 494)),
    'bush_big': ('trees', (225, 362, 320, 454)),
    'tree_dense': ('trees', (553, 352, 664, 498)),
    'tree_big_a': ('trees', (300, 510, 468, 704)),
    'tree_big_b': ('trees', (488, 510, 664, 704)),
    'tree_big_c': ('trees', (668, 510, 838, 704)),
    'tree_big_d': ('trees', (835, 522, 996, 708)),
    'tree_round_big': ('trees', (158, 526, 293, 700)),
    'tree_huge': ('trees', (266, 700, 544, 1020)),
    'bush_s1': ('trees', (0, 60, 31, 97)),
    'bush_s2': ('trees', (31, 60, 63, 97)),
    'bush_s3': ('trees', (63, 60, 96, 97)),
    'shrub': ('trees', (196, 0, 252, 62)),
    'tree_pale': ('trees_pale', (130, 100, 226, 222)),
    'tree_pale2': ('trees_pale', (318, 95, 420, 218)),
    'tree_dead': ('trees_dead', (318, 95, 420, 218)),
    'tree_dead2': ('trees_dead', (130, 100, 226, 222)),
    # ------------------------------------------------ doğa
    'boulder': ('terrain', (832, 672, 896, 742)),
    'boulder2': ('terrain', (896, 700, 962, 742)),
    'rock_grey': ('terrain', (864, 736, 930, 800)),
    'rock_small': ('terrain', (830, 800, 866, 834)),
    'rocks_tiny': ('terrain', (866, 800, 930, 834)),
    'mushrooms': ('terrain', (864, 896, 898, 930)),
    'cattail': ('terrain', (832, 928, 866, 994)),
    'amanita': ('terrain', (832, 992, 866, 1024)),
    'stump': ('terrain', (736, 576, 768, 608)),
    'stump_big': ('terrain', (412, 384, 452, 450)),
    'lily1': ('terrain', (192, 960, 224, 992)),
    'lily2': ('terrain', (224, 960, 256, 992)),
    'tree_small': ('terrain', (862, 926, 930, 1024)),
    'tree_med': ('terrain', (928, 896, 1024, 1024)),
    'fern': ('terrain', (416, 576, 448, 640)),
    'sprout': ('terrain', (320, 768, 352, 800)),
    'reeds': ('terrain', (256, 736, 352, 768)),
    'herb_plant': ('terrain', (416, 832, 448, 864)),
    'crop_cabbage': ('terrain', (320, 864, 352, 896)),
    'crop_tomato': ('terrain', (416, 864, 448, 928)),
    'crop_corn': ('terrain', (480, 800, 512, 896)),
    'crop_carrot': ('terrain', (320, 960, 352, 992)),
    'wheat': ('terrain', (256, 512, 384, 640)),
    # ------------------------------------------------ köy
    'sign_sword': ('deco', (226, 4, 254, 32)),
    'sign_inn': ('deco', (257, 37, 286, 65)),
    'sign_mug': ('deco', (226, 37, 254, 65)),
    'sign_book': ('deco', (194, 37, 222, 65)),
    'sign_tools': ('deco', (321, 37, 352, 65)),
    'sign_bag': ('deco', (258, 4, 287, 32)),
    'sign_potion': ('deco', (290, 4, 320, 32)),
    'signpost': ('deco', (192, 126, 224, 192)),
    'signpost2': ('deco', (224, 126, 256, 158)),
    'scarecrow': ('deco', (316, 126, 356, 194)),
    'clothesline': ('deco', (287, 195, 354, 227)),
    'lantern': ('deco', (424, 64, 447, 99)),
    'torch_wall': ('deco', (424, 162, 447, 197)),
    'well': ('deco', (447, 414, 512, 512)),
    'outhouse': ('deco', (356, 354, 409, 445)),
    'fountain': ('deco', (1, 515, 65, 578)),
    'cart': ('deco', (193, 515, 281, 578)),
    'hay_roll': ('deco', (3, 646, 58, 714)),
    'hay_pile': ('deco', (68, 644, 123, 691)),
    'hay_bales': ('deco', (126, 702, 225, 737)),
    'trough': ('deco', (424, 533, 501, 565)),
    'firewood': ('deco', (452, 642, 501, 701)),
    'logpile': ('deco', (351, 653, 386, 691)),
    'chop_block': ('deco', (446, 702, 482, 737)),
    'anvil': ('deco', (457, 768, 501, 798)),
    'woodshed': ('deco', (287, 656, 355, 762)),
    'stool': ('deco', (128, 958, 158, 993)),
    'stall_orange': ('deco', (160, 798, 256, 962)),
    'stall_blue': ('deco', (0, 800, 96, 962)),
    'bench': ('deco', (192, D2 + 65, 255, D2 + 97)),
    'table_out': ('deco', (257, D2 + 63, 317, D2 + 97)),
    'target': ('deco', (140, D2 + 492, 179, D2 + 542)),
    'target_straw': ('deco', (95, D2 + 497, 127, D2 + 545)),
    'cauldron': ('deco', (354, D2 + 543, 383, D2 + 576)),
    'tent_big': ('deco', (243, D2 + 579, 394, D2 + 732)),
    'tent_small': ('deco', (385, D2 + 707, 512, D2 + 865)),
    'wagon': ('deco', (198, D2 + 159, 317, D2 + 358)),
    'weapon_rack_out': ('deco', (0, D2 + 479, 33, D2 + 514)),
    'fence_h': ('deco', (0, 340, 128, 360)),
    'grave': ('deco', (128, 96, 160, 126)),
    # ------------------------------------------------ yapı parçaları
    'door_wood': ('base', (96, 288, 131, 340)),
    'door_wood2': ('base', (157, 288, 193, 340)),
    'window_small': ('base', (226, 288, 257, 318)),
    'window_white': ('base', (254, 292, 292, 342)),
    # ------------------------------------------------ iç mekân
    'bed': ('int', (446, 0, 482, 94)),
    'table_round': ('int', (414, 62, 450, 96)),
    'wardrobe': ('int', (417, 0, 448, 60)),
    'barrels': ('int', (34, 266, 97, 312)),
    'cabinet': ('int', (0, 192, 32, 256)),
    'bookshelf': ('int', (32, 192, 64, 256)),
    'dish_shelf': ('int', (64, 192, 96, 256)),
    'drawers': ('int', (96, 192, 128, 256)),
    'counter': ('int', (128, 208, 160, 256)),
    'shelf_books2': ('int', (160, 208, 192, 256)),
    'shelf_dishes2': ('int', (192, 208, 224, 256)),
    'stove': ('int', (128, 104, 160, 144)),
    'sink': ('int', (64, 104, 96, 144)),
    'kitchen_counter': ('int', (96, 104, 128, 144)),
    'fireplace': ('int', (352, 92, 384, 161)),
    'tavern_table': ('int', (0, 352, 64, 416)),
    'tavern_table2': ('int', (64, 352, 96, 416)),
    'clock': ('int', (40, 318, 57, 354)),
    'weapon_rack': ('int', (192, 256, 224, 320)),
    'armor_stand': ('int', (226, 96, 289, 126)),
    'helm_shelf': ('int', (290, 96, 352, 126)),
    'shield_wall': ('int', (261, 34, 281, 59)),
    'sacks': ('int', (224, 128, 290, 150)),
    'pots': ('int', (320, 64, 352, 96)),
    'chest': ('int', (96, 256, 128, 288)),
    'crate_rack': ('int', (96, 256, 160, 320)),
    'side_table': ('int', (0, 320, 32, 352)),
}

# Animasyonlu: kamp ateşi (5 kare), mum alevi
ANIMS = {
    'campfire': ('deco', [(255 + i * 31, D2 + 475, 255 + i * 31 + 31, D2 + 544) for i in range(5)]),
}


def pack(images):
    """Basit raf paketleme."""
    items = sorted(images.items(), key=lambda kv: -kv[1].height)
    W = 2048
    x = y = 0
    shelf_h = 0
    pos = {}
    for k, im in items:
        if x + im.width + 2 > W:
            x = 0
            y += shelf_h + 2
            shelf_h = 0
        pos[k] = (x, y)
        x += im.width + 2
        shelf_h = max(shelf_h, im.height)
    H = y + shelf_h
    H2 = 1
    while H2 < H:
        H2 *= 2
    sheet = Image.new('RGBA', (W, H2))
    for k, im in images.items():
        sheet.paste(im, pos[k])
    return sheet, pos


def main():
    imgs = {}
    for k, (s, box) in PROPS.items():
        try:
            imgs[k] = tight(s, box)
        except Exception as e:
            print('!', k, e)
    for k, (s, boxes) in ANIMS.items():
        frames = [raw(s, b) for b in boxes]
        # ortak sınır
        bbs = [f.getbbox() for f in frames]
        x0 = min(b[0] for b in bbs if b); y0 = min(b[1] for b in bbs if b)
        x1 = max(b[2] for b in bbs if b); y1 = max(b[3] for b in bbs if b)
        for i, f in enumerate(frames):
            imgs[f'{k}_{i}'] = f.crop((x0, y0, x1, y1))
    sheet, pos = pack(imgs)
    sheet.save(os.path.join(OUT, 'props.png'), optimize=True)
    frames = {k: {'frame': {'x': pos[k][0], 'y': pos[k][1], 'w': im.width, 'h': im.height},
                  'rotated': False, 'trimmed': False,
                  'spriteSourceSize': {'x': 0, 'y': 0, 'w': im.width, 'h': im.height},
                  'sourceSize': {'w': im.width, 'h': im.height}} for k, im in imgs.items()}
    json.dump({'frames': frames, 'meta': {'image': 'props.png', 'size': {'w': sheet.width, 'h': sheet.height}, 'scale': 1}},
              open(os.path.join(OUT, 'props.json'), 'w'))
    # inceleme sayfası
    if '--preview' in sys.argv:
        from PIL import ImageDraw
        bg = Image.new('RGBA', sheet.size, (60, 90, 60, 255)); bg.alpha_composite(sheet)
        d = ImageDraw.Draw(bg)
        for k, (x, y) in pos.items():
            d.rectangle([x, y, x + imgs[k].width - 1, y + imgs[k].height - 1], outline=(255, 0, 0))
            d.text((x + 1, y + 1), k, fill=(255, 255, 0))
        bg.save(sys.argv[sys.argv.index('--preview') + 1])
    print('props:', len(imgs), sheet.size)


if __name__ == '__main__':
    main()
