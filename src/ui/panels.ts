// Yeniden kullanılabilir paneller: kaydırılabilir liste, kart seçimi.
import Phaser from 'phaser';
import { Display } from '../game/display';
import { COLORS, FONT, txt, drawFrame, drawBlue, Button, fullScreenRect } from './kit';
import { Sound } from '../audio/audio';
import { DragGesture } from './dragGesture';
import { cardLayout, cardSections } from './cardLayout';

export class ScrollList extends Phaser.GameObjects.Container {
  inner: Phaser.GameObjects.Container;
  maskG: Phaser.GameObjects.Graphics;
  bar: Phaser.GameObjects.Graphics;
  scrollY = 0;
  contentH = 0;
  private dragY: number | null = null;
  private dragId = -1;
  private startScroll = 0;
  /** Sürükleme bilgisi jeste (basış zamanı) bağlı — bkz. dragGesture.ts. */
  private gesture = new DragGesture();
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
      this.gesture.begin(p.downTime);
      this.vel = 0;
    };
    const move = (p: Phaser.Input.Pointer) => {
      if (this.dragY === null || p.id !== this.dragId) return;
      if (!p.isDown) {
        // pointerup bir düğmede stopPropagation ile yutulduysa sürükleme burada biter
        this.dragY = null;
        this.dragId = -1;
        this.gesture.end();
        return;
      }
      const dy = (p.y - this.dragY) / Display.uiZoom;
      if (this.gesture.move(dy, p.downTime)) {
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
      this.gesture.end();
    };
    const wheel = (p: Phaser.Input.Pointer, _o: any, _dx: number, dy: number) => {
      if (this.active && this.visible && this.inside(p)) this.setScroll(this.scrollY + dy * 0.6);
    };
    this.handlers = [['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointerupoutside', up], ['wheel', wheel]];
    for (const [ev, fn] of this.handlers) scene.input.on(ev, fn);
    // sürükleme sonrası kayma (momentum)
    const tick = () => {
      if (this.dragY !== null && !scene.input.activePointer.isDown) {
        this.dragY = null;
        this.dragId = -1;
        this.gesture.end();
      }
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

  /** Şu anki (son) basış bir sürükleme miydi? Önceki kaydırmanın bayrağı yeni dokunuşu etkilemez. */
  wasDrag(p?: Phaser.Input.Pointer) {
    const ptr = p ?? this.scene?.input?.activePointer;
    return !!ptr && this.gesture.wasDrag(ptr.downTime);
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
  /** Kart çerçevesinin rengi (ör. skill nadirliği). */
  frame?: number;
  /** Seçilemez (ör. boş kart, SP yetersiz). */
  disabled?: boolean;
  /** Düğme yazısı (varsayılan "Seç"). */
  button?: string;
  /** Başlığın altında küçük renkli etiket (nadirlik adı). */
  tag?: { text: string; color: string };
  /** Açıklamanın altında küçük tablo (rütbe → not). */
  table?: string[];
  /** Renkli çubuklar (Sistem Teklifi: nadirlik şansları). */
  bars?: { label: string; color: number; value: number }[];
}

export interface ChoiceOpts {
  /** "Vazgeç" düğmesinin yazısı (true: "Vazgeç"). */
  cancel?: boolean | string;
  /** Vazgeçmeden önce onay sorusu. */
  cancelConfirm?: string;
}

/**
 * Ortada kartlarla seçim (Divine skill, Sistem Teklifi). İptal yoksa mutlaka biri seçilir.
 * 0.11.0 (B8/C12): tam ekran koyu karartma (arkadaki sayfa okunmaz), dikey uzun opak kartlar (2:3), nadirlik renginde
 * çerçeve ve hafif parlama; kartın içi simge → ad → etiket → açıklama (uzunsa kayar) → tablo → düğme; başlık kartların
 * üstünde, "Vazgeç" altında. Düzen ui/cardLayout (testli).
 */
export function panelChoice(scene: Phaser.Scene, title: string, opts: CardOpt[], blue = true, cancellable: boolean | string = false, extra: ChoiceOpts = {}): Promise<number> {
  return new Promise((resolve) => {
    const W = Display.uiW, H = Display.uiH;
    const c = scene.add.container(0, 0).setDepth(150);
    const dim = fullScreenRect(scene, 0x05040a, 0.93).setInteractive();
    c.add(dim);
    const L = cardLayout(W, H, opts.length, !!cancellable);
    const { cw, ch } = L;
    const head = txt(scene, W / 2, L.titleY, `【 ${title} 】`, { size: 24, font: FONT.title, color: blue ? '#e6f6ff' : COLORS.textGold, bold: true, stroke: true, align: 'center', wrap: W - 60 }).setOrigin(0.5);
    c.add(head);
    const lists: ScrollList[] = [];
    opts.forEach((o, i) => {
      const x = L.x0 + i * (cw + L.gap);
      const card = scene.add.container(x, L.cardsY);
      const g = scene.add.graphics();
      const frame = o.frame ?? (blue ? COLORS.blueEdge : COLORS.gold);
      // hafif parlama + opak gövde
      g.fillStyle(frame, o.disabled ? 0.06 : 0.16);
      g.fillRoundedRect(-6, -6, cw + 12, ch + 12, 14);
      g.fillStyle(0x000000, 0.5);
      g.fillRoundedRect(4, 6, cw, ch, 10);
      g.fillStyle(blue ? 0x0a1a3a : COLORS.panel, 1);
      g.fillRoundedRect(0, 0, cw, ch, 10);
      g.fillStyle(frame, o.disabled ? 0.05 : 0.14);
      g.fillRoundedRect(0, 0, cw, Math.round(ch * 0.3), { tl: 10, tr: 10, bl: 0, br: 0 });
      g.lineStyle(4, frame, o.disabled ? 0.4 : 1);
      g.strokeRoundedRect(2, 2, cw - 4, ch - 4, 9);
      g.lineStyle(1, 0xffffff, o.disabled ? 0.06 : 0.18);
      g.strokeRoundedRect(8, 8, cw - 16, ch - 16, 6);
      card.add(g);
      const inner = cw - 28;
      const tt = txt(scene, cw / 2, 0, o.title, { size: 17, bold: true, color: o.disabled ? '#9aa6b8' : '#ffffff', align: 'center', wrap: inner, font: FONT.title }).setOrigin(0.5, 0);
      const footer = o.footer ? txt(scene, cw / 2, 0, o.footer, { size: 12, italic: true, color: COLORS.textDim, align: 'center', wrap: inner }).setOrigin(0.5, 0) : null;
      // tablo (rütbe notları) ya da renkli çubuklar
      const tableObjs: Phaser.GameObjects.GameObject[] = [];
      let tableH = 0;
      if (o.bars?.length) {
        const bg = scene.add.graphics();
        tableObjs.push(bg);
        o.bars.forEach((b, k) => {
          const yy = k * 22;
          const lab = txt(scene, 14, yy, b.label, { size: 12, bold: true, color: '#dfe8f6' });
          const val = txt(scene, cw - 14, yy, `%${Math.round(b.value * 100)}`, { size: 12, bold: true, color: '#ffffff' }).setOrigin(1, 0);
          tableObjs.push(lab, val);
          (bg as any).__rows = [...((bg as any).__rows ?? []), { yy, b }];
        });
        tableH = o.bars.length * 22;
      } else if (o.table?.length) {
        // tablo kartın en çok %28'i; sığmayan satırlar alınmaz (kart dışına taşmaz)
        const maxH = Math.round(ch * 0.28);
        for (const line of o.table) {
          const t = txt(scene, 14, tableH, line, { size: 11, color: '#c8d4e8', wrap: inner });
          if (tableH + t.height > maxH) {
            t.destroy();
            break;
          }
          tableObjs.push(t);
          tableH += t.height + 2;
        }
      }
      const S = cardSections(ch, { icon: !!o.icon, titleH: tt.height, tag: !!o.tag, tableH, footerH: footer ? footer.height : 0 });
      if (o.icon && scene.textures.get('icons').has(o.icon)) card.add(scene.add.image(cw / 2, S.iconY, 'icons', o.icon).setScale(Math.min(1.5, cw / 160)));
      tt.y = S.titleY;
      card.add(tt);
      if (o.tag) card.add(txt(scene, cw / 2, S.tagY, o.tag.text, { size: 13, bold: true, color: o.tag.color, align: 'center' }).setOrigin(0.5, 0));
      // açıklama: alanına sığmazsa kart içinde kayar
      const desc = txt(scene, 0, 0, o.desc, { size: 13, color: blue ? COLORS.textBlue : COLORS.text, wrap: inner - 8, lineSpacing: 2 });
      if (desc.height <= S.descH) {
        desc.setPosition(14, S.descY);
        card.add(desc);
      } else {
        const list = new ScrollList(scene, 14, S.descY, inner, S.descH);
        list.inner.add(desc);
        list.setContentHeight(desc.height + 4);
        card.add(list);
        lists.push(list);
      }
      // tablo / çubuklar
      if (tableObjs.length) {
        const tc = scene.add.container(0, S.tableY);
        const sep = scene.add.graphics();
        sep.lineStyle(1, frame, 0.5);
        sep.lineBetween(14, -5, cw - 14, -5);
        tc.add(sep);
        for (const ob of tableObjs) {
          const rows = (ob as any).__rows as { yy: number; b: { color: number; value: number } }[] | undefined;
          if (rows) {
            const bg = ob as Phaser.GameObjects.Graphics;
            for (const r of rows) {
              bg.fillStyle(0x000000, 0.45);
              bg.fillRoundedRect(14, r.yy + 15, cw - 28, 4, 2);
              bg.fillStyle(r.b.color, 1);
              bg.fillRoundedRect(14, r.yy + 15, Math.max(2, (cw - 28) * r.b.value), 4, 2);
            }
          }
          tc.add(ob);
        }
        card.add(tc);
      }
      if (footer) {
        footer.y = S.footerY;
        card.add(footer);
      }
      const b = new Button(scene, cw / 2, S.buttonY, o.button ?? 'Seç', () => {
        Sound.sfx('skillup');
        c.destroy();
        resolve(i);
      }, { w: cw - 36, h: S.buttonH, style: blue ? 'blue' : 'gold', disabled: o.disabled, size: 15 });
      b.setName('card_' + i);
      card.add(b);
      card.setAlpha(0);
      card.y += 20;
      scene.tweens.add({ targets: card, alpha: 1, y: L.cardsY, duration: 300, delay: 120 * i, ease: 'Back.Out' });
      c.add(card);
    });
    if (cancellable) {
      const label = typeof cancellable === 'string' ? cancellable : 'Vazgeç';
      const b = new Button(scene, W / 2, L.cancelY, label, async () => {
        if (extra.cancelConfirm && !(await confirmBox(scene, extra.cancelConfirm, 'Evet', 'Hayır'))) return;
        c.destroy();
        resolve(-1);
      }, { w: Math.max(220, label.length * 11 + 60), h: 50 });
      b.setName('card_cancel');
      c.add(b);
    }
    c.once('destroy', () => lists.forEach((l) => l.destroy()));
  });
}

/** Basit onay penceresi. */
export function confirmBox(scene: Phaser.Scene, text: string, yes = 'Evet', no = 'Hayır'): Promise<boolean> {
  return new Promise((resolve) => {
    const W = Display.uiW, H = Display.uiH;
    const c = scene.add.container(0, 0).setDepth(160);
    c.add(fullScreenRect(scene, 0x000000, 0.5).setInteractive());
    const w = 520, h = 220;
    const g = scene.add.graphics();
    drawFrame(g, (W - w) / 2, (H - h) / 2, w, h);
    c.add(g);
    c.add(txt(scene, W / 2, (H - h) / 2 + 40, text, { size: 19, align: 'center', wrap: w - 60 }).setOrigin(0.5, 0));
    c.add(new Button(scene, W / 2 - 110, (H + h) / 2 - 50, yes, () => { c.destroy(); resolve(true); }, { w: 180, h: 54 }));
    c.add(new Button(scene, W / 2 + 110, (H + h) / 2 - 50, no, () => { c.destroy(); resolve(false); }, { w: 180, h: 54 }));
  });
}
