#!/usr/bin/env python3
"""CREDITS.md ve oyun içi Emeği Geçenler verisi (assets/credits.json) üretir."""
import os, json, shutil
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = os.path.join(ROOT, 'tools', '.cache', 'oga')
LIC = os.path.join(ROOT, 'assets', 'licenses')
os.makedirs(LIC, exist_ok=True)

lpc = json.load(open(os.path.join(ROOT, 'tools', 'credits_lpc_chars.json')))

packs = [
    {'title': 'LPC Tile Atlas & LPC Tile Atlas 2 (arazi, köy parçaları, kapı/pencere)', 'authors': 'Lanea Zimmerman (Sharm), Daniel Eddeland, Casper Nilsson, Johann Charlot, Stephen Challener (Redshrike), Hyptosis, Barbara Rivera, Matthew Nash, Zabin, Jetrel, Bertram, Daniel Armstrong, Guido Bos, ve diğerleri (bkz. assets/licenses/LPC_Tile_Atlas_Attribution*.txt)', 'license': 'CC-BY-SA 3.0 / GPL 3.0', 'url': 'https://opengameart.org/content/lpc-tile-atlas', 'files': ['atlas1/Attribution.txt', 'atlas2/Attribution2.txt']},
    {'title': '[LPC] Thatched-roof Cottage (bina duvar ve çatıları)', 'authors': 'bluecarrot16', 'license': 'CC-BY-SA 3.0 / GPL 3.0', 'url': 'https://opengameart.org/content/lpc-thatched-roof-cottage'},
    {'title': '[LPC] Trees (ağaçlar)', 'authors': 'bluecarrot16 (derleme), Johann Charlot, Lanea Zimmerman (Sharm), Hyptosis, Guido Bos, Ivan Voirol, ve diğerleri', 'license': 'CC-BY-SA 3.0', 'url': 'https://opengameart.org/content/lpc-trees', 'files': ['lpc-trees/lpc-trees/CREDITS-trees.txt']},
    {'title': '[LPC] Medieval Village Decorations (köy eşyaları, tezgâhlar, çadırlar)', 'authors': 'bluecarrot16 (derleme), Reemax, Sharm, Xenodora, Casper Nilsson, Nemisys, Jetrel, Guido Bos, ve diğerleri', 'license': 'CC-BY-SA 4.0 / CC-BY-SA 3.0', 'url': 'https://opengameart.org/content/lpc-medieval-village-decorations', 'files': ['decoration_medieval/decoration_medieval/CREDITS-decorations-medieval.txt']},
    {'title': '[LPC] House interior and decorations (iç mekân)', 'authors': 'Reemax (Tuomo Untinen), Sharm, Hyptosis, daneeklu, William.Thompsonj, wulax, makrohn', 'license': 'CC-BY-SA 3.0 / GPL 3.0', 'url': 'https://opengameart.org/content/lpc-house-interior-and-decorations', 'files': ['LPC_house_interior_0/LPC_house_interior/credits.txt']},
    {'title': '[LPC] Monsters (sümüksü)', 'authors': 'bluecarrot16 (derleme); orijinal: bagzie, Stephen Challener (Redshrike)', 'license': 'CC-BY-SA 3.0 / GPL 3.0', 'url': 'https://opengameart.org/content/lpc-monsters'},
    {'title': '[LPC] Wolf Animation (yaban kurdu)', 'authors': 'Stephen Challener (Redshrike), William.Thompsonj tarafından ısmarlandı', 'license': 'CC-BY 3.0 / OGA-BY 3.0 / GPL 3.0', 'url': 'https://opengameart.org/content/lpc-wolf-animation'},
    {'title': '[LPC] Rat, Cat and Dog (fare)', 'authors': 'Reemax (Tuomo Untinen)', 'license': 'CC-BY 3.0 / CC-BY-SA 3.0 / GPL 3.0', 'url': 'https://opengameart.org/content/lpc-rat-cat-and-dog'},
    {'title': 'Bunny Rabbit LPC style / Reorganised LPC rabbit (tavşan)', 'authors': 'Stephen Challener (Redshrike); düzenleme: Evert', 'license': 'CC-BY 3.0 / CC-BY-SA 3.0 / OGA-BY 3.0', 'url': 'https://opengameart.org/node/114556'},
    {'title': '496 pixel art icons for medieval/fantasy RPG (ikonlar)', 'authors': 'Henrique Lazarini (7Soul1)', 'license': 'CC0', 'url': 'https://opengameart.org/content/496-pixel-art-icons-for-medievalfantasy-rpg'},
    {'title': 'Yazı tipleri: Cinzel, Alegreya, Alegreya Sans, Pixelify Sans', 'authors': 'Natanael Gama (Cinzel); Juan Pablo del Peral / Huerta Tipográfica (Alegreya, Alegreya Sans); Stefie Justprince (Pixelify Sans)', 'license': 'SIL Open Font License 1.1', 'url': 'https://fonts.google.com', 'files': []},
]

