// "Sırala" düğmeleri (0.9.0): anahtar düğmesi (sırasız → Fiyat → Rütbe → Tür → Ad) + yön düğmesi (artan/azalan).
import Phaser from 'phaser';
import { Button, uiIcon } from './kit';
import { nextSortKey, SORT_NAMES, type SortPref } from '../core/itemSort';

/** x, y: sol üst. Genişliği döndürür. */
export function sortBar(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, pref: SortPref, onChange: () => void, h = 36): number {
  const kw = 150, dw = 92;
  const kb = new Button(scene, x + kw / 2, y + h / 2, `     Sırala: ${pref.key ? SORT_NAMES[pref.key] : '—'}`, () => {
    pref.key = nextSortKey(pref.key);
    onChange();
  }, { w: kw, h, size: 13 });
  kb.add(uiIcon(scene, -kw / 2 + 18, 0, 'sort', 18));
  kb.setName('sort_key');
  parent.add(kb);
  const db = new Button(scene, x + kw + 6 + dw / 2, y + h / 2, pref.desc ? 'Azalan ▼' : 'Artan ▲', () => {
    pref.desc = !pref.desc;
    onChange();
  }, { w: dw, h, size: 13, disabled: !pref.key });
  db.setName('sort_dir');
  parent.add(db);
  return kw + 6 + dw;
}
