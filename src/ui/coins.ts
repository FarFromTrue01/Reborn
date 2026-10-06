// Para simgeleri ve simgeli metin.
// Metin içinde para göstermek için:  {m:150}  → bronz tutarı en az sayıda paraya bölünüp simgelerle yazılır
//                                    {w:silver:1} → belirli bir paradan belirli adet.
import Phaser from 'phaser';
import { COINS, canonicalCoins, COIN_NAMES, formatPrice, type Coin, type Wallet } from '../core/money';
import { txt, type TextOpts } from './kit';

export const COIN_TEX: Record<Coin, string> = {
  bronze: 'cn_bronze',
  silver: 'cn_silver',
  platinum: 'cn_platinum',
  gold: 'cn_gold',
  diamond: 'cn_diamond',
};

/** 16×16 piksel para simgeleri: her biri farklı renk VE farklı biçim (renk körlüğüne karşı). */
export function makeCoinTextures(scene: Phaser.Scene) {
  const S = 16;
  const mk = (key: string, draw: (p: (x: number, y: number, c: string) => void, r: (x: number, y: number, w: number, h: number, c: string) => void) => void) => {
    if (scene.textures.exists(key)) return;
    const t = scene.textures.createCanvas(key, S, S)!;
    const c = t.getContext();
    const p = (x: number, y: number, col: string) => { c.fillStyle = col; c.fillRect(x, y, 1, 1); };
    const r = (x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    draw(p, r);
    t.refresh();
  };
  const disc = (r: (x: number, y: number, w: number, h: number, c: string) => void, edge: string, face: string, hi: string, lo: string) => {
    // yuvarlak sikke (13 px)
    r(5, 1, 6, 1, edge); r(3, 2, 10, 1, edge); r(2, 3, 12, 1, edge);
    r(1, 4, 14, 7, edge);
    r(2, 11, 12, 1, edge); r(3, 12, 10, 1, edge); r(5, 13, 6, 1, edge);
    r(5, 2, 6, 1, face); r(3, 3, 10, 1, face); r(2, 4, 12, 7, face); r(3, 11, 10, 1, face); r(5, 12, 6, 1, face);
    r(4, 3, 4, 1, hi); r(3, 4, 2, 3, hi);
    r(11, 9, 2, 2, lo); r(8, 11, 4, 1, lo);
  };
  // Bronz: bakır rengi, ortası kare delikli
  mk(COIN_TEX.bronze, (p, r) => {
    disc(r, '#4a2410', '#c06a2c', '#f0a060', '#8a4418');
    r(7, 6, 2, 3, '#4a2410');
  });
  // Gümüş: gri, ortada kabartma çizgi (yarım ay)
  mk(COIN_TEX.silver, (p, r) => {
    disc(r, '#3a3e48', '#c8ced8', '#ffffff', '#8a90a0');
    r(6, 5, 1, 5, '#6a7080'); r(7, 4, 3, 1, '#6a7080'); r(7, 10, 3, 1, '#6a7080');
  });
  // Platin: altıgen, soluk mavi
  mk(COIN_TEX.platinum, (p, r) => {
    const e = '#2a3a58', f = '#bcd8f0', h = '#ffffff', l = '#7ea0c8';
    r(5, 1, 6, 1, e); r(4, 2, 8, 1, e); r(3, 3, 10, 1, e); r(2, 4, 12, 8, e); r(3, 12, 10, 1, e); r(4, 13, 8, 1, e); r(5, 14, 6, 1, e);
    r(5, 2, 6, 1, f); r(4, 3, 8, 1, f); r(3, 4, 10, 8, f); r(4, 12, 8, 1, f); r(5, 13, 6, 1, f);
    r(5, 3, 3, 1, h); r(4, 4, 2, 3, h); r(10, 10, 2, 2, l);
    r(7, 6, 2, 4, '#7ea0c8'); r(6, 7, 4, 2, '#7ea0c8');
  });
  // Altın: sarı, ortada yıldız
  mk(COIN_TEX.gold, (p, r) => {
    disc(r, '#5a3a06', '#f2c230', '#fff2a0', '#b08010');
    r(7, 4, 2, 7, '#b08010'); r(4, 7, 8, 2, '#b08010'); r(6, 6, 4, 4, '#b08010');
    r(7, 6, 2, 3, '#fff2a0');
  });
  // Elmas: camgöbeği kesme taş (sikke değil)
  mk(COIN_TEX.diamond, (p, r) => {
    const e = '#0a3a4a';
    r(4, 2, 8, 1, e); r(3, 3, 10, 1, e); r(2, 4, 12, 2, e);
    for (let i = 0; i < 7; i++) r(3 + i, 6 + i, 10 - 2 * i, 1, e);
    r(4, 3, 8, 1, '#9ff4ff'); r(3, 4, 10, 2, '#5ad8f0');
    for (let i = 0; i < 6; i++) r(4 + i, 6 + i, 8 - 2 * i, 1, i < 2 ? '#3ab8e0' : '#2a98c8');
    r(5, 3, 2, 1, '#ffffff'); r(4, 4, 2, 1, '#ffffff'); r(7, 7, 1, 2, '#e0ffff');
  });
}

export interface CoinRowOpts {
  size?: number; // simge boyu (birim)
  font?: number; // yazı boyu
  color?: string;
  gap?: number;
  stroke?: boolean;
  bold?: boolean;
  /** Hiç para yoksa bronz simgesi + 0 gösterilsin mi? */
  zero?: boolean;
}

/** Cüzdanı ya da tutarı simgelerle yazar: [bronz] 45  [gümüş] 1 (büyükten küçüğe). */
export function coinRow(scene: Phaser.Scene, x: number, y: number, value: number | Wallet | [Coin, number], o: CoinRowOpts = {}): Phaser.GameObjects.Container & { rowWidth: number } {
  const c = scene.add.container(x, y) as Phaser.GameObjects.Container & { rowWidth: number };
  const size = o.size ?? 18;
  const fs = o.font ?? Math.round(size * 0.95);
  let parts: [Coin, number][];
  if (Array.isArray(value)) parts = [value];
  else {
    const w = typeof value === 'number' ? canonicalCoins(Math.max(0, Math.floor(value))) : value;
    parts = [];
    for (let i = COINS.length - 1; i >= 0; i--) if (w[COINS[i]] > 0) parts.push([COINS[i], w[COINS[i]]]);
    if (!parts.length && o.zero !== false) parts.push(['bronze', 0]);
  }
  let cx = 0;
  for (const [coin, n] of parts) {
    const im = scene.add.image(cx + size / 2, 0, COIN_TEX[coin]).setDisplaySize(size, size);
    const t = txt(scene, cx + size + 3, 0, String(n), { size: fs, color: o.color ?? '#f3dc95', bold: o.bold ?? true, stroke: o.stroke }).setOrigin(0, 0.5);
    c.add([im, t]);
    cx += size + 3 + t.width + (o.gap ?? 8);
  }
  c.rowWidth = Math.max(0, cx - (o.gap ?? 8));
  c.setSize(c.rowWidth, size);
  return c;
}

const TOKEN = /\{m:(\d+)\}|\{w:(bronze|silver|platinum|gold|diamond):(\d+)\}/g;

export function hasMoneyTokens(s: string) {
  TOKEN.lastIndex = 0;
  return TOKEN.test(s);
}

/** Para işaretlerini düz metne çevirir (geçmiş, erişilebilirlik). */
export function plainMoney(s: string): string {
  return s.replace(TOKEN, (_m, amt, coin, n) => (amt !== undefined ? formatPrice(Number(amt)) : `${n} ${COIN_NAMES[coin as Coin]}`));
}

/**
 * Tek satırlık simgeli metin. originX: 0 sol, 0.5 orta, 1 sağ. y metnin dikey ortasıdır.
 */
export function richLine(scene: Phaser.Scene, x: number, y: number, s: string, o: TextOpts & { originX?: number } = {}): Phaser.GameObjects.Container & { rowWidth: number } {
  const c = scene.add.container(x, y) as Phaser.GameObjects.Container & { rowWidth: number };
  const size = o.size ?? 18;
  let cx = 0;
  let last = 0;
  TOKEN.lastIndex = 0;
  const push = (str: string) => {
    if (!str) return;
    const t = txt(scene, cx, 0, str, { ...o, wrap: undefined }).setOrigin(0, 0.5);
    c.add(t);
    cx += t.width;
  };
  let m: RegExpExecArray | null;
  while ((m = TOKEN.exec(s))) {
    push(s.slice(last, m.index));
    const row = coinRow(scene, cx + 2, 0, m[1] !== undefined ? Number(m[1]) : [m[2] as Coin, Number(m[3])], { size: Math.round(size * 1.05), font: size, color: o.color ?? '#f3dc95', stroke: o.stroke, bold: true });
    c.add(row);
    cx += row.rowWidth + 4;
    last = m.index + m[0].length;
  }
  push(s.slice(last));
  c.rowWidth = cx;
  const ox = o.originX ?? 0;
  for (const ch of c.list as any[]) ch.x -= cx * ox;
  c.setSize(cx, size);
  return c;
}

/** Yazı makinesi için simgeli paragraf: her para işareti tek "karakter" sayılır. */
export interface RichTyper {
  container: Phaser.GameObjects.Container;
  /** Para işaretleri tek karakter (¤) olmak üzere düz metin: duraklama kuralları için. */
  plain: string;
  show(n: number): void;
}

/**
 * Sarılı, simgeli (para) paragraf (0.9.0: görev verenlerin ödül replikleri). Kelimeler satıra sığdığı kadar tek bir
 * metin nesnesinde birleşir; para işaretleri coinRow olur. show(n) ilk n karakteri gösterir (yazı makinesi).
 */
export function richParagraph(scene: Phaser.Scene, x: number, y: number, s: string, o: TextOpts & { wrap: number; lineSpacing?: number }): RichTyper {
  const c = scene.add.container(x, y);
  const size = o.size ?? 18;
  const lineH = Math.round(size * 1.25) + (o.lineSpacing ?? 0);
  const style = { ...o, wrap: undefined };
  const probe = txt(scene, 0, -9999, '', style).setVisible(false);
  const measure = (str: string) => probe.setText(str).width;
  type Run = { kind: 'text'; obj: Phaser.GameObjects.Text; text: string } | { kind: 'coin'; obj: Phaser.GameObjects.Container };
  const runs: Run[] = [];
  let cx = 0, line = 0, cur = '', curX = 0, plain = '';
  const flush = () => {
    if (!cur) return;
    const t = txt(scene, curX, line * lineH, '', style);
    c.add(t);
    runs.push({ kind: 'text', obj: t, text: cur });
    cur = '';
  };
  const pieces: { word?: string; amount?: number; coin?: [Coin, number] }[] = [];
  TOKEN.lastIndex = 0;
  let last = 0;
  let m: RegExpExecArray | null;
  const words = (str: string) => {
    for (const w of str.split(/(?<=\s)/)) if (w) pieces.push({ word: w });
  };
  while ((m = TOKEN.exec(s))) {
    words(s.slice(last, m.index));
    if (m[1] !== undefined) pieces.push({ amount: Number(m[1]) });
    else pieces.push({ coin: [m[2] as Coin, Number(m[3])] });
    last = m.index + m[0].length;
  }
  words(s.slice(last));
  for (const p of pieces) {
    if (p.word !== undefined) {
      const wv = measure(p.word.trimEnd());
      if (cx > 0 && cx + wv > o.wrap) {
        flush();
        line++;
        cx = 0;
      }
      if (!cur) curX = cx;
      cur += p.word;
      cx = curX + measure(cur);
      plain += p.word;
    } else {
      flush();
      const row = coinRow(scene, 0, 0, p.amount !== undefined ? p.amount : p.coin!, { size: Math.round(size * 1.05), font: size, color: o.color ?? '#f3dc95', stroke: o.stroke, bold: true });
      if (cx > 0 && cx + row.rowWidth > o.wrap) {
        line++;
        cx = 0;
      }
      row.setPosition(cx + 2, line * lineH + size * 0.62);
      c.add(row);
      runs.push({ kind: 'coin', obj: row });
      cx += row.rowWidth + 3;
      plain += '¤';
    }
  }
  flush();
  probe.destroy();
  const show = (n: number) => {
    let left = n;
    for (const r of runs) {
      if (r.kind === 'text') {
        r.obj.setText(r.text.slice(0, Math.max(0, left)));
        left -= r.text.length;
      } else {
        r.obj.setVisible(left > 0);
        left -= 1;
      }
    }
  };
  show(0);
  return { container: c, plain, show };
}