for p in packs:
    for f in p.get('files', []):
        src = os.path.join(S, f)
        if os.path.exists(src):
            name = os.path.basename(f)
            if 'Attribution' in name:
                name = 'LPC_Tile_Atlas_' + name
            shutil.copy(src, os.path.join(LIC, name))

lines = ['# Emeği Geçenler / Credits', '',
         'Reborn in Elonth — oyun tasarımı, kod, ses ve müzik (WebAudio ile üretildi): FarFromTrue01 ve Claude.', '',
         'Görsellerin büyük kısmı **Liberated Pixel Cup (LPC)** topluluğunun eserleridir. LPC lisansları (CC-BY-SA 3.0, GPL 3.0, OGA-BY 3.0, CC-BY) yazarların belirtilmesini şart koşar.',
         'Bu oyundaki türetilmiş görseller (birleştirilmiş sprite sheet\'ler, binalar, tileset) aynı lisanslarla (CC-BY-SA 3.0 / GPL 3.0) paylaşılır.', '',
         '## Karakter sprite\'ları — Universal LPC Spritesheet Character Generator', '',
         'Kaynak: https://github.com/sanderfrenken/Universal-LPC-Spritesheet-Character-Generator', '']
for c in lpc:
    lines.append(f"- **{c['file']}** — {', '.join(c['authors'])} — {' / '.join(c['licenses'])}")
    for u in c.get('urls', [])[:3]:
        lines.append(f'  - {u}')
lines += ['', '## Ortam, canavar ve ikon paketleri', '']
for p in packs:
    lines.append(f"- **{p['title']}** — {p['authors']} — {p['license']} — {p['url']}")
lines += ['', 'Ayrıntılı lisans/atıf dosyaları: `assets/licenses/` ve `assets/fonts/OFL-*.txt`.', '',
          'Kullanıcının kendi ürettiği portre ve sahne görselleri (`assets/art/`) ona aittir.', '']
open(os.path.join(ROOT, 'CREDITS.md'), 'w').write('\n'.join(lines))

# oyun içi
authors = set()
for c in lpc:
    for a in c['authors']:
        authors.add(a)
data = {
    'sections': [
        {'title': 'Oyun', 'lines': ['Tasarım: FarFromTrue01', 'Kod, ses ve müzik: Claude (Anthropic) ile birlikte', 'Motor: Phaser 3']},
        {'title': 'Karakter Sprite\'ları (LPC)', 'lines': ['Universal LPC Spritesheet Character Generator', ', '.join(sorted(authors)), 'Lisanslar: CC-BY-SA 3.0, GPL 3.0, OGA-BY 3.0, CC-BY 3.0']},
    ] + [{'title': p['title'], 'lines': [p['authors'], p['license'], p['url']]} for p in packs] + [
        {'title': 'Ayrıntılar', 'lines': ['Tüm dosya bazlı atıflar CREDITS.md dosyasındadır.', 'https://lpc.opengameart.org']},
    ]
}
json.dump(data, open(os.path.join(ROOT, 'assets', 'credits.json'), 'w'), ensure_ascii=False, indent=1)
print('credits:', len(lpc), 'LPC kaydı,', len(authors), 'yazar')
