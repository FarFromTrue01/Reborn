import Phaser from 'phaser';
import { G } from '../game/G';
import { Display } from '../game/display';
import { COLORS, FONT, txt, Button, fullScreenRect } from '../ui/kit';
import { ScrollList } from '../ui/panels';
import { Sound } from '../audio/audio';

/** Emeği Geçenler: tüm LPC ve diğer kaynakların yazar ve lisansları. */
export class CreditsScene extends Phaser.Scene {
  constructor() {
    super('Credits');
  }

  create() {
    this.cameras.main.setZoom(Display.uiZoom);
    this.cameras.main.setOrigin(0, 0);
    const W = Display.uiW, H = Display.uiH;
    fullScreenRect(this, 0x07060b, 1);
    txt(this, W / 2, 30, 'Emeği Geçenler', { size: 34, font: FONT.title, color: COLORS.textGold }).setOrigin(0.5, 0);
    const list = new ScrollList(this, 60, 90, W - 120, H - 180);
    list.updateMask();
    let y = 0;
    const data = G.credits ?? { sections: [] };
    for (const s of data.sections) {
      const h = txt(this, (W - 120) / 2, y, s.title, { size: 21, font: FONT.title, color: COLORS.textGold, align: 'center', wrap: W - 200 }).setOrigin(0.5, 0);
      list.inner.add(h);
      y += h.height + 8;
      for (const l of s.lines) {
        const t = txt(this, (W - 120) / 2, y, l, { size: 15, color: COLORS.text, align: 'center', wrap: W - 220 }).setOrigin(0.5, 0);
        list.inner.add(t);
        y += t.height + 4;
      }
      y += 26;
    }
    const tail = txt(this, (W - 120) / 2, y, 'Tüm görseller ilgili lisanslarla (CC-BY-SA 3.0, GPL 3.0, OGA-BY 3.0, CC-BY, CC0) kullanılmıştır.\nAyrıntılı dosya bazlı liste: CREDITS.md', { size: 13, italic: true, color: COLORS.textDim, align: 'center', wrap: W - 220 }).setOrigin(0.5, 0);
    list.inner.add(tail);
    y += tail.height + 20;
    list.setContentHeight(y);
    // otomatik kaydırma
    let auto = true;
    this.input.on('pointerdown', () => (auto = false));
    this.events.on('update', (_t: number, d: number) => {
      if (auto) list.setScroll(list.scrollY + d * 0.025);
    });
    new Button(this, W / 2, H - 44, 'Geri', () => this.scene.start('Title'), { w: 200, h: 54 });
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('Title'));
    Sound.play('title');
  }
}
