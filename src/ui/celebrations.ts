// Kutlama sahneleri (0.5.0): görev bitiş ödülleri ve rütbe atlama. İkisi de zaman çizelgesiyle çizilir
// (her kare `t` ilerler, her parça kendi aralığındaki ilerlemeyle kendini çizer). Dokununca önce sona atlar,
// ikinci dokunuş kapatır; dokunulmazsa kısa bir beklemeden sonra kendiliğinden kapanır.
import Phaser from 'phaser';
import { Display } from '../game/display';
import { Sound } from '../audio/audio';
import { COLORS, FONT, txt, drawFrame, uiIcon, rankBadge, iconImage, itemRankBadge, fitText } from './kit';
import { coinRow, richLine } from './coins';
import { expToNext } from '../core/formulas';
import { subRankToString, subRankLetter, type SubRank } from '../core/ranks';
import { ITEMS } from '../data/items';
import { KIND_ICON } from './hudQuests';
import { fmtExp } from './format';

/** Görev bitişinde gösterilecek ödüller (questrt → 'questdone'). */
export interface QuestDoneInfo {
  title: string;
  kind: string;
  /** Gerçekten ödenen para (bronz, borç düşüldükten sonra). */
  money: number;
  /** Loncaya olan borçtan düşülen. */
  toDebt: number;
  /** Lonca Puanı (yoksa 0) ve sonrası toplam. */
  points: number;
  pointsTotal: number;
  items: { id: string; qty: number }[];
  /** Verilen EXP (çarpanlar dahil) ve öncesi/sonrası. */
  exp: { amount: number; levelBefore: number; expBefore: number; levelAfter: number; expAfter: number } | null;
  /** Para yoksa gösterilen ödül metni. */
  text?: string;
}

export interface PromotionInfo {
  from: SubRank;
  to: SubRank;
  points: number;
}

interface Part {
  at: number;
  dur: number;
  draw: (p: number) => void;
  /** Başladığı an bir kez (ses). */
  onStart?: () => void;
  started?: boolean;
}

/** Ortak iskelet: tam ekran perde + zaman çizelgesi + dokununca atla/kapat. */
function overlay(scene: Phaser.Scene, depth: number, shadeAlpha: number, holdMs: number, onDone: () => void) {
  const W = Display.uiW, H = Display.uiH;
  const root = scene.add.container(0, 0).setDepth(depth);
  const shade = scene.add.rectangle(0, 0, W, H, 0x000000, shadeAlpha).setOrigin(0, 0).setInteractive();
  root.add(shade);
  const parts: Part[] = [];
  let t = 0;
  let total = 0;
  let closing = false;
  const hint = txt(scene, W / 2, H - 34, 'Devam etmek için dokun', { size: 14, italic: true, color: '#cfc3a6', stroke: true }).setOrigin(0.5).setAlpha(0).setDepth(depth + 1);
  const finish = () => {
    if (closing) return;
    closing = true;
    scene.events.off('update', tick);
    scene.tweens.add({ targets: [root, hint], alpha: 0, duration: 220, onComplete: () => { root.destroy(); hint.destroy(); onDone(); } });
  };
  const render = () => {
    for (const p of parts) {
      if (t < p.at) continue;
      if (!p.started) {
        p.started = true;
        p.onStart?.();
      }
      p.draw(Math.min(1, (t - p.at) / Math.max(1, p.dur)));
    }
    hint.setAlpha(t >= total ? Math.min(1, (t - total) / 300) : 0);
  };
  const tick = (_time: number, dt: number) => {
    if (closing) return;
    t += Math.min(dt, 250);
    render();
    if (t >= total + holdMs) finish();
  };
  shade.on('pointerdown', (_p: any, _x: number, _y: number, ev: any) => {
    ev?.stopPropagation?.();
    if (t < total) {
      // sona atla: sesleri çalmadan son kareyi çiz
      t = total;
      for (const p of parts) p.started = true;
      render();
    } else finish();
  });
  scene.events.on('update', tick);
  root.once('destroy', () => scene.events.off('update', tick));
  return {
    root,
    add(part: Part) {
      parts.push(part);
      total = Math.max(total, part.at + part.dur);
    },
    get total() {
      return total;
    },
    skip() {
      t = total + holdMs;
      for (const p of parts) p.started = true;
      render();
      finish();
    },
  };
}

const ease = Phaser.Math.Easing;

