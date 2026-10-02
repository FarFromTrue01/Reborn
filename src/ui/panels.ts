// Yeniden kullanılabilir paneller: kaydırılabilir liste, kart seçimi.
import Phaser from 'phaser';
import { Display } from '../game/display';
import { COLORS, FONT, txt, drawFrame, drawBlue, Button } from './kit';
import { Sound } from '../audio/audio';

export class ScrollList extends Phaser.GameObjects.Container {
  inner: Phaser.GameObjects.Container;
  maskG: Phaser.GameObjects.Graphics;
  scrollY = 0;
  contentH = 0;
  private dragY: number | null = null;
  private startScroll = 0;
  private moved = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, public w: number, public h: number) {
    super(scene, x, y);
    this.inner = scene.add.container(0, 0);
    this.add(this.inner);
    this.maskG = scene.make.graphics({});
    this.updateMask();
    this.inner.setMask(this.maskG.createGeometryMask());
    const zone = scene.add.zone(0, 0, w, h).setOrigin(0, 0).setInteractive();
    this.addAt(zone, 0);
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragY = p.y;
      this.startScroll = this.scrollY;
      this.moved = 0;
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.dragY === null || !p.isDown) return;
      const dy = (p.y - this.dragY) / Display.uiZoom;
      this.moved = Math.max(this.moved, Math.abs(dy));
      this.setScroll(this.startScroll - dy);
    });
    scene.input.on('pointerup', () => (this.dragY = null));
    scene.input.on('wheel', (p: Phaser.Input.Pointer, _o: any, _dx: number, dy: number) => {
      const lx = p.x / Display.uiZoom - this.worldX(), ly = p.y / Display.uiZoom - this.worldY();
      if (lx >= 0 && ly >= 0 && lx <= this.w && ly <= this.h) this.setScroll(this.scrollY + dy * 0.6);
    });
    scene.add.existing(this);
  }

  worldX() {
    let x = this.x;
    let p = this.parentContainer;
    while (p) {
      x += p.x;
      p = p.parentContainer;
    }
    return x;
  }

  worldY() {
    let y = this.y;
    let p = this.parentContainer;
    while (p) {
      y += p.y;
      p = p.parentContainer;
    }
    return y;
  }

  wasDrag() {
    return this.moved > 8;
  }

  updateMask() {
    this.maskG.clear();
    this.maskG.fillStyle(0xffffff);
    this.maskG.fillRect(this.worldX(), this.worldY(), this.w, this.h);
  }

  setContentHeight(h: number) {
    this.contentH = h;
    this.setScroll(this.scrollY);
  }

  setScroll(v: number) {
    this.scrollY = Phaser.Math.Clamp(v, 0, Math.max(0, this.contentH - this.h));
    this.inner.y = -this.scrollY;
  }

  clear() {
    this.inner.removeAll(true);
    this.contentH = 0;
    this.scrollY = 0;
    this.inner.y = 0;
  }

  destroy(fromScene?: boolean) {
    this.maskG.destroy();
    super.destroy(fromScene);
  }
}

export interface CardOpt {
  title: string;
  desc: string;
  icon?: string;
  footer?: string;
}

/** Ortada kartlarla seçim (Divine skill, Sistem Teklifi). İptal yoksa mutlaka biri seçilir. */
export function panelChoice(scene: Phaser.Scene, title: string, opts: CardOpt[], blue = true, cancellable = false): Promise<number> {
  return new Promise((resolve) => {
    const W = Display.uiW, H = Display.uiH;
    const c = scene.add.container(0, 0).setDepth(150);
    const dim = scene.add.rectangle(0, 0, W, H, 0x000000, 0.6).setOrigin(0, 0).setInteractive();
    c.add(dim);
    const cw = Math.min(300, (W - 80) / opts.length - 20);
    const ch = 330;
    const total = opts.length * cw + (opts.length - 1) * 20;
    const x0 = (W - total) / 2;
    const y0 = (H - ch) / 2 + 20;
    c.add(txt(scene, W / 2, y0 - 50, `【 ${title} 】`, { size: 24, font: FONT.title, color: blue ? '#e6f6ff' : COLORS.textGold, bold: true, stroke: true }).setOrigin(0.5));
    opts.forEach((o, i) => {
      const x = x0 + i * (cw + 20);
      const card = scene.add.container(x, y0);
      const g = scene.add.graphics();
      if (blue) drawBlue(g, 0, 0, cw, ch, 0.9);
      else drawFrame(g, 0, 0, cw, ch);
      card.add(g);
      if (o.icon && scene.textures.get('icons').has(o.icon)) card.add(scene.add.image(cw / 2, 52, 'icons', o.icon).setScale(1.6));
      card.add(txt(scene, cw / 2, 100, o.title, { size: 18, bold: true, color: '#ffffff', align: 'center', wrap: cw - 30, font: FONT.title }).setOrigin(0.5, 0));
      card.add(txt(scene, 18, 160, o.desc, { size: 15, color: blue ? COLORS.textBlue : COLORS.text, wrap: cw - 36, lineSpacing: 3 }));
      if (o.footer) card.add(txt(scene, cw / 2, ch - 70, o.footer, { size: 13, italic: true, color: COLORS.textDim, align: 'center', wrap: cw - 30 }).setOrigin(0.5, 0));
      const b = new Button(scene, cw / 2, ch - 34, 'Seç', () => {
        Sound.sfx('skillup');
        c.destroy();
        resolve(i);
      }, { w: cw - 40, h: 50, style: blue ? 'blue' : 'gold' });
      card.add(b);
      card.setAlpha(0);
      card.y += 20;
      scene.tweens.add({ targets: card, alpha: 1, y: y0, duration: 300, delay: 120 * i, ease: 'Back.Out' });
      c.add(card);
    });
    if (cancellable) {
      const b = new Button(scene, W / 2, y0 + ch + 50, 'Vazgeç', () => {
        c.destroy();
        resolve(-1);
      }, { w: 200, h: 52 });
      c.add(b);
    }
  });
}

/** Basit onay penceresi. */
export function confirmBox(scene: Phaser.Scene, text: string, yes = 'Evet', no = 'Hayır'): Promise<boolean> {
  return new Promise((resolve) => {
    const W = Display.uiW, H = Display.uiH;
    const c = scene.add.container(0, 0).setDepth(160);
    c.add(scene.add.rectangle(0, 0, W, H, 0x000000, 0.5).setOrigin(0, 0).setInteractive());
    const w = 520, h = 220;
    const g = scene.add.graphics();
    drawFrame(g, (W - w) / 2, (H - h) / 2, w, h);
    c.add(g);
    c.add(txt(scene, W / 2, (H - h) / 2 + 40, text, { size: 19, align: 'center', wrap: w - 60 }).setOrigin(0.5, 0));
    c.add(new Button(scene, W / 2 - 110, (H + h) / 2 - 50, yes, () => { c.destroy(); resolve(true); }, { w: 180, h: 54 }));
    c.add(new Button(scene, W / 2 + 110, (H + h) / 2 - 50, no, () => { c.destroy(); resolve(false); }, { w: 180, h: 54 }));
  });
}
