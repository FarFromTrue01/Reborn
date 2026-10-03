#!/usr/bin/env python3
"""
LPC karakter üretici.

Universal-LPC-Spritesheet-Character-Generator (sanderfrenken) deposundaki
katmanlardan her karakter için 832x1344 (klasik 21 satır: spellcast, thrust,
walk, slash, shoot, hurt) sprite sheet üretir ve kullanılan her dosyanın
lisans/yazar bilgisini toplar.

Kullanım:  python3 tools/lpc_chars.py <lpc-repo-klasoru>
Depo sparse/blobless klonlanmış olabilir; dosyalar `git show` ile çekilir.
"""
import json, os, subprocess, sys, io
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'gfx', 'chars')
CACHE = os.path.join(ROOT, 'tools', '.cache', 'lpc')
W, H = 832, 1344

REPO = sys.argv[1] if len(sys.argv) > 1 else None
_defs = {}
credits_used = {}  # file -> credit dict


def load_def(name):
    if name not in _defs:
        p = os.path.join(REPO, 'sheet_definitions', name + '.json')
        with open(p) as f:
            _defs[name] = json.load(f)
    return _defs[name]


def fetch(path):
    """spritesheets/... yolundaki PNG'yi döndürür (önbellekli)."""
    cp = os.path.join(CACHE, path)
    if not os.path.exists(cp):
        os.makedirs(os.path.dirname(cp), exist_ok=True)
        r = subprocess.run(['git', '-C', REPO, 'show', 'HEAD:' + path], capture_output=True)
        if r.returncode != 0:
            return None
        with open(cp, 'wb') as f:
            f.write(r.stdout)
    im = Image.open(cp).convert('RGBA')
    return im


def norm_variant(v):
    return v.replace(' ', '_')


def record_credit(defname, relpath):
    d = load_def(defname)
    best = None
    for c in d.get('credits', []):
        f = c.get('file', '')
        if relpath.startswith(f) and (best is None or len(f) > len(best.get('file', ''))):
            best = c
    if best:
        credits_used[best['file']] = best


def layers_for(defname, variant, body):
    """(zPos, Image) listesi."""
    d = load_def(defname)
    out = []
    for k in sorted([k for k in d if k.startswith('layer_')]):
        L = d[k]
        if L.get('custom_animation'):
            continue  # büyük boy animasyonlar kullanılmıyor
        base = L.get(body) or L.get('male') or L.get('female')
        if not base:
            continue
        base = base.rstrip('/') + '/'
        cands = [base + norm_variant(variant) + '.png', base + variant + '.png', base.rstrip('/') + '.png']
        im = None
        if defname == 'eyes' and variant == 'black':
            # LPC'de siyah göz yok: kahverengi gözün irisini kömür siyahına boya (D3: Joseph'in gözleri siyah)
            src = fetch('spritesheets/' + base + 'brown.png')
            if src is not None:
                record_credit(defname, base + 'brown.png')
                remap = {(126, 78, 32): (30, 26, 28), (84, 76, 46): (52, 46, 48)}
                px = src.load()
                for yy in range(src.height):
                    for xx in range(src.width):
                        r, g, b, a = px[xx, yy]
                        if a and (r, g, b) in remap:
                            px[xx, yy] = remap[(r, g, b)] + (a,)
                im = src
                cands = []
        for c in cands:
            im = fetch('spritesheets/' + c)
            if im is not None:
                record_credit(defname, c)
                break
        if im is None:
            print('  ! bulunamadı:', defname, variant, base, file=sys.stderr)
            continue
        canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        canvas.paste(im.crop((0, 0, min(W, im.width), min(H, im.height))), (0, 0))
        out.append((float(L.get('zPos', 50)), canvas))
    return out


def check_parts(cid, body, parts):
    """Çocuk gövdesine yalnızca çocuk gövdesini açıkça destekleyen katmanlar takılabilir
    (yetişkin kafasına göre çizilmiş bir saç çocuğun başında havada durur)."""
    if body != 'child':
        return
    for defname, _ in parts:
        d = load_def(defname)
        for k in d:
            if k.startswith('layer_') and not d[k].get('custom_animation') and 'child' not in d[k]:
                raise SystemExit(f'HATA: {cid}: {defname} çocuk gövdesini desteklemiyor (layer {k})')


