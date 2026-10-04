// Yeniden kullanılabilir paneller: kaydırılabilir liste, kart seçimi.
import Phaser from 'phaser';
import { Display } from '../game/display';
import { COLORS, FONT, txt, drawFrame, drawBlue, Button } from './kit';
import { Sound } from '../audio/audio';

export class ScrollList extends Phaser.GameObjects.Container {
  inner: Phaser.GameObjects.Container;
  maskG: Phaser.GameObjects.Graphics;
  bar: Phaser.GameObjects.Graphics;
  scrollY = 0;
  contentH = 0;
  private dragY: number | null = null;
  private dragId = -1;
  private startScroll = 0;
  private moved = 0;
  private vel = 0;
  private lastMoveT = 0;
  private handlers: [string, (...a: any[]) => void][] = [];
  /** Bu işaretçinin bir sonraki basışı kaydırma başlatmaz (ör. kaydırıcı sürükleniyor). */
  private heldId = -1;

  constructor(scene: Phaser.Scene, x: number, y: number, public w: number, public h: number) {
    super(scene, x, y);
    this.inner = scene.add.container(0, 0);
    this.add(this.inner);
    this.maskG = scene.make.graphics({});
    this.updateMask();
    this.inner.setMask(this.maskG.createGeometryMask());
    this.bar = scene.add.graphics();
    this.add(this.bar);
    const zone = scene.add.zone(0, 0, w, h).setOrigin(0, 0).setInteractive();
    this.addAt(zone, 0);
    // Sürükleme sahne düzeyinde dinlenir: satırların (butonların) üstünden başlayan
    // dokunmatik sürüklemeler de listeyi kaydırır.
    const down = (p: Phaser.Input.Pointer) => {
      if (p.id === this.heldId) {
        this.heldId = -1;
        return;
      }
      if (!this.active || !this.visible || !this.inside(p)) return;
      this.dragY = p.y;
      this.dragId = p.id;
      this.startScroll = this.scrollY;
      this.moved = 0;
      this.vel = 0;
    };
    const move = (p: Phaser.Input.Pointer) => {
      if (this.dragY === null || p.id !== this.dragId || !p.isDown) return;
      const dy = (p.y - this.dragY) / Display.uiZoom;
      this.moved = Math.max(this.moved, Math.abs(dy));
      if (this.moved > 6) {
        const before = this.scrollY;
        this.setScroll(this.startScroll - dy);
        const now = scene.time.now;
        this.vel = (this.scrollY - before) / Math.max(1, now - this.lastMoveT);
        this.lastMoveT = now;
      }
    };
    const up = (p: Phaser.Input.Pointer) => {
      if (p.id !== this.dragId) return;
      this.dragY = null;
      this.dragId = -1;
    };
    const wheel = (p: Phaser.Input.Pointer, _o: any, _dx: number, dy: number) => {
      if (this.active && this.visible && this.inside(p)) this.setScroll(this.scrollY + dy * 0.6);
    };
    this.handlers = [['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointerupoutside', up], ['wheel', wheel]];
    for (const [ev, fn] of this.handlers) scene.input.on(ev, fn);
    // sürükleme sonrası kayma (momentum)
    const tick = () => {
      if (this.dragY !== null || Math.abs(this.vel) < 0.01) return;
      this.setScroll(this.scrollY + this.vel * 16);
      this.vel *= 0.9;
    };
    scene.events.on('update', tick);
    this.handlers.push(['__update', tick]);
    scene.add.existing(this);
  }

  /**
   * İçerideki bir nesne bu basışı kendisi kullanıyor (kaydırıcı): liste kaydırmasın. Nesnenin pointerdown'u sahne
   * düzeyindeki dinleyiciden önce çalışır.
   */
  holdPointer(id: number) {
    this.heldId = id;
  }

  /** İşaretçi listenin görünen alanında mı? (Maske dışında kalan, kaydırılmış nesnelere dokunuşu ayıklamak için.) */
  containsPointer(p: Phaser.Input.Pointer) {
    return this.inside(p);
  }

  private inside(p: Phaser.Input.Pointer) {
    const lx = p.x / Display.uiZoom - this.worldX(), ly = p.y / Display.uiZoom - this.worldY();
    return lx >= 0 && ly >= 0 && lx <= this.w && ly <= this.h;
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
    this.drawBar();
  }

  /** Kaydırılabilir içerik varsa sağda ince bir kaydırma çubuğu. */
  private drawBar() {
    const g = this.bar;
    if (!g?.active) return;
    g.clear();
    if (this.contentH <= this.h + 1) return;
    const frac = this.h / this.contentH;
    const bh = Math.max(30, this.h * frac);
    const by = (this.scrollY / (this.contentH - this.h)) * (this.h - bh);
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(this.w - 6, 0, 5, this.h, 2);
    g.fillStyle(0xd9b45a, 0.8);
    g.fillRoundedRect(this.w - 6, by, 5, bh, 2);
  }

  clear() {
    this.inner.removeAll(true);
    this.contentH = 0;
    this.scrollY = 0;
    this.inner.y = 0;
    this.drawBar();
  }

  destroy(fromScene?: boolean) {
    const sc = this.scene;
    if (sc) {
      for (const [ev, fn] of this.handlers) {
        if (ev === '__update') sc.events.off('update', fn);
        else sc.input?.off(ev, fn);
      }
    }
    this.handlers = [];
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
