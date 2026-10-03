// Arayüz yapı taşları: altın süslemeli çerçeveler, mavi sistem paneli, butonlar, barlar.
import Phaser from 'phaser';
import { Display } from '../game/display';
import { Sound } from '../audio/audio';
import { richLine, hasMoneyTokens } from './coins';

export const COLORS = {
  gold: 0xd9b45a,
  goldDark: 0x6b5426,
  goldLight: 0xf3dc95,
  ink: 0x0f0c16,
  panel: 0x16121f,
  panel2: 0x221b2e,
  blue: 0x0b2350,
  blueEdge: 0x7cc8ff,
  blueGlow: 0x3d8bdb,
  hp: 0xc8323c,
  mp: 0x3a72d8,
  st: 0x6fbf4a,
  light: 0xf5d36a,
  text: '#efe6d2',
  textDim: '#a89c84',
  textGold: '#f0d27a',
  textBlue: '#bfe4ff',
  textRed: '#ff7a6e',
  textGreen: '#9fe08a',
};

export const FONT = {
  title: 'Cinzel, Georgia, serif',
  body: 'Alegreya, Georgia, serif',
  ui: 'AlegreyaSans, "Segoe UI", sans-serif',
  pixel: 'Pixelify, monospace',
};

export interface TextOpts {
  size?: number;
  color?: string;
  font?: string;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  wrap?: number;
  stroke?: boolean;
  shadow?: boolean;
  lineSpacing?: number;
}

export function txt(scene: Phaser.Scene, x: number, y: number, s: string, o: TextOpts = {}) {
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: o.font ?? FONT.ui,
    fontSize: `${o.size ?? 18}px`,
    color: o.color ?? COLORS.text,
    fontStyle: `${o.italic ? 'italic ' : ''}${o.bold ? 'bold' : ''}`.trim() || 'normal',
    align: o.align ?? 'left',
  };
  if (o.wrap) style.wordWrap = { width: o.wrap, useAdvancedWrap: true };
  if (o.stroke) {
    style.stroke = '#0a0810';
    style.strokeThickness = Math.max(2, Math.round((o.size ?? 18) / 6));
  }
  if (o.shadow) style.shadow = { offsetX: 0, offsetY: 2, color: '#000', blur: 4, fill: true };
  const t = scene.add.text(x, y, s, style);
  if (o.lineSpacing) t.setLineSpacing(o.lineSpacing);
  t.setResolution(Math.max(1, Display.uiZoom * 1.0));
  return t;
}

/** Koyu zemin, altın süslemeli çerçeve. */
export function drawFrame(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, opts: { alpha?: number; fill?: number; ornate?: boolean } = {}) {
  const a = opts.alpha ?? 0.94;
  g.fillStyle(0x000000, 0.35 * a);
  g.fillRoundedRect(x + 3, y + 5, w, h, 6);
  g.fillStyle(opts.fill ?? COLORS.panel, a);
  g.fillRoundedRect(x, y, w, h, 6);
  // iç degrade hissi
  g.fillStyle(0xffffff, 0.025 * a);
  g.fillRoundedRect(x + 3, y + 3, w - 6, h * 0.4, 5);
  g.lineStyle(2, COLORS.gold, 1);
  g.strokeRoundedRect(x, y, w, h, 6);
  g.lineStyle(1, COLORS.goldDark, 1);
  g.strokeRoundedRect(x + 5, y + 5, w - 10, h - 10, 4);
  if (opts.ornate !== false) {
    const c = (cx: number, cy: number, sx: number, sy: number) => {
      g.fillStyle(COLORS.goldLight, 1);
      g.fillTriangle(cx, cy - 5, cx + 5, cy, cx, cy + 5);
      g.fillTriangle(cx, cy - 5, cx - 5, cy, cx, cy + 5);
      g.lineStyle(2, COLORS.gold, 1);
      g.lineBetween(cx + sx * 7, cy, cx + sx * 22, cy);
      g.lineBetween(cx, cy + sy * 7, cx, cy + sy * 22);
    };
    c(x, y, 1, 1);
    c(x + w, y, -1, 1);
    c(x, y + h, 1, -1);
    c(x + w, y + h, -1, -1);
    if (w > 160) {
      g.fillStyle(COLORS.gold, 1);
      g.fillTriangle(x + w / 2 - 8, y, x + w / 2 + 8, y, x + w / 2, y + 6);
      g.fillTriangle(x + w / 2 - 8, y + h, x + w / 2 + 8, y + h, x + w / 2, y + h - 6);
    }
  }
}