def compose(body, parts):
    layers = []
    for defname, variant in parts:
        layers += layers_for(defname, variant, body)
    layers.sort(key=lambda t: t[0])
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for _, l in layers:
        img = Image.alpha_composite(img, l)
    return img


# ---------------------------------------------------------------------------- Tarifler
SKIN = 'light'

CHARS = {
    # --- Ana karakterler
    'bertram': ('muscular', [('body', 'light'), ('heads_human_male_plump', 'light'), ('eyes', 'brown'),
                             ('hair_balding', 'gray'), ('beards_medium', 'gray'), ('eyebrows_thick', 'gray'),
                             ('torso_clothes_shortsleeve', 'white'), ('torso_aprons_apron', 'leather'),
                             ('legs_pants', 'brown'), ('feet_boots', 'brown')]),
    'vera': ('female', [('body', 'light'), ('heads_human_female', 'light'), ('eyes', 'green'),
                        ('hair_pixie', 'red'), ('torso_clothes_sleeveless', 'maroon'), ('torso_armour_leather', 'leather'),
                        ('legs_pants', 'charcoal'), ('feet_boots', 'black'), ('belt_leather', 'leather'),
                        ('weapon_sword_dagger', 'dagger')]),
    'lina': ('female', [('body', 'light'), ('heads_human_female', 'light'), ('eyes', 'orange'),
                        ('hair_bob', 'ginger'), ('head_ears_cat', 'ginger'), ('tail_cat', 'ginger'),
                        ('torso_clothes_shortsleeve', 'forest'), ('legs_pants', 'tan'), ('feet_boots', 'brown'),
                        ('belt_leather', 'brown'), ('weapon_ranged_bow_normal', 'medium')]),
    'celeste': ('female', [('body', 'light'), ('heads_human_female', 'light'), ('eyes', 'blue'),
                           ('hair_long_straight', 'blonde'), ('torso_clothes_blouse', 'white'),
                           ('legs_skirts_plain', 'navy'), ('feet_shoes', 'black'), ('belt_leather', 'white')]),
    # --- Köy esnafı
    'smith': ('muscular', [('body', 'bronze'), ('heads_human_male', 'bronze'), ('eyes', 'brown'),
                           ('hair_buzzcut', 'dark brown'), ('beards_beard', 'dark brown'),
                           ('torso_aprons_apron', 'leather'), ('legs_pants', 'charcoal'), ('feet_boots', 'black'),
                           ('arms_gloves', 'leather')]),
    'shopkeeper': ('female', [('body', 'olive'), ('heads_human_female', 'olive'), ('eyes', 'brown'),
                              ('hair_bangs_bun', 'chestnut'), ('torso_clothes_blouse', 'maroon'),
                              ('torso_aprons_apron', 'white'), ('legs_skirts_plain', 'tan'), ('feet_shoes', 'brown')]),
    'healer': ('female', [('body', 'light'), ('heads_human_female_elderly', 'light'), ('eyes', 'gray'),
                          ('hair_long', 'white'), ('torso_clothes_robe', 'light gray'), ('feet_shoes', 'brown')]),
    'guard': ('male', [('body', 'light'), ('heads_human_male', 'light'), ('eyes', 'blue'),
                       ('hair_plain', 'light brown'), ('torso_chainmail', 'gray'), ('legs_pants', 'navy'),
                       ('feet_boots', 'black'), ('hat_helmet_nasal', 'iron'), ('belt_leather', 'brown'),
                       ('weapon_polearm_spear', 'medium')]),
    'guard2': ('male', [('body', 'olive'), ('heads_human_male_gaunt', 'olive'), ('eyes', 'brown'),
                        ('hair_buzzcut', 'black'), ('beards_beard', 'black'), ('torso_chainmail', 'gray'),
                        ('legs_pants', 'charcoal'), ('feet_boots', 'black'), ('hat_helmet_kettle', 'steel'),
                        ('weapon_polearm_spear', 'medium')]),
    'gate_captain': ('muscular', [('body', 'taupe'), ('heads_human_male', 'taupe'), ('eyes', 'gray'),
                                  ('hair_buzzcut', 'gray'), ('beards_medium', 'gray'), ('torso_armour_plate', 'steel'),
                                  ('legs_armour', 'steel'), ('feet_boots', 'black'), ('hat_helmet_nasal', 'steel'),
                                  ('weapon_polearm_spear', 'medium')]),
    'hunter': ('male', [('body', 'taupe'), ('heads_human_male_gaunt', 'taupe'), ('eyes', 'green'),
                        ('hair_messy1', 'chestnut'), ('torso_clothes_longsleeve', 'forest'), ('torso_clothes_vest', 'leather'),
                        ('legs_pants', 'brown'), ('feet_boots', 'brown'), ('weapon_ranged_bow_normal', 'dark')]),
    # --- Köylüler
    'farmer_m1': ('male', [('body', 'light'), ('heads_human_male', 'light'), ('eyes', 'blue'),
                           ('hair_messy3', 'sandy'), ('torso_clothes_sleeveless', 'tan'), ('legs_pants', 'brown'),
                           ('feet_shoes', 'brown'), ('tool_thrust', 'hoe')]),
    'farmer_m2': ('male', [('body', 'amber'), ('heads_human_male_plump', 'amber'), ('eyes', 'brown'),
                           ('hair_balding', 'dark brown'), ('beards_beard', 'dark brown'),
                           ('torso_clothes_longsleeve', 'walnut'), ('legs_pants', 'charcoal'), ('feet_boots', 'brown')]),
    'farmer_f1': ('female', [('body', 'light'), ('heads_human_female', 'light'), ('eyes', 'brown'),
                             ('hair_ponytail', 'dark brown'), ('dress_bodice', 'forest'), ('torso_clothes_blouse', 'white'),
                             ('legs_skirts_plain', 'brown'), ('feet_shoes', 'brown')]),
    'farmer_f2': ('female', [('body', 'taupe'), ('heads_human_female', 'taupe'), ('eyes', 'gray'),
                             ('hair_shoulderl', 'black'), ('torso_clothes_blouse', 'sky'), ('legs_skirts_plain', 'slate'),
                             ('torso_aprons_apron', 'white'), ('feet_shoes', 'black')]),
    'elder_m': ('male', [('body', 'light'), ('heads_human_male_elderly', 'light'), ('eyes', 'gray'),
                         ('hair_balding', 'white'), ('beards_winter', 'white'), ('torso_clothes_longsleeve', 'gray'),
                         ('legs_pants', 'charcoal'), ('feet_shoes', 'black')]),
    'elder_f': ('female', [('body', 'light'), ('heads_human_female_elderly', 'light'), ('eyes', 'brown'),
                           ('hair_bangs_bun', 'gray'), ('torso_clothes_blouse', 'lavender'), ('legs_skirts_plain', 'charcoal'),
                           ('feet_shoes', 'black')]),
    'mother': ('female', [('body', 'amber'), ('heads_human_female', 'amber'), ('eyes', 'brown'),
                          ('hair_long', 'chestnut'), ('torso_clothes_blouse', 'rose'), ('legs_skirts_plain', 'walnut'),
                          ('feet_shoes', 'brown')]),
    'child': ('child', [('body', 'amber'), ('heads_human_child', 'amber'), ('eyes', 'brown'),
                        ('hair_messed', 'brown'), ('torso_clothes_child_shirt', 'blue'), ('legs_childpants', 'brown')]),
    'drunk': ('male', [('body', 'light'), ('heads_human_male_plump', 'light'), ('eyes', 'blue'),
                       ('hair_unkempt', 'ginger'), ('beards_5oclock_shadow', 'ginger'), ('torso_clothes_longsleeve', 'maroon'),
                       ('legs_pants', 'brown'), ('feet_shoes', 'black')]),
    'miller': ('male', [('body', 'light'), ('heads_human_male', 'light'), ('eyes', 'brown'),
                        ('hair_plain', 'white'), ('torso_clothes_longsleeve', 'white'), ('torso_aprons_apron', 'tan'),
                        ('legs_pants', 'tan'), ('feet_boots', 'brown')]),
    'adventurer_m': ('male', [('body', 'bronze'), ('heads_human_male', 'bronze'), ('eyes', 'brown'),
                              ('hair_spiked', 'black'), ('torso_armour_leather', 'black'), ('legs_pants', 'black'),
                              ('feet_boots', 'black'), ('cape_solid', 'maroon'), ('weapon_sword_dagger', 'dagger')]),
    'adventurer_f': ('female', [('body', 'light'), ('heads_human_female', 'light'), ('eyes', 'purple'),
                                ('hair_xlong', 'platinum'), ('torso_clothes_robe', 'purple'), ('hat_hood_cloth', 'purple')]),
    # --- Canavar insansılar
    'goblin': ('male', [('body', 'green'), ('heads_goblin', 'green'), ('legs_shorts', 'leather'),
                        ('belt_leather', 'brown'), ('weapon_sword_dagger', 'dagger')]),
    'goblin_shaman': ('female', [('body', 'pale_green'), ('heads_goblin', 'pale_green'),
                                 ('torso_clothes_robe', 'brown'), ('hat_hood_cloth', 'hood_brown')]),
    'goblin_chief': ('muscular', [('body', 'dark_green'), ('heads_goblin', 'dark_green'),
                                  ('torso_armour_leather', 'brown'), ('legs_pants', 'brown'), ('feet_boots', 'black'),
                                  ('hat_helmet_barbarian', 'iron')]),
    # --- 0.2.0: yeni köylüler, esnaf ve üst kast
    'haldor': ('male', [('body', 'light'), ('heads_human_male_elderly', 'light'), ('eyes', 'gray'),
                        ('hair_balding', 'white'), ('beards_trimmed', 'white'), ('torso_clothes_longsleeve', 'tan'),
                        ('torso_aprons_overalls', 'brown'), ('legs_pants', 'brown'), ('feet_boots', 'brown'),
                        ('hat_cap_bonnie', 'brown')]),
    'baker': ('female', [('body', 'light'), ('heads_human_female', 'light'), ('eyes', 'blue'),
                         ('hair_bangs_bun', 'blonde'), ('torso_clothes_blouse', 'white'), ('torso_aprons_apron_full', 'brown'),
                         ('legs_skirts_plain', 'brown'), ('feet_shoes', 'brown'), ('hat_headband_kerchief', 'white')]),
    'tailor': ('female', [('body', 'light'), ('heads_human_female', 'light'), ('eyes', 'purple'),
                          ('hair_long_tied', 'black'), ('torso_clothes_blouse_longsleeve', 'lavender'), ('dress_sash', 'purple'),
                          ('legs_skirts_plain', 'purple'), ('feet_shoes', 'black'), ('neck_necklace_chain', 'silver')]),
    'tanner': ('muscular', [('body', 'bronze'), ('heads_human_male_gaunt', 'bronze'), ('eyes', 'brown'),
                            ('hair_buzzcut', 'black'), ('beards_bigstache', 'black'), ('torso_clothes_sleeveless', 'brown'),
                            ('torso_aprons_apron', 'leather'), ('legs_pants', 'leather'), ('feet_boots', 'black')]),
    'merchant': ('male', [('body', 'light'), ('heads_human_male_plump', 'light'), ('eyes', 'brown'),
                          ('hair_parted', 'chestnut'), ('beards_trimmed', 'chestnut'), ('torso_clothes_longsleeve_formal', 'white'),
                          ('torso_jacket_frock', 'maroon'), ('legs_formal', 'black'), ('feet_boots', 'black'),
                          ('hat_formal_bowler', 'black'), ('neck_necklace_chain', 'gold'), ('belt_leather', 'black')]),
    'merc_guard': ('muscular', [('body', 'taupe'), ('heads_human_male', 'taupe'), ('eyes', 'gray'),
                                ('hair_buzzcut', 'dark brown'), ('beards_5oclock_shadow', 'dark brown'), ('torso_chainmail', 'gray'),
                                ('legs_pants', 'charcoal'), ('feet_boots', 'black'), ('cape_solid', 'navy'),
                                ('hat_helmet_norman', 'steel'), ('weapon_sword_longsword', 'longsword')]),
    'steward': ('male', [('body', 'light'), ('heads_human_male', 'light'), ('eyes', 'gray'),
                         ('hair_parted2', 'gray'), ('torso_clothes_longsleeve_formal', 'white'), ('torso_jacket_frock', 'navy'),
                         ('neck_cravat', 'white'), ('legs_formal', 'navy'), ('feet_boots', 'black'),
                         ('hat_cap_cavalier_feather', 'navy')]),
    'knight': ('male', [('body', 'light'), ('heads_human_male', 'light'), ('eyes', 'blue'),
                        ('torso_armour_plate', 'steel'), ('legs_armour', 'steel'), ('feet_boots_plate', 'steel'),
                        ('cape_solid', 'blue'), ('hat_helmet_armet', 'steel'), ('weapon_sword_longsword', 'longsword')]),
    'vagrant': ('male', [('body', 'taupe'), ('heads_human_male_gaunt', 'taupe'), ('eyes', 'brown'),
                         ('hair_unkempt', 'dark brown'), ('beards_5oclock_shadow', 'dark brown'), ('torso_clothes_sleeveless', 'gray'),
                         ('cape_tattered', 'brown'), ('legs_pants', 'gray'), ('feet_sandals', 'brown')]),
    'beggar': ('female', [('body', 'light'), ('heads_human_female_elderly', 'light'), ('eyes', 'brown'),
                          ('hair_messy2', 'gray'), ('torso_clothes_tunic', 'brown'), ('cape_tattered', 'gray'),
                          ('legs_skirts_plain', 'charcoal')]),
    'farmer_m3': ('male', [('body', 'taupe'), ('heads_human_male', 'taupe'), ('eyes', 'brown'),
                           ('hair_curly_short', 'black'), ('torso_clothes_shortsleeve', 'tan'), ('torso_aprons_suspenders', 'brown'),
                           ('legs_pants', 'brown'), ('feet_boots', 'brown'), ('tool_thrust', 'shovel')]),
    'farmer_f3': ('female', [('body', 'light'), ('heads_human_female', 'light'), ('eyes', 'green'),
                             ('hair_braid', 'blonde'), ('torso_clothes_blouse', 'white'), ('dress_bodice', 'maroon'),
                             ('legs_skirts_plain', 'brown'), ('feet_shoes', 'brown')]),
    'shepherd': ('male', [('body', 'light'), ('heads_human_male_small', 'light'), ('eyes', 'blue'),
                          ('hair_mop', 'sandy'), ('torso_clothes_longsleeve', 'green'), ('legs_pants', 'brown'),
                          ('feet_sandals', 'brown'), ('weapon_polearm_cane', 'cane')]),
    'milkmaid': ('female', [('body', 'light'), ('heads_human_female', 'light'), ('eyes', 'brown'),
                            ('hair_pigtails', 'ginger'), ('torso_clothes_blouse', 'white'), ('dress_bodice', 'blue'),
                            ('legs_skirts_plain', 'navy'), ('feet_shoes', 'brown'), ('hat_headband_kerchief', 'blue')]),
    'headman': ('male', [('body', 'light'), ('heads_human_male_plump', 'light'), ('eyes', 'gray'),
                         ('hair_balding', 'gray'), ('beards_medium', 'gray'), ('torso_clothes_longsleeve', 'white'),
                         ('torso_jacket_frock', 'brown'), ('legs_formal', 'brown'), ('feet_boots', 'brown'),
                         ('neck_necklace_chain', 'brass')]),
    'headwife': ('female', [('body', 'light'), ('heads_human_female', 'light'), ('eyes', 'gray'),
                            ('hair_bangs_bun', 'dark gray'), ('torso_clothes_blouse_longsleeve', 'maroon'), ('legs_skirts_plain', 'maroon'),
                            ('feet_shoes', 'black'), ('neck_necklace_beaded_small', 'white')]),
    'carpenter': ('male', [('body', 'light'), ('heads_human_male', 'light'), ('eyes', 'brown'),
                           ('hair_messy2', 'light brown'), ('beards_beard', 'light brown'), ('torso_clothes_longsleeve', 'walnut'),
                           ('torso_aprons_apron', 'leather'), ('legs_pants', 'tan'), ('feet_boots', 'brown'), ('tool_smash', 'hammer')]),
    'child_girl': ('child', [('body', 'light'), ('heads_human_child', 'light'), ('eyes', 'blue'),
                             ('hair_parted_side_bangs', 'blonde'), ('torso_clothes_child_shirt', 'pink'), ('legs_childskirts', 'blue')]),
    'child_boy': ('child', [('body', 'taupe'), ('heads_human_child', 'taupe'), ('eyes', 'brown'),
                            ('hair_messed', 'black'), ('torso_clothes_child_shirt', 'red'), ('legs_childpants', 'brown')]),
    'washer': ('female', [('body', 'amber'), ('heads_human_female', 'amber'), ('eyes', 'brown'),
                          ('hair_shoulderr', 'redhead'), ('torso_clothes_blouse', 'sky'), ('torso_aprons_apron', 'white'),
                          ('legs_skirts_plain', 'blue'), ('feet_shoes', 'brown')]),
    'adv_kael': ('male', [('body', 'light'), ('heads_human_male', 'light'), ('eyes', 'blue'),
                          ('hair_spiked2', 'blonde'), ('torso_armour_leather', 'brown'), ('legs_pants', 'charcoal'),
                          ('feet_boots', 'brown'), ('belt_leather', 'brown'), ('weapon_sword_dagger', 'dagger')]),
    'adv_thorne': ('muscular', [('body', 'olive'), ('heads_human_male', 'olive'), ('eyes', 'gray'),
                                ('hair_longhawk', 'black'), ('beards_chevron', 'black'), ('torso_chainmail', 'gray'),
                                ('torso_jacket_tabard', 'black'), ('legs_armour', 'iron'), ('feet_boots', 'black'),
                                ('cape_solid', 'black'), ('weapon_sword_longsword', 'longsword')]),
    'gerda': ('female', [('body', 'light'), ('heads_human_female_elderly', 'light'), ('eyes', 'blue'),
                         ('hair_bangs_bun', 'white'), ('torso_clothes_blouse', 'forest'), ('cape_solid', 'forest'),
                         ('legs_skirts_plain', 'brown'), ('feet_shoes', 'brown')]),
    'guard3': ('male', [('body', 'bronze'), ('heads_human_male', 'bronze'), ('eyes', 'brown'),
                        ('hair_plain', 'black'), ('torso_chainmail', 'gray'), ('torso_jacket_tabard', 'blue'),
                        ('legs_pants', 'navy'), ('feet_boots', 'black'), ('hat_helmet_kettle', 'steel'),
                        ('weapon_polearm_spear', 'medium')]),
    'bard': ('male', [('body', 'light'), ('heads_human_male', 'light'), ('eyes', 'green'),
                      ('hair_long_messy', 'chestnut'), ('torso_clothes_longsleeve_laced', 'red'), ('legs_pants', 'green'),
                      ('feet_boots', 'brown'), ('hat_cap_feather', 'red')]),
    'apprentice': ('male', [('body', 'light'), ('heads_human_male_small', 'light'), ('eyes', 'brown'),
                            ('hair_buzzcut', 'ginger'), ('torso_clothes_sleeveless', 'gray'), ('torso_aprons_apron', 'leather'),
                            ('legs_pants', 'charcoal'), ('feet_shoes', 'brown')]),
    'innmaid': ('female', [('body', 'olive'), ('heads_human_female', 'olive'), ('eyes', 'brown'),
                           ('hair_ponytail2', 'chestnut'), ('torso_clothes_blouse', 'white'), ('torso_aprons_apron', 'white'),
                           ('legs_skirts_plain', 'forest'), ('feet_shoes', 'brown')]),
    'woodcutter': ('muscular', [('body', 'light'), ('heads_human_male', 'light'), ('eyes', 'blue'),
                                ('hair_buzzcut', 'redhead'), ('beards_beard', 'redhead'), ('torso_clothes_sleeveless', 'red'),
                                ('legs_pants', 'brown'), ('feet_boots', 'brown'), ('tool_smash', 'axe')]),
}