// ====================================================================== görev bitişi
export function playQuestComplete(scene: Phaser.Scene, q: QuestDoneInfo, onDone: () => void) {
  const W = Display.uiW, H = Display.uiH;
  const ov = overlay(scene, 120, 0.45, 1800, onDone);
  const pw = Math.min(540, W - 40);
  // satırlar: kaç tane olacağı baştan belli → panel yüksekliği
  const rows: ('money' | 'debt' | 'exp' | 'item' | 'points' | 'text')[] = [];
  if (q.money > 0) rows.push('money');
  if (q.toDebt > 0) rows.push('debt');
  if (q.exp && q.exp.amount > 0) rows.push('exp');
  for (let i = 0; i < q.items.length; i++) rows.push('item');
  if (q.points > 0) rows.push('points');
  if (q.text && q.money <= 0) rows.push('text');
  const rowH = 44;
  const ph = 112 + Math.max(1, rows.length) * rowH + 16;
  const px = (W - pw) / 2, py = Math.max(20, (H - ph) / 2 - 20);
  const panel = scene.add.container(W / 2, py + ph / 2);
  ov.root.add(panel);
  const g = scene.add.graphics();
  drawFrame(g, -pw / 2, -ph / 2, pw, ph);
  panel.add(g);
  // ışık şeridi
  const glow = scene.add.graphics();
  glow.fillStyle(COLORS.gold, 0.08);
  glow.fillRoundedRect(-pw / 2 + 8, -ph / 2 + 8, pw - 16, 82, 8);
  panel.add(glow);
  const top = -ph / 2;
  panel.add(uiIcon(scene, -pw / 2 + 40, top + 44, KIND_ICON[q.kind] ?? 'quests', 34));
  const head = txt(scene, 0, top + 18, 'GÖREV TAMAMLANDI', { size: 24, bold: true, font: FONT.title, color: COLORS.textGold, stroke: true }).setOrigin(0.5, 0);
  panel.add(head);
  panel.add(fitText(txt(scene, 0, top + 54, q.title, { size: 17, italic: true, color: '#efe6d2' }), pw - 140).setOrigin(0.5, 0));
  const kindLabel = q.kind === 'main' ? 'Ana görev' : q.kind === 'board' ? 'Pano görevi' : 'Yan görev';
  panel.add(txt(scene, pw / 2 - 22, top + 22, kindLabel, { size: 12, color: '#a89c84' }).setOrigin(1, 0));
  const lineG = scene.add.graphics();
  lineG.lineStyle(1, COLORS.gold, 0.4);
  lineG.lineBetween(-pw / 2 + 30, top + 96, pw / 2 - 30, top + 96);
  panel.add(lineG);
  panel.setScale(0.85).setAlpha(0);
  ov.add({ at: 0, dur: 260, onStart: () => Sound.sfx('title', 0.9), draw: (p) => { panel.setAlpha(p); panel.setScale(0.85 + 0.15 * ease.Back.Out(p)); } });

  let at = 320;
  let ry = top + 112;
  const lx = -pw / 2 + 34, rx = pw / 2 - 34;
  let itemNo = 0;
  const rowIn = (c: Phaser.GameObjects.Container, p: number) => {
    c.setAlpha(Math.min(1, p * 3));
    c.x = -16 * (1 - Math.min(1, p * 3));
  };
  for (const kind of rows) {
    const row = scene.add.container(0, ry);
    row.setAlpha(0);
    panel.add(row);
    if (kind === 'money') {
      row.add(uiIcon(scene, lx + 10, 14, 'money', 24));
      row.add(txt(scene, lx + 28, 3, 'Ödül', { size: 16, bold: true, color: '#cfeaff' }));
      let shown = -1;
      let coins: (Phaser.GameObjects.Container & { rowWidth: number }) | null = null;
      const total = q.money;
      ov.add({
        at, dur: 820, onStart: () => Sound.sfx('coin', 0.7),
        draw: (p) => {
          rowIn(row, p);
          const v = Math.round(total * ease.Cubic.Out(Math.min(1, p * 1.15)));
          if (v === shown) return;
          // sayarken her ~1/6'da bir şıngırtı
          if (shown >= 0 && Math.floor((v / Math.max(1, total)) * 6) !== Math.floor((shown / Math.max(1, total)) * 6)) Sound.sfx('coin', 0.35);
          shown = v;
          coins?.destroy();
          coins = coinRow(scene, 0, 14, v, { size: 24, font: 20 });
          coins.x = rx - coins.rowWidth;
          row.add(coins);
        },
      });
      at += 900;
    } else if (kind === 'debt') {
      row.add(uiIcon(scene, lx + 10, 14, 'debt', 20));
      row.add(richLine(scene, lx + 28, 14, `Loncaya borçtan düşüldü: {m:${q.toDebt}}`, { size: 14, color: '#ffb0a0' }));
      ov.add({ at, dur: 300, draw: (p) => rowIn(row, p) });
      at += 320;
    } else if (kind === 'exp') {
      const e = q.exp!;
      row.add(uiIcon(scene, lx + 10, 14, 'exp', 22));
      row.add(txt(scene, lx + 28, 3, `+${fmtExp(e.amount)} EXP`, { size: 16, bold: true, color: '#d8c8ff' }));
      const bx = lx + 150, bw = rx - bx, bh = 16;
      const bar = scene.add.graphics();
      row.add(bar);
      const lvT = txt(scene, rx, -10, '', { size: 12, bold: true, color: '#cfc3ff' }).setOrigin(1, 0);
      row.add(lvT);
      // barın sol üstünde (barı örtmesin)
      const up = scene.add.container(bx, -3);
      const upT = txt(scene, 0, 0, 'LEVEL ATLADIN!', { size: 15, bold: true, font: FONT.title, color: '#ffe46a', stroke: true }).setOrigin(0, 0.5);
      up.add(upT);
      up.setAlpha(0);
      row.add(up);
      // ilerleme: önceki levelin dolu kısmından sonuna kadar, level atlandıysa her level için bir dolum
      const levels = e.levelAfter - e.levelBefore;
      const segs = levels + 1;
      const dur = 900 + levels * 500;
      let lastSeg = -1;
      ov.add({
        at, dur,
        draw: (p) => {
          rowIn(row, p);
          const f = p * segs;
          const seg = Math.min(segs - 1, Math.floor(f));
          const sp = seg === segs - 1 ? Math.min(1, (f - seg) / 1) : Math.min(1, f - seg);
          const lv = e.levelBefore + seg;
          const from = seg === 0 ? e.expBefore / expToNext(e.levelBefore) : 0;
          const to = seg === segs - 1 ? e.expAfter / expToNext(lv) : 1;
          const frac = from + (to - from) * ease.Quadratic.Out(sp);
          bar.clear();
          bar.fillStyle(0x000000, 0.55);
          bar.fillRoundedRect(bx, 6, bw, bh, bh / 2);
          bar.fillStyle(0x9a6ae8, 1);
          if (frac > 0) bar.fillRoundedRect(bx, 6, Math.max(bh, bw * Math.min(1, frac)), bh, bh / 2);
          bar.fillStyle(0xffffff, 0.2);
          if (frac > 0) bar.fillRect(bx + 4, 8, Math.max(0, bw * Math.min(1, frac) - 8), 4);
          bar.lineStyle(1, COLORS.goldDark, 1);
          bar.strokeRoundedRect(bx, 6, bw, bh, bh / 2);
          lvT.setText(`Level ${lv} · ${Math.round(frac * expToNext(lv))} / ${expToNext(lv)}`);
          if (seg > lastSeg) {
            if (lastSeg >= 0) {
              // level atlandı: vurgu
              Sound.sfx('levelup', 0.8);
              up.setAlpha(1).setScale(1.6);
              scene.tweens.add({ targets: up, scale: 1, duration: 260, ease: 'Back.Out' });
            }
            lastSeg = seg;
          }
          if (levels > 0 && p >= 1) up.setAlpha(1).setScale(1);
        },
      });
      at += dur + 120;
    } else if (kind === 'item') {
      const it = q.items[itemNo++];
      const def = ITEMS[it.id];
      row.add(iconImage(scene, lx + 12, 14, def?.icon ?? 'stone', 28));
      const nt = txt(scene, lx + 34, 3, def?.name ?? it.id, { size: 16, bold: true, color: COLORS.text });
      row.add(fitText(nt, rx - lx - 120));
      if (def?.rank) row.add(itemRankBadge(scene, lx + 46 + nt.width, 14, def.rank, 18));
      row.add(txt(scene, rx, 3, `×${it.qty}`, { size: 16, bold: true, color: '#f3dc95' }).setOrigin(1, 0));
      ov.add({ at, dur: 260, onStart: () => Sound.sfx('pickup', 0.6), draw: (p) => rowIn(row, p) });
      at += 240;
    } else if (kind === 'points') {
      row.add(uiIcon(scene, lx + 10, 14, 'points', 22));
      const pt = txt(scene, lx + 28, 3, '', { size: 16, bold: true, color: '#f3dc95' });
      row.add(pt);
      const tot = txt(scene, rx, 4, `Toplam ${q.pointsTotal}`, { size: 14, color: '#d8c890' }).setOrigin(1, 0);
      row.add(tot);
      ov.add({ at, dur: 600, onStart: () => Sound.sfx('skillup', 0.6), draw: (p) => { rowIn(row, p); pt.setText(`+${Math.round(q.points * ease.Cubic.Out(p))} Lonca Puanı`); } });
      at += 640;
    } else if (kind === 'text') {
      row.add(uiIcon(scene, lx + 10, 14, 'reward', 22));
      row.add(fitText(txt(scene, lx + 28, 4, q.text ?? '', { size: 15, color: '#cfe6b8' }), rx - lx - 30));
      ov.add({ at, dur: 300, draw: (p) => rowIn(row, p) });
      at += 320;
    }
    ry += rowH;
  }
  return ov;
}

