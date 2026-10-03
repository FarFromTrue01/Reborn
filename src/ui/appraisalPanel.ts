// Appraisal paneli (B1): kategorilere ayrılmış, simgeli, altın-koyu temalı bilgi kartı.
// Görünürlük core/appraisal kurallarına uyar; trait'ler hiçbir rütbede görünmez.
import Phaser from 'phaser';
import { COLORS, FONT, txt, uiIcon, rankBadge, iconImage } from './kit';
import { appraisalView, type AppraisalView } from '../core/appraisal';
import { derive } from '../core/creature';
import { subRankToString, skillThreshold, SUBRANK_MAX } from '../core/ranks';
import { STAT_KEYS } from '../core/formulas';
import { EQUIP_SLOTS } from '../core/types';
import { ITEMS } from '../data/items';
import { SKILLS } from '../data/skills';
import { TITLES } from '../data/titles';
import { fmtExp } from './format';
import type { NpcDef } from '../data/npcs';

const Q = '???';

/** İnce, uzun, yarı saydam ayırıcı çizgi; ortada küçük bir süs. */
export function ornamentLine(g: Phaser.GameObjects.Graphics, x0: number, x1: number, y: number) {
  const cx = (x0 + x1) / 2;
  g.lineStyle(1, COLORS.gold, 0.32);
  g.lineBetween(x0, y, cx - 14, y);
  g.lineBetween(cx + 14, y, x1, y);
  g.fillStyle(COLORS.gold, 0.7);
  g.fillTriangle(cx - 6, y, cx, y - 4, cx + 6, y);
  g.fillTriangle(cx - 6, y, cx, y + 4, cx + 6, y);
  g.fillStyle(COLORS.gold, 0.45);
  g.fillCircle(cx - 11, y, 1.5);
  g.fillCircle(cx + 11, y, 1.5);
}

export interface AppraisalOpts {
  self?: boolean;
  /** Sahibi oyuncu mu (kendi kartı): tam görünüm, EXP ilerlemesi dahil. */
  mineRank: number;
}