# Joseph: dinamik katmanlar (ekipmana göre)
# 0.3.0: kısa, dağınık siyah saç; koyu (LPC'deki en koyu: brown) gözler; esmerin hafif açığı ten (taupe).
JOSEPH_SKIN = 'taupe'
JOSEPH_BODY = ('male', [('body', JOSEPH_SKIN)])
JOSEPH_HEAD = ('male', [('heads_human_male', JOSEPH_SKIN), ('eyes', 'black'), ('eyebrows_thick', 'black'), ('hair_bedhead', 'black')])
JOSEPH_ITEMS = {
    'a_shorts': [('legs_shorts_short', 'tan')],
    'a_shirt': [('torso_clothes_longsleeve', 'white')],
    'a_pants': [('legs_pants', 'tan')],
    'a_shoes': [('feet_shoes', 'brown')],
    'a_vest': [('torso_clothes_vest', 'leather')],
    'a_cap': [('hat_cap_feather', 'leather')],
    'a_gloves': [('arms_gloves', 'leather')],
    'a_belt': [('belt_leather', 'leather')],
    'a_boots': [('feet_boots', 'leather')],
    'a_cape': [('cape_solid', 'brown')],
    'a_padded': [('torso_armour_leather', 'leather')],
    'a_helm': [('hat_helmet_nasal', 'iron')],
    'a_pants_leather': [('legs_pants', 'leather')],
    'w_dagger': [('weapon_sword_dagger', 'dagger')],
    'w_spear': [('weapon_polearm_spear', 'medium')],
    'w_bow': [('weapon_ranged_bow_normal', 'medium')],
    'w_club': [('tool_smash', 'hammer')],
}