/** Yarı saydam mavi sistem paneli (Status, sistem mesajları). */
export function drawBlue(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, alpha = 0.78) {
  g.fillStyle(0x020814, 0.35 * alpha);
  g.fillRect(x + 4, y + 6, w, h);
  g.fillStyle(COLORS.blue, alpha);
  g.fillRect(x, y, w, h);
  // tarama çizgileri
  g.fillStyle(0x6fb8ff, 0.035 * alpha);
  for (let yy = y + 2; yy < y + h; yy += 4) g.fillRect(x, yy, w, 1);
  g.fillStyle(0x9fd6ff, 0.08 * alpha);
  g.fillRect(x, y, w, Math.min(40, h * 0.18));
  g.lineStyle(1.5, COLORS.blueEdge, 0.95);
  g.strokeRect(x, y, w, h);
  g.lineStyle(1, COLORS.blueGlow, 0.6);
  g.strokeRect(x + 4, y + 4, w - 8, h - 8);
  // köşe parantezleri
  g.lineStyle(3, 0xd9f1ff, 1);
  const L = 16;
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]] as const) {
    g.lineBetween(cx, cy, cx + sx * L, cy);
    g.lineBetween(cx, cy, cx, cy + sy * L);
  }
}

export interface ButtonOpts {
  w?: number;
  h?: number;
  icon?: string;
  size?: number;
  style?: 'gold' | 'blue' | 'round' | 'ghost';
  color?: number;
  sound?: string | null;
  disabled?: boolean;
  textColor?: string;
}