export function buildAppraisalPanel(scene: Phaser.Scene, c: any, npc: NpcDef | null, opts: AppraisalOpts): Phaser.GameObjects.Container {
  const theirs = c.skills.find((s: any) => s.id === 'appraisal')?.rank ?? 0;
  const v: AppraisalView = opts.self
    ? { diff: -9, title: true, identity: true, stats: true, skills: true, skillExp: true, traits: false }
    : appraisalView(opts.mineRank, theirs);
  const d = derive(c);
  const W = 660;
  const cont = scene.add.container(0, 0);
  const bg = scene.add.graphics();
  cont.add(bg);
  const deco = scene.add.graphics();
  let y = 16;
  // ------------------------------------------------------------ başlık
  cont.add(uiIcon(scene, 30, y + 14, opts.self ? 'eye' : 'appraisal', 30));
  cont.add(txt(scene, 54, y, 'APPRAISAL', { size: 14, bold: true, font: FONT.title, color: '#c9a956' }));
  cont.add(txt(scene, 54, y + 16, v.identity ? c.name : Q, { size: 26, bold: true, font: FONT.title, color: v.identity ? '#fff4d6' : '#7a6e5a' }));
  const diffTxt = opts.self ? 'Kendine bakıyorsun.' : v.diff >= 2 ? 'Hedef çok üstün: sadece Title okunabiliyor.' : v.diff === 1 ? 'Hedefin direnci senden bir harf yüksek.' : v.diff === 0 ? 'Rütbeleriniz eşit.' : v.diff === -1 ? 'Hedef senden bir harf düşük.' : 'Hedef seninle kıyaslanamayacak kadar düşük.';
  cont.add(txt(scene, W - 24, y + 4, diffTxt, { size: 13, italic: true, color: '#b8a888', align: 'right', wrap: 260 }).setOrigin(1, 0));
  y += 56;
  ornamentLine(deco, 20, W - 20, y);
  y += 12;

  const section = (icon: string, title: string) => {
    cont.add(uiIcon(scene, 30, y + 10, icon, 22));
    cont.add(txt(scene, 48, y, title.toUpperCase(), { size: 14, bold: true, font: FONT.title, color: COLORS.textGold }));
    y += 26;
  };
  const pair = (x: number, yy: number, icon: string, label: string, val: string, w = 280) => {
    cont.add(uiIcon(scene, x + 10, yy + 9, icon, 18));
    cont.add(txt(scene, x + 26, yy, label, { size: 13, color: '#a89c84' }));
    const vt = txt(scene, x + 108, yy - 1, val, { size: 15, bold: true, color: val === Q ? '#6f6656' : COLORS.text, wrap: w - 112 });
    cont.add(vt);
    return Math.max(22, vt.height + 4);
  };

  // ------------------------------------------------------------ kimlik
  section('identity', 'Kimlik');
  const titles = c.titles?.length ? c.titles.map((t: string) => `${TITLES[t]?.name ?? t} (${TITLES[t]?.rank ?? '?'})`).join(', ') : 'Yok';
  const h1 = pair(20, y, 'race', 'Irk', v.identity ? c.race : Q);
  pair(340, y, 'gender', 'Cinsiyet', v.identity ? c.gender : Q);
  y += h1;
  const h2 = pair(20, y, 'age', 'Yaş', v.identity ? String(c.age ?? '—') : Q);
  const h3 = pair(340, y, 'title', 'Title', titles, 300);
  y += Math.max(h2, h3) + 4;
  ornamentLine(deco, 40, W - 40, y);
  y += 10;

  // ------------------------------------------------------------ level ve rütbe
  section('level', 'Level ve Rütbe');
  cont.add(txt(scene, 26, y - 2, 'Level', { size: 13, color: '#a89c84' }));
  cont.add(txt(scene, 72, y - 8, v.identity ? String(c.level) : Q, { size: 26, bold: true, font: FONT.title, color: '#ffd75e' }));
  const rank = c.guildRank;
  cont.add(txt(scene, 200, y - 2, 'Lonca rütbesi', { size: 13, color: '#a89c84' }));
  if (!v.identity) cont.add(txt(scene, 300, y - 3, Q, { size: 16, bold: true, color: '#6f6656' }));
  else if (rank !== null && rank !== undefined) {
    cont.add(rankBadge(scene, 316, y + 8, rank, 30));
    cont.add(txt(scene, 336, y - 2, npc?.guildLabel ?? subRankToString(rank), { size: 16, bold: true, color: COLORS.textGold }));
  } else cont.add(txt(scene, 300, y - 2, npc?.guildLabel ?? 'Yok', { size: 15, bold: true, color: COLORS.text }));
  // HP / MP
  const bx = 440;
  const bar = (yy: number, icon: string, label: string, cur: number, max: number, color: number, show: boolean) => {
    cont.add(uiIcon(scene, bx, yy + 7, icon, 16));
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.55);
    g.fillRoundedRect(bx + 12, yy, 180, 14, 7);
    if (show) {
      g.fillStyle(color, 1);
      g.fillRoundedRect(bx + 12, yy, Math.max(14, 180 * Math.max(0, Math.min(1, max ? cur / max : 0))), 14, 7);
    }
    cont.add(g);
    cont.add(txt(scene, bx + 20, yy - 1, show ? `${label} ${Math.ceil(cur)} / ${max}` : `${label} ${Q}`, { size: 12, bold: true, stroke: true }));
  };
  bar(y - 6, 'hp', 'HP', npc ? d.maxHp : opts.self ? c.hp : c.hp, d.maxHp, COLORS.hp, v.stats);
  bar(y + 14, 'mp', 'MP', opts.self ? c.mp : d.maxMp, d.maxMp, COLORS.mp, v.stats);
  y += 38;
  ornamentLine(deco, 40, W - 40, y);
  y += 10;

  // ------------------------------------------------------------ statlar
  section('stats', 'Statlar');
  const sw = (W - 40) / 7;
  STAT_KEYS.forEach((k, i) => {
    const x = 20 + i * sw;
    const g = scene.add.graphics();
    g.fillStyle(0x221b2e, 0.95);
    g.fillRoundedRect(x + 3, y - 2, sw - 6, 46, 8);
    g.lineStyle(1, COLORS.goldDark, 1);
    g.strokeRoundedRect(x + 3, y - 2, sw - 6, 46, 8);
    cont.add(g);
    cont.add(uiIcon(scene, x + 18, y + 12, k, 20));
    cont.add(txt(scene, x + 32, y + 3, k, { size: 12, bold: true, color: '#c9b98f' }));
    cont.add(txt(scene, x + sw / 2, y + 22, v.stats ? String(d.stats[k]) : Q, { size: 17, bold: true, color: v.stats ? '#ffffff' : '#6f6656' }).setOrigin(0.5, 0));
  });
  y += 54;
  ornamentLine(deco, 40, W - 40, y);
  y += 10;

  // ------------------------------------------------------------ skill'ler
  section('skills', 'Skill\'ler');
  if (!v.skills) {
    cont.add(txt(scene, 30, y, Q, { size: 15, bold: true, color: '#6f6656' }));
    y += 24;
  } else {
    let x = 24;
    for (const s of c.skills) {
      const def = SKILLS[s.id];
      const max = s.rank >= SUBRANK_MAX;
      const label = `${def?.name ?? s.id} (${subRankToString(s.rank)})${v.skillExp ? (max ? ' [MAX]' : ` [${fmtExp(s.exp)}/${skillThreshold(s.rank)}]`) : ''}`;
      const t = txt(scene, 0, 0, label, { size: 14, bold: true, color: '#e8f2ff' });
      const cw = t.width + 40;
      if (x + cw > W - 20) {
        x = 24;
        y += 30;
      }
      const g = scene.add.graphics();
      g.fillStyle(0x16233f, 0.95);
      g.fillRoundedRect(x, y - 3, cw, 26, 13);
      g.lineStyle(1, 0x7cc8ff, 0.6);
      g.strokeRoundedRect(x, y - 3, cw, 26, 13);
      cont.add(g);
      if (def?.icon) cont.add(iconImage(scene, x + 14, y + 10, def.icon, 18));
      t.setPosition(x + 28, y);
      cont.add(t);
      x += cw + 8;
    }
    y += 32;
  }
  ornamentLine(deco, 40, W - 40, y);
  y += 10;

  // ------------------------------------------------------------ ekipman ve envanter
  section('equipment', 'Ekipman');
  if (!v.stats) {
    cont.add(txt(scene, 30, y, Q, { size: 15, bold: true, color: '#6f6656' }));
    y += 26;
  } else {
    const eq = EQUIP_SLOTS.filter((s) => c.equipment[s]).map((s) => c.equipment[s] as string);
    let x = 24;
    if (c.natural) {
      cont.add(txt(scene, x, y, `${c.natural.name} [${c.natural.dmg[0]}-${c.natural.dmg[1]}]`, { size: 14, bold: true }));
      y += 24;
    }
    if (!eq.length && !c.natural) {
      cont.add(txt(scene, 30, y, 'Yok', { size: 14, color: COLORS.textDim }));
      y += 24;
    }
    for (const id of eq) {
      const it = ITEMS[id];
      if (!it) continue;
      const t = txt(scene, 0, 0, it.name, { size: 13, color: COLORS.text });
      const cw = t.width + 40;
      if (x + cw > W - 20) {
        x = 24;
        y += 30;
      }
      cont.add(iconImage(scene, x + 12, y + 9, it.icon, 22));
      t.setPosition(x + 28, y + 1);
      cont.add(t);
      x += cw + 6;
    }
    if (eq.length) y += 30;
  }
  if (!opts.self) {
    cont.add(uiIcon(scene, 30, y + 9, 'inventory', 18));
    const inv = Object.entries(c.inventory ?? {}).map(([k, q]) => `${ITEMS[k]?.name ?? k} ×${q}`);
    const it = txt(scene, 48, y, v.skills ? (inv.length ? inv.join(', ') : 'Envanter boş') : `Envanter: ${Q}`, { size: 13, color: v.skills ? COLORS.textDim : '#6f6656', wrap: W - 70 });
    cont.add(it);
    y += it.height + 8;
  }
  ornamentLine(deco, 20, W - 20, y);
  y += 8;
  cont.add(uiIcon(scene, W / 2 - 74, y + 9, 'lock', 14));
  cont.add(txt(scene, W / 2 - 62, y, 'Trait: görülemez', { size: 12, italic: true, color: '#8a7e66' }));
  cont.add(txt(scene, W - 20, y, 'Kapatmak için dokun', { size: 12, italic: true, color: '#8a7e66' }).setOrigin(1, 0));
  y += 24;
  // ------------------------------------------------------------ zemin: koyu, altın kenarlı, köşe süslemeli
  const H = y;
  bg.fillStyle(0x000000, 0.4);
  bg.fillRoundedRect(4, 6, W, H, 12);
  bg.fillStyle(0x14101c, 0.96);
  bg.fillRoundedRect(0, 0, W, H, 12);
  bg.fillStyle(0xd9b45a, 0.05);
  bg.fillRoundedRect(4, 4, W - 8, 64, 10);
  bg.lineStyle(2, COLORS.gold, 1);
  bg.strokeRoundedRect(0, 0, W, H, 12);
  bg.lineStyle(1, COLORS.goldDark, 1);
  bg.strokeRoundedRect(6, 6, W - 12, H - 12, 9);
  for (const [cx, cy] of [[0, 0], [W, 0], [0, H], [W, H]]) {
    bg.fillStyle(COLORS.goldLight, 1);
    bg.fillTriangle(cx, cy - 6, cx + 6, cy, cx, cy + 6);
    bg.fillTriangle(cx, cy - 6, cx - 6, cy, cx, cy + 6);
  }
  cont.add(deco);
  cont.setSize(W, H);
  (cont as any).panelW = W;
  (cont as any).panelH = H;
  return cont;
}
