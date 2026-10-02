#!/usr/bin/env bash
# Kaynak görselleri indirir (tools/.cache altına). Sonra:
#   python3 tools/lpc_chars.py tools/.cache/lpc-repo
#   python3 tools/build_terrain.py && python3 tools/build_props.py && python3 tools/build_buildings.py
#   python3 tools/build_monsters.py && python3 tools/build_icons.py && python3 tools/build_credits.py
set -e
cd "$(dirname "$0")/.cache" 2>/dev/null || { mkdir -p "$(dirname "$0")/.cache"; cd "$(dirname "$0")/.cache"; }
[ -d lpc-repo ] || git clone --depth 1 --filter=blob:none --sparse https://github.com/sanderfrenken/Universal-LPC-Spritesheet-Character-Generator.git lpc-repo
(cd lpc-repo && git sparse-checkout set sheet_definitions)
mkdir -p oga && cd oga
B=https://opengameart.org/sites/default/files
for f in Atlas_0.zip Atlas2.zip lpc-monsters.zip LPC_house_interior_0.zip decoration_medieval.zip lpc-trees.zip 496_RPG_icons.zip \
         lpccatratdog.png rabbit_2.png wolfsheet1.png thatched-roof.png cottage.png; do
  [ -f "$f" ] || curl -sSLO "$B/$f"
done
unzip -o -q Atlas_0.zip -d atlas1; unzip -o -q Atlas2.zip -d atlas2
for z in lpc-monsters LPC_house_interior_0 decoration_medieval lpc-trees; do unzip -o -q $z.zip -d $z; done
unzip -o -q 496_RPG_icons.zip -d icons496
echo "Kaynaklar hazır."