export class Button extends Phaser.GameObjects.Container {
  bg: Phaser.GameObjects.Graphics;
  label: (Phaser.GameObjects.Text | (Phaser.GameObjects.Container & { rowWidth: number })) | null = null;
  iconImg: Phaser.GameObjects.Image | null = null;
  w: number;
  h: number;
  opts: ButtonOpts;
  private onClick: () => void;
  disabled = false;
  private hover = false;
  private down = false;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, onClick: () => void, opts: ButtonOpts = {}) {
    super(scene, x, y);
    this.opts = opts;
    this.w = opts.w ?? Math.max(120, text.length * 11 + 40);
    this.h = opts.h ?? 56;
    this.onClick = onClick;
    this.bg = scene.add.graphics();
    this.add(this.bg);
    if (opts.icon) {
      this.iconImg = scene.add.image(text ? -this.w / 2 + 28 : 0, 0, 'icons', opts.icon);
      const s = Math.round(((this.h - 18) / 34) * Display.uiZoom) / Display.uiZoom;
      this.iconImg.setScale(Math.min(s, 1.6));
      this.add(this.iconImg);
    }
    if (text) this.makeLabel(text);
    this.setSize(this.w, this.h);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerover', () => { this.hover = true; this.redraw(); });
    this.on('pointerout', () => { this.hover = false; this.down = false; this.redraw(); this.setScale(1); });
    this.on('pointerdown', (p: Phaser.Input.Pointer, lx: number, ly: number, ev: any) => {
      ev?.stopPropagation?.();
      if (this.disabled) { Sound.sfx('error'); return; }
      this.down = true;
      this.setScale(0.96);
      this.redraw();
    });
    this.on('pointerup', (p: Phaser.Input.Pointer, lx: number, ly: number, ev: any) => {
      ev?.stopPropagation?.();
      if (!this.down || this.disabled) return;
      this.down = false;
      this.setScale(1);
      this.redraw();
      if (opts.sound !== null) Sound.sfx(opts.sound ?? 'click');
      this.onClick();
    });
    this.disabled = !!opts.disabled;
    this.redraw();
    scene.add.existing(this);
  }

  setDisabled(d: boolean) {
    this.disabled = d;
    this.redraw();
    return this;
  }

  private labelText = '';

  /** Etiketi oluşturur; para işaretleri ({m:150}) varsa simgeli satır kullanılır. */
  private makeLabel(s: string) {
    this.labelText = s;
    const o = { size: this.opts.size ?? 20, font: FONT.ui, bold: true, color: this.opts.textColor ?? COLORS.text, align: 'center' as const };
    if (hasMoneyTokens(s)) this.label = richLine(this.scene, this.opts.icon ? 12 : 0, 0, s, { ...o, originX: 0.5 });
    else this.label = txt(this.scene, this.opts.icon ? 12 : 0, 0, s, o).setOrigin(0.5);
    this.label.setAlpha(this.disabled ? 0.5 : 1);
    this.add(this.label);
  }

  setText(s: string) {
    if (s === this.labelText && this.label) return this;
    if (!this.label) {
      // Etiket yoksa şimdi oluştur (boş metinle yaratılmış butonlar için).
      if (s) this.makeLabel(s);
      return this;
    }
    if (this.label instanceof Phaser.GameObjects.Text && !hasMoneyTokens(s)) {
      this.labelText = s;
      this.label.setText(s);
      return this;
    }
    this.label.destroy();
    this.label = null;
    if (s) this.makeLabel(s);
    return this;
  }

  redraw() {
    const g = this.bg;
    g.clear();
    const { w, h } = this;
    const st = this.opts.style ?? 'gold';
    const a = this.disabled ? 0.45 : 1;
    if (st === 'round') {
      const r = Math.min(w, h) / 2;
      g.fillStyle(0x000000, 0.35 * a);
      g.fillCircle(0, 3, r);
      g.fillStyle(this.opts.color ?? 0x1c1726, (this.down ? 0.95 : 0.78) * a);
      g.fillCircle(0, 0, r);
      g.lineStyle(2.5, this.down ? COLORS.goldLight : COLORS.gold, a);
      g.strokeCircle(0, 0, r);
      g.lineStyle(1, COLORS.goldDark, a);
      g.strokeCircle(0, 0, r - 5);
    } else if (st === 'blue') {
      g.fillStyle(this.down ? 0x1a4f94 : this.hover ? 0x163f78 : 0x0e2b57, 0.9 * a);
      g.fillRect(-w / 2, -h / 2, w, h);
      g.lineStyle(1.5, COLORS.blueEdge, a);
      g.strokeRect(-w / 2, -h / 2, w, h);
    } else if (st === 'ghost') {
      if (this.hover || this.down) {
        g.fillStyle(0xffffff, this.down ? 0.12 : 0.06);
        g.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
      }
    } else {
      g.fillStyle(0x000000, 0.35 * a);
      g.fillRoundedRect(-w / 2 + 2, -h / 2 + 4, w, h, 8);
      g.fillStyle(this.down ? 0x3a2e1a : this.hover ? 0x2c2337 : 0x1f1929, 0.97 * a);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
      g.fillStyle(0xffffff, 0.04 * a);
      g.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h / 2 - 3, 6);
      g.lineStyle(2, this.hover ? COLORS.goldLight : COLORS.gold, a);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
    }
    if (this.label) this.label.setAlpha(this.disabled ? 0.5 : 1);
    if (this.iconImg) this.iconImg.setAlpha(this.disabled ? 0.45 : 1);
  }
}

/** Basit bar (HP/MP/Dayanıklılık). */
export function drawBar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, frac: number, color: number, back = 0x120e18, ghost?: number) {
  g.fillStyle(0x000000, 0.5);
  g.fillRect(x - 2, y - 2, w + 4, h + 4);
  g.fillStyle(back, 1);
  g.fillRect(x, y, w, h);
  if (ghost !== undefined && ghost > frac) {
    g.fillStyle(0xffffff, 0.45);
    g.fillRect(x, y, w * Math.max(0, Math.min(1, ghost)), h);
  }
  g.fillStyle(color, 1);
  g.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  g.fillStyle(0xffffff, 0.22);
  g.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), Math.max(1, h * 0.35));
  g.lineStyle(1, COLORS.goldDark, 1);
  g.strokeRect(x - 1, y - 1, w + 2, h + 2);
}

export function iconImage(scene: Phaser.Scene, x: number, y: number, icon: string, size = 34) {
  const has = scene.textures.get('icons').has(icon);
  const im = scene.add.image(x, y, 'icons', has ? icon : 'stone');
  im.setScale(size / 34);
  return im;
}
