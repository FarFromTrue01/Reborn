// 0.11.0 (D): yuva seçme ekranı (Yeni Oyun, Yükle; oyun içinde Yükle ve "Eski kaydı bir yuvaya kaydet").
// Her yuvada özet: level, rütbe, gün, son kayıt zamanı ya da "Boş".
import Phaser from 'phaser';
import { Display } from '../game/display';
import { COLORS, FONT, txt, drawFrame, Button, fullScreenRect, uiIcon } from './kit';
import { SLOT_IDS, slotLine, slotMeta, type SlotId } from '../core/slots';

export type PickMode = 'new' | 'load' | 'store';

const TITLES: Record<PickMode, string> = { new: 'Yeni Oyun: Yuva Seç', load: 'Yükle', store: 'Eski Kaydı Bir Yuvaya Kaydet' };

/** Yuva seç: 'legacy' yalnızca Yükle'de (eski kayıt varsa). İptal: null. */
export function pickSlot(scene: Phaser.Scene, mode: PickMode, current: SlotId | null = null): Promise<SlotId | 'legacy' | null> {
  return new Promise((resolve) => {
    const W = Display.uiW, H = Display.uiH;
    const c = scene.add.container(0, 0).setDepth(200);
    c.add(fullScreenRect(scene, 0x05040a, 0.85).setInteractive());
    const legacy = mode === 'load' ? slotMeta(localStorage, 'legacy') : null;
    const rows: (SlotId | 'legacy')[] = [...SLOT_IDS, ...(legacy ? ['legacy' as const] : [])];
    const pw = Math.min(680, W - 40), rowH = 92;
    const ph = 90 + rows.length * (rowH + 10) + 70;
    const px = (W - pw) / 2, py = Math.max(10, (H - ph) / 2);
    const g = scene.add.graphics();
    drawFrame(g, px, py, pw, ph);
    c.add(g);
    c.add(txt(scene, W / 2, py + 22, TITLES[mode], { size: 24, font: FONT.title, color: COLORS.textGold }).setOrigin(0.5, 0));
    const done = (v: SlotId | 'legacy' | null) => {
      c.destroy();
      resolve(v);
    };
    rows.forEach((id, i) => {
      const y = py + 74 + i * (rowH + 10);
      const m = slotMeta(localStorage, id);
      const rg = scene.add.graphics();
      const on = id === current;
      rg.fillStyle(on ? 0x2a2214 : 0x1a1622, 0.95);
      rg.fillRoundedRect(px + 20, y, pw - 40, rowH, 8);
      rg.lineStyle(on ? 2 : 1, on ? COLORS.gold : COLORS.goldDark, 1);
      rg.strokeRoundedRect(px + 20, y, pw - 40, rowH, 8);
      c.add(rg);
      c.add(uiIcon(scene, px + 48, y + rowH / 2, id === 'legacy' ? 'history' : 'save', 30));
      const name = id === 'legacy' ? 'Eski kayıt' : `Yuva ${id}${on ? ' (oynanan)' : ''}`;
      c.add(txt(scene, px + 76, y + 14, name, { size: 19, bold: true, color: COLORS.textGold }));
      c.add(txt(scene, px + 76, y + 46, slotLine(m), { size: 14, color: m ? COLORS.text : COLORS.textDim, wrap: pw - 300 }));
      const label = mode === 'new' ? (m ? 'Üzerine yaz' : 'Başla') : mode === 'store' ? 'Buraya kaydet' : 'Yükle';
      const b = new Button(scene, px + pw - 110, y + rowH / 2, label, () => done(id), { w: 160, h: 52, size: 17, disabled: mode === 'load' && !m });
      b.setName(`slot_${id}`);
      c.add(b);
    });
    const cancel = new Button(scene, W / 2, py + ph - 42, 'Vazgeç', () => done(null), { w: 220, h: 52 });
    cancel.setName('slot_cancel');
    c.add(cancel);
  });
}