def main():
    if not REPO:
        print(__doc__)
        sys.exit(1)
    os.makedirs(OUT, exist_ok=True)
    manifest = {'chars': {}, 'joseph': {}}
    only = set(sys.argv[2:])
    if only:
        # Kısmi üretim: mevcut manifest ve kredileri koru, Joseph katmanlarına dokunma.
        mp = os.path.join(OUT, 'chars.json')
        if os.path.exists(mp):
            manifest = json.load(open(mp))
        cp = os.path.join(ROOT, 'tools', 'credits_lpc_chars.json')
        if os.path.exists(cp):
            for c in json.load(open(cp)):
                credits_used[c['file']] = c
    for cid, (body, parts) in CHARS.items():
        check_parts(cid, body, parts)
    for cid, (body, parts) in CHARS.items():
        if only and cid not in only:
            continue
        print('karakter', cid)
        compose(body, parts).save(os.path.join(OUT, cid + '.png'), optimize=True)
        manifest['chars'][cid] = cid + '.png'
    jd = os.path.join(OUT, 'joseph')
    os.makedirs(jd, exist_ok=True)
    if only and 'joseph' not in only:
        with open(os.path.join(OUT, 'chars.json'), 'w') as f:
            json.dump(manifest, f, indent=1, ensure_ascii=False)
        with open(os.path.join(ROOT, 'tools', 'credits_lpc_chars.json'), 'w') as f:
            json.dump(sorted(credits_used.values(), key=lambda c: c['file']), f, indent=1, ensure_ascii=False)
        print('tamam (kısmi):', len(credits_used), 'kredi kaydı')
        return
    print('joseph katmanları')
    compose(*JOSEPH_BODY).save(os.path.join(jd, 'body.png'), optimize=True)
    compose(*JOSEPH_HEAD).save(os.path.join(jd, 'head.png'), optimize=True)
    manifest['joseph']['body'] = {'file': 'joseph/body.png', 'z': 10}
    manifest['joseph']['head'] = {'file': 'joseph/head.png', 'z': 100}
    for key, parts in JOSEPH_ITEMS.items():
        ls = []
        for d, v in parts:
            ls += layers_for(d, v, 'male')
        fg = [l for z, l in ls if z >= 10]
        bg = [l for z, l in ls if z < 10]
        zf = max([z for z, _ in ls if z >= 10], default=50)
        for name, group, z in ((key, fg, zf), (key + '_bg', bg, 5)):
            if not group:
                continue
            img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            for l in group:
                img = Image.alpha_composite(img, l)
            img.save(os.path.join(jd, name + '.png'), optimize=True)
            manifest['joseph'][name] = {'file': 'joseph/' + name + '.png', 'z': z}
    with open(os.path.join(OUT, 'chars.json'), 'w') as f:
        json.dump(manifest, f, indent=1, ensure_ascii=False)
    with open(os.path.join(ROOT, 'tools', 'credits_lpc_chars.json'), 'w') as f:
        json.dump(sorted(credits_used.values(), key=lambda c: c['file']), f, indent=1, ensure_ascii=False)
    print('tamam:', len(credits_used), 'kredi kaydı')


if __name__ == '__main__':
    main()