// ====================================================================== rütbe atlama
/**
 * Terfi anı: eski rozet parlayıp döner ve yeni rozete dönüşür; ışık patlaması, dönen ışınlar, kıvılcımlar,
 * yeni rütbe harfi büyük olarak belirir. Oyunun en önemli ilerleme anlarından biri — sysmsg "big"den gösterişli.
 */
export function playRankUp(scene: Phaser.Scene, info: PromotionInfo, onDone: () => void) {
  const W = Display.uiW, H = Display.uiH;
  const ov = overlay(scene, 125, 0.8, 2600, onDone);
  const cx = W / 2, cy = H / 2 - 40;
  // dönen ışınlar
  const rays = scene.add.graphics().setPosition(cx, cy);
  const drawRays = (a: number, alpha: number, len: number) => {
    rays.clear();
    const n = 14;
    for (let i = 0; i < n; i++) {
      const t0 = a + (i / n) * Math.PI * 2;
      rays.fillStyle(i % 2 ? 0xffe9a0 : 0xd9b45a, alpha * (i % 2 ? 0.16 : 0.1));
      rays.fillTriangle(0, 0, Math.cos(t0 - 0.09) * len, Math.sin(t0 - 0.09) * len, Math.cos(t0 + 0.09) * len, Math.sin(t0 + 0.09) * len);
    }
  };
  ov.root.add(rays);
  const halo = scene.add.graphics().setPosition(cx, cy);
  ov.root.add(halo);
  const header = txt(scene, cx, cy - 170, 'TERFİ', { size: 30, bold: true, font: FONT.title, color: COLORS.textGold, stroke: true }).setOrigin(0.5).setAlpha(0);
  ov.root.add(header);
  const sub = txt(scene, cx, cy - 136, 'Maceracılar Loncası · Brindlewood Şubesi', { size: 15, italic: true, color: '#e8dcc0', stroke: true }).setOrigin(0.5).setAlpha(0);
  ov.root.add(sub);
  const oldB = rankBadge(scene, cx, cy, info.from, 132, true);
  const newB = rankBadge(scene, cx, cy, info.to, 132, true);
  newB.setScale(0, 1).setAlpha(0);
  oldB.setAlpha(0);
  ov.root.add([oldB, newB]);
  const ring = scene.add.graphics().setPosition(cx, cy);
  ov.root.add(ring);
  const flash = scene.add.rectangle(0, 0, W, H, 0xffffff, 0).setOrigin(0, 0);
  ov.root.add(flash);
  const letter = txt(scene, cx, cy + 128, subRankLetter(info.to), { size: 96, bold: true, font: FONT.title, color: '#ffe46a', stroke: true, shadow: true }).setOrigin(0.5).setAlpha(0);
  ov.root.add(letter);
  const change = txt(scene, cx, cy + 196, `${subRankToString(info.from).replace('-', '−')}  →  ${subRankToString(info.to).replace('-', '−')}`, { size: 22, bold: true, color: '#ffffff', stroke: true }).setOrigin(0.5).setAlpha(0);
  ov.root.add(change);
  const pts = txt(scene, cx, cy + 226, `Lonca Puanı ${info.points}`, { size: 15, color: '#d8c890', stroke: true }).setOrigin(0.5).setAlpha(0);
  ov.root.add(pts);
  // kıvılcımlar (sabit tohumlu, yeniden çizilebilir)
  const sparks = scene.add.graphics().setPosition(cx, cy);
  ov.root.add(sparks);
  const N = 36;
  const sp = Array.from({ length: N }, (_, i) => ({ a: (i / N) * Math.PI * 2 + (i % 3) * 0.13, v: 160 + ((i * 53) % 140), s: 2 + (i % 3) }));

  // 0 — giriş: perde, ışınlar, eski rozet
  ov.add({ at: 0, dur: 500, onStart: () => Sound.sfx('system', 0.9), draw: (p) => { header.setAlpha(p); sub.setAlpha(p); oldB.setAlpha(p).setScale(0.6 + 0.4 * ease.Back.Out(p)); } });
  // ışınlar bütün sahne boyunca döner
  ov.add({ at: 0, dur: 4200, draw: (p) => drawRays(p * Math.PI * 1.4, Math.min(1, p * 4), 220 + 120 * Math.min(1, p * 2)) });
  // 1 — eski rozet titrer ve parlar
  ov.add({
    at: 550, dur: 650, onStart: () => Sound.sfx('windup', 0.7),
    draw: (p) => {
      oldB.x = cx + Math.sin(p * 60) * 5 * p;
      halo.clear();
      halo.fillStyle(0xfff2b0, 0.25 * p);
      halo.fillCircle(0, 0, 70 + 30 * p);
      halo.fillStyle(0xffffff, 0.2 * p);
      halo.fillCircle(0, 0, 50 + 20 * p);
    },
  });
  // 2 — dönüşüm: eski rozet yatayda kapanır, yeni rozet açılır (para gibi döner)
  ov.add({ at: 1200, dur: 220, draw: (p) => { oldB.x = cx; oldB.setScale(1 - ease.Quadratic.In(p), 1); if (p >= 1) oldB.setAlpha(0); } });
  ov.add({
    at: 1420, dur: 420,
    onStart: () => { Sound.sfx('levelup', 1); Sound.sfx('holy', 0.8); },
    draw: (p) => {
      newB.setAlpha(1).setScale(ease.Back.Out(p) * 1.12 - 0.12 * p, 1.12 - 0.12 * p);
      flash.setFillStyle(0xffffff, 0.75 * (1 - p));
      ring.clear();
      ring.lineStyle(6 * (1 - p) + 1, 0xffe9a0, 1 - p);
      ring.strokeCircle(0, 0, 70 + 240 * ease.Cubic.Out(p));
      ring.lineStyle(3 * (1 - p) + 1, 0xffffff, (1 - p) * 0.8);
      ring.strokeCircle(0, 0, 50 + 160 * ease.Cubic.Out(p));
      halo.clear();
      halo.fillStyle(0xfff2b0, 0.3 * (1 - p) + 0.12);
      halo.fillCircle(0, 0, 100);
    },
  });
  // kıvılcım patlaması
  ov.add({
    at: 1420, dur: 1100,
    draw: (p) => {
      sparks.clear();
      for (const s of sp) {
        const d = s.v * ease.Cubic.Out(p);
        sparks.fillStyle(p < 0.5 ? 0xffffff : 0xffe46a, 1 - p);
        sparks.fillCircle(Math.cos(s.a) * d, Math.sin(s.a) * d + 40 * p * p, s.s * (1 - p * 0.5));
      }
    },
  });
  // 3 — büyük harf ve yazılar
  ov.add({ at: 1760, dur: 380, onStart: () => Sound.sfx('title', 0.8), draw: (p) => { letter.setAlpha(p).setScale(2.2 - 1.2 * ease.Back.Out(p)); } });
  ov.add({ at: 2000, dur: 360, draw: (p) => { change.setAlpha(p); change.y = cy + 196 + 10 * (1 - p); } });
  ov.add({ at: 2200, dur: 360, draw: (p) => pts.setAlpha(p) });
  // sürekli hafif nabız
  ov.add({ at: 1840, dur: 2400, draw: (p) => { const k = 1 + Math.sin(p * Math.PI * 4) * 0.025; newB.setScale(k, k); halo.clear(); halo.fillStyle(0xfff2b0, 0.12); halo.fillCircle(0, 0, 96 + Math.sin(p * Math.PI * 4) * 6); } });
  return ov;
}
