// Appraisal paneli (B1, 0.5.0): iki sütun, tek ekran, kaydırmasız.
// Sol sütun sabit genişlikte (portre, Level, Lonca rütbesi, HP/MP); sağ sütun esner (kimlik, statlar, ekipman
// ızgarası ya da yaratıklarda drop tablosu); skill'ler altta tam genişlikte. Gizli bilgi kutucuğu kaldırmaz: "???".
// Görünürlük core/appraisal kurallarına uyar; trait'ler hiçbir rütbede görünmez. Saygınlık yalnızca kendi kartında.
import Phaser from 'phaser';
import { COLORS, FONT, txt, uiIcon, rankBadge, iconImage, itemRankBadge, drawTile, fitText } from './kit';
import { appraisalView, dropsVisible, appraisalDiffText, type AppraisalView } from '../core/appraisal';
import { MONSTERS, type MonsterDef } from '../data/monsters';
import { dropTable } from '../core/monster';
import { derive } from '../core/creature';
import { subRankToString, skillThreshold, SUBRANK_MAX, type SubRank } from '../core/ranks';
import { STAT_KEYS } from '../core/formulas';
import { EQUIP_SLOTS, EQUIP_SLOT_NAMES } from '../core/types';
import { ITEMS } from '../data/items';
import { SKILLS } from '../data/skills';
import { TITLES } from '../data/titles';
import { itemPrestige, equipmentPrestige, prestigeLabel, EMPTY_SLOT_PENALTY } from '../core/prestige';
import { fmtExp, fmtHp } from './format';
import { ensurePortrait, lpcPortraitKey, monsterPortraitKey } from './portraits';
import type { NpcDef } from '../data/npcs';

const Q = '???';
const DIM = '#6f6656';
const LABEL = '#a89c84';

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
  /** Joseph'in drop çarpanı (LUK); yaratık drop oranları bununla gösterilir. */
  dropMult?: number;
  /** Joseph'in Appraisal rütbesi. */
  mineRank: number;
  /** Kendi kartında portre için Joseph'in o anki LPC katmanları. */
  josephLayers?: string[];
}

/** Rütbe metni tipografik eksiyle: G− · G · G+. */
export function rankText(r: SubRank): string {
  return subRankToString(r).replace('-', '−');
}

export function buildAppraisalPanel(scene: Phaser.Scene, c: any, npc: NpcDef | null, opts: AppraisalOpts): Phaser.GameObjects.Container {
  const theirs: SubRank = c.skills.find((s: any) => s.id === 'appraisal')?.rank ?? 0;
  const v: AppraisalView = opts.self
    ? { diff: -9, title: true, identity: true, stats: true, skills: true, skillExp: true, traits: false }
    : appraisalView(opts.mineRank, theirs);
  const mdef: MonsterDef | undefined = !npc && !opts.self && c.race === 'Canavar' ? MONSTERS[c.id] : undefined;
  const creature = !!mdef;
  const d = derive(c);
  const W = 700;
  const PAD = 18;
  const LW = 170; // sol sütun: sabit
  const RX = PAD + LW + 16;
  const RW = W - RX - PAD; // sağ sütun: esner
  const cont = scene.add.container(0, 0);
  const bg = scene.add.graphics();
  cont.add(bg);
  const tiles = scene.add.graphics();
  cont.add(tiles);
  const deco = scene.add.graphics();

  // ------------------------------------------------------------ başlık
  let y = 16;
  cont.add(uiIcon(scene, 30, y + 14, opts.self ? 'eye' : 'appraisal', 30));
  cont.add(txt(scene, 54, y, 'APPRAISAL', { size: 14, bold: true, font: FONT.title, color: creature ? '#d9a08a' : '#c9a956' }));
  cont.add(fitText(txt(scene, 54, y + 16, v.identity ? c.name : Q, { size: 26, bold: true, font: FONT.title, color: v.identity ? '#fff4d6' : '#7a6e5a' }), W - 54 - 300));
  let diffX = W - 24;
  if (creature) {
    // yaratığın rütbesi (G−/G/G+), sağ üstte
    const rt = txt(scene, W - 24, y + 2, rankText(theirs), { size: 24, bold: true, font: FONT.title, color: COLORS.textGold }).setOrigin(1, 0);
    cont.add(rt);
    cont.add(rankBadge(scene, W - 24 - rt.width - 20, y + 16, theirs, 30));
    diffX = W - 24;
    cont.add(txt(scene, diffX, y + 34, appraisalDiffText(v.diff), { size: 12, italic: true, color: '#c8a898', align: 'right', wrap: 280 }).setOrigin(1, 0));
  } else cont.add(txt(scene, diffX, y + 4, appraisalDiffText(v.diff, opts.self), { size: 13, italic: true, color: '#b8a888', align: 'right', wrap: 280 }).setOrigin(1, 0));
  y += 58;
  ornamentLine(deco, 20, W - 20, y);
  const bodyY = y + 12;

  /** Etiketli kutucuk: üstte küçük soluk etiket (simgeli), altta değer. Değer gizliyse "???". */
  const tile = (x: number, yy: number, w: number, h: number, icon: string | null, label: string, value: string, o: { valueSize?: number; color?: string } = {}) => {
    drawTile(tiles, x, yy, w, h, { fill: creature ? 0x2e1a1c : COLORS.panel2 });
    let lx = x + 8;
    if (icon) {
      cont.add(uiIcon(scene, x + 15, yy + 12, icon, 15));
      lx = x + 26;
    }
    cont.add(fitText(txt(scene, lx, yy + 4, label, { size: 11, bold: true, color: LABEL }), w - (lx - x) - 6));
    const hidden = value === Q;
    const vt = txt(scene, x + 8, yy + h - 24, value, { size: o.valueSize ?? 15, bold: true, color: hidden ? DIM : o.color ?? COLORS.text });
    cont.add(fitText(vt, w - 14));
    return vt;
  };

  // ------------------------------------------------------------ sol sütun (sabit)
  let ly = bodyY;
  // Portre yüksekliği sağ sütunun boyuna göre (iki sütun aşağı yukarı aynı yerde bitsin); genişlik sabit.
  const rightH = creature ? 58 + 20 + 3 * 40 : 58 + 18 + 58 + 18 + 4 * 46 + 3 * 6;
  const PH = Math.max(160, Math.min(210, rightH - 110));
  drawTile(tiles, PAD, ly, LW, PH, { fill: creature ? 0x2e1a1c : COLORS.panel2 });
  addPortrait(scene, cont, tiles, PAD + LW / 2, ly + PH / 2, Math.min(LW, PH) - 16, c, npc, mdef, opts);
  ly += PH + 8;
  const halfW = (LW - 8) / 2;
  if (creature) {
    tile(PAD, ly, LW, 50, 'level', 'Level', v.identity ? String(c.level) : Q, { valueSize: 18, color: '#ffd75e' });
  } else {
    tile(PAD, ly, halfW, 50, 'level', 'Level', v.identity ? String(c.level) : Q, { valueSize: 18, color: '#ffd75e' });
    // Lonca rütbesi: rozet + harf; üyeliği yoksa görevli etiketi ya da "Yok"
    const gx = PAD + halfW + 8;
    const rank = c.guildRank;
    if (!v.identity) tile(gx, ly, halfW, 50, 'guild', 'Lonca', Q);
    else if (rank !== null && rank !== undefined) {
      const vt = tile(gx, ly, halfW, 50, 'guild', 'Lonca', npc?.guildLabel ?? rankText(rank), { color: COLORS.textGold });
      cont.add(rankBadge(scene, gx + 18, ly + 36, rank, 22));
      vt.x = gx + 32;
      fitText(vt, halfW - 38);
    } else tile(gx, ly, halfW, 50, 'guild', 'Lonca', npc?.guildLabel ?? 'Yok');
  }
  ly += 58;
  const bar = (yy: number, icon: string, label: string, cur: number, max: number, color: number, show: boolean, fmt: (n: number) => string) => {
    cont.add(uiIcon(scene, PAD + 9, yy + 9, icon, 16));
    const g = scene.add.graphics();
    const bx = PAD + 20, bw = LW - 20;
    g.fillStyle(0x000000, 0.55);
    g.fillRoundedRect(bx, yy, bw, 18, 7);
    if (show) {
      g.fillStyle(color, 1);
      g.fillRoundedRect(bx, yy, Math.max(14, bw * Math.max(0, Math.min(1, max ? cur / max : 0))), 18, 7);
      g.fillStyle(0xffffff, 0.18);
      g.fillRect(bx + 4, yy + 2, Math.max(0, bw * Math.max(0, Math.min(1, max ? cur / max : 0)) - 8), 4);
    }
    g.lineStyle(1, COLORS.goldDark, 1);
    g.strokeRoundedRect(bx, yy, bw, 18, 7);
    cont.add(g);
    cont.add(txt(scene, bx + 8, yy + 1, show ? `${label} ${fmt(cur)} / ${fmt(max)}` : `${label} ${Q}`, { size: 12, bold: true, stroke: true, color: show ? '#ffffff' : '#b0a690' }));
  };
  const hpNow = npc ? d.maxHp : c.hp;
  bar(ly, 'hp', 'HP', hpNow, d.maxHp, COLORS.hp, v.stats, fmtHp);
  bar(ly + 26, 'mp', 'MP', opts.self ? c.mp : d.maxMp, d.maxMp, COLORS.mp, v.stats, (n) => String(Math.ceil(n)));
  ly += 44;

  // ------------------------------------------------------------ sağ sütun (esner)
  let ry = bodyY;
  const sectionHead = (title: string, icon: string, yy: number) => {
    cont.add(uiIcon(scene, RX + 9, yy + 8, icon, 16));
    cont.add(txt(scene, RX + 22, yy, title.toUpperCase(), { size: 12, bold: true, font: FONT.title, color: COLORS.textGold }));
  };
  // kimlik: Irk | Cinsiyet | Yaş | Title (yaratıkta Title yalnızca tanımlıysa)
  const titles: string[] = c.titles ?? [];
  const titleVal = titles.length ? `${TITLES[titles[0]]?.name ?? titles[0]} (${TITLES[titles[0]]?.rank ?? '?'})${titles.length > 1 ? ` +${titles.length - 1}` : ''}` : 'Yok';
  const idCells: [string, string, string][] = [
    ['race', 'Irk', v.identity ? String(c.race) : Q],
    ['gender', 'Cinsiyet', v.identity ? String(c.gender || '—') : Q],
    ['age', 'Yaş', v.identity ? (c.age === null || c.age === undefined ? '—' : String(c.age)) : Q],
  ];
  if (!creature || titles.length) idCells.push(['title', 'Title', titleVal]);
  const iw = (RW - (idCells.length - 1) * 8) / idCells.length;
  idCells.forEach(([ic, lab, val], i) => tile(RX + i * (iw + 8), ry, iw, 50, ic, lab, val));
  ry += 58;

  if (!creature) {
    // statlar: 7 kutucuk, tek sıra
    sectionHead('Statlar', 'stats', ry);
    ry += 18;
    const sw = (RW - 6 * 6) / 7;
    STAT_KEYS.forEach((k, i) => {
      const x = RX + i * (sw + 6);
      drawTile(tiles, x, ry, sw, 50);
      cont.add(uiIcon(scene, x + 12, ry + 12, k, 15));
      cont.add(txt(scene, x + 22, ry + 4, k, { size: 11, bold: true, color: '#c9b98f' }));
      cont.add(txt(scene, x + sw / 2, ry + 23, v.stats ? String(d.stats[k]) : Q, { size: 17, bold: true, color: v.stats ? '#ffffff' : DIM }).setOrigin(0.5, 0));
    });
    ry += 58;
    // ekipman: 11 slotun tamamı (dolu: kesintisiz kenarlık; boş: kesik çizgi ve "—")
    sectionHead('Ekipman', 'equipment', ry);
    if (opts.self) {
      // Saygınlık yalnızca kendi kartında: başlığın sağında toplam
      const tot = equipmentPrestige(c.equipment);
      const tt = txt(scene, RX + RW, ry - 1, `Saygınlık ${prestigeLabel(tot)}`, { size: 13, bold: true, color: tot < 0 ? COLORS.textRed : '#ffe9a0' }).setOrigin(1, 0);
      cont.add(tt);
      cont.add(uiIcon(scene, RX + RW - tt.width - 12, ry + 8, 'prestige', 16));
    }
    ry += 18;
    const cols = 3, gap = 6, eh = 46;
    const ew = (RW - (cols - 1) * gap) / cols;
    EQUIP_SLOTS.forEach((slot, i) => {
      const x = RX + (i % cols) * (ew + gap), yy = ry + Math.floor(i / cols) * (eh + gap);
      const id: string | undefined = c.equipment?.[slot];
      const it = id ? ITEMS[id] : undefined;
      const hidden = !v.stats;
      drawTile(tiles, x, yy, ew, eh, { empty: !hidden && !it, r: 7 });
      cont.add(txt(scene, x + 7, yy + 4, EQUIP_SLOT_NAMES[slot], { size: 10, bold: true, color: !hidden && !it ? '#6a6052' : LABEL }));
      if (hidden) {
        cont.add(txt(scene, x + 7, yy + 20, Q, { size: 14, bold: true, color: DIM }));
        return;
      }
      if (!it) {
        cont.add(txt(scene, x + 7, yy + 19, '—', { size: 15, bold: true, color: '#5a5048' }));
        const pen = opts.self ? EMPTY_SLOT_PENALTY[slot] ?? 0 : 0;
        if (pen) {
          // boş gövde/bacak cezası toplamı açıklasın
          const pt = txt(scene, x + ew - 7, yy + 24, prestigeLabel(pen), { size: 12, bold: true, color: COLORS.textRed }).setOrigin(1, 0);
          cont.add(pt);
          cont.add(uiIcon(scene, x + ew - 14 - pt.width, yy + 31, 'prestige', 12).setAlpha(0.8));
        }
        return;
      }
      // dolu: simge + ad + rütbe rozeti (+ kendi kartında saygınlık katkısı, 0 olsa bile)
      cont.add(iconImage(scene, x + 16, yy + 30, it.icon, 22));
      if (it.rank) cont.add(itemRankBadge(scene, x + ew - 12, yy + 12, it.rank, 18));
      let nameMax = ew - 36;
      if (opts.self) {
        const sv = itemPrestige(id!);
        const pt = txt(scene, x + ew - 7, yy + 24, prestigeLabel(sv), { size: 12, bold: true, color: sv > 0 ? '#cfe6b8' : sv < 0 ? COLORS.textRed : COLORS.textDim }).setOrigin(1, 0);
        cont.add(pt);
        cont.add(uiIcon(scene, x + ew - 14 - pt.width, yy + 31, 'prestige', 12));
        nameMax -= pt.width + 20;
      }
      cont.add(fitText(txt(scene, x + 30, yy + 22, it.name, { size: 13, bold: true, color: COLORS.text }), nameMax));
    });
    ry += 4 * eh + 3 * gap;
    if (c.natural && !Object.keys(c.equipment ?? {}).length && v.stats) {
      cont.add(txt(scene, RX, ry + 4, `Doğal silah: ${c.natural.name} [${c.natural.dmg[0]}-${c.natural.dmg[1]}]`, { size: 12, italic: true, color: COLORS.textDim }));
      ry += 20;
    }
  } else {
    // drop tablosu: oranlar yalnızca Appraisal rütben yaratığın rütbesine eşit ya da üstündeyse (G− < G < G+ …)
    sectionHead('Drop tablosu', 'inventory', ry);
    const show = dropsVisible(opts.mineRank, theirs);
    if (!show) cont.add(txt(scene, RX + RW, ry, `Oranlar için Appraisal ${rankText(theirs)} gerekir`, { size: 11, italic: true, color: '#b89080' }).setOrigin(1, 0));
    ry += 20;
    for (const l of dropTable(mdef!, opts.dropMult ?? 1)) {
      const it = ITEMS[l.id];
      drawTile(tiles, RX, ry, RW, 34, { fill: 0x2e1a1c, r: 7 });
      if (it) cont.add(iconImage(scene, RX + 18, ry + 17, it.icon, 22));
      const nt = txt(scene, RX + 36, ry + 8, it?.name ?? l.id, { size: 14, bold: true, color: COLORS.text });
      cont.add(fitText(nt, RW - 190));
      let nx = RX + 36 + nt.width + 8;
      if (it?.rank) {
        cont.add(itemRankBadge(scene, nx + 9, ry + 17, it.rank, 18));
        nx += 24;
      }
      if (l.special) cont.add(txt(scene, nx, ry + 10, 'nadir', { size: 11, italic: true, bold: true, color: '#e0b8ff' }));
      cont.add(txt(scene, RX + RW - 10, ry + 8, show ? `%${fmtPct(l.chance)}` : Q, { size: 15, bold: true, color: show ? '#ffe9a0' : DIM }).setOrigin(1, 0));
      ry += 40;
    }
  }

  // ------------------------------------------------------------ skill'ler (alt, tam genişlik)
  y = Math.max(ly, ry) + 10;
  ornamentLine(deco, 40, W - 40, y);
  y += 10;
  cont.add(uiIcon(scene, PAD + 9, y + 8, 'skills', 16));
  cont.add(txt(scene, PAD + 22, y, 'SKILL\'LER', { size: 12, bold: true, font: FONT.title, color: COLORS.textGold }));
  y += 20;
  const tagH = 26;
  // Etiketler: köşeleri hafif yuvarlatılmış dikdörtgen (yarıçap 6) — kutucuklarla aynı dil
  const tag = (x: number, yy: number, w: number, hidden = false) => {
    const g = scene.add.graphics();
    g.fillStyle(hidden ? COLORS.panel2 : 0x16233f, 0.95);
    g.fillRoundedRect(x, yy, w, tagH, 6);
    g.lineStyle(1, hidden ? COLORS.goldDark : 0x7cc8ff, hidden ? 0.9 : 0.6);
    g.strokeRoundedRect(x, yy, w, tagH, 6);
    cont.add(g);
  };
  if (!v.skills) {
    tag(PAD, y, 80, true);
    cont.add(txt(scene, PAD + 40, y + 4, Q, { size: 14, bold: true, color: DIM }).setOrigin(0.5, 0));
    y += tagH + 6;
  } else {
    let x = PAD;
    if (!c.skills.length) {
      cont.add(txt(scene, PAD, y + 4, 'Yok', { size: 14, color: COLORS.textDim }));
      y += tagH + 6;
    }
    for (const s of c.skills) {
      const def = SKILLS[s.id];
      const max = s.rank >= SUBRANK_MAX;
      const label = `${def?.name ?? s.id} (${subRankToString(s.rank)})${v.skillExp ? (max ? ' [MAX]' : ` [${fmtExp(s.exp)}/${skillThreshold(s.rank)}]`) : ''}`;
      const t = txt(scene, 0, 0, label, { size: 14, bold: true, color: '#e8f2ff' });
      const cw = t.width + (def?.icon ? 38 : 20);
      if (x + cw > W - PAD && x > PAD) {
        x = PAD;
        y += tagH + 6;
      }
      tag(x, y, cw);
      if (def?.icon) cont.add(iconImage(scene, x + 15, y + tagH / 2, def.icon, 18));
      t.setPosition(x + (def?.icon ? 28 : 10), y + 4);
      cont.add(t);
      x += cw + 8;
    }
    if (c.skills.length) y += tagH + 6;
  }

  // ------------------------------------------------------------ alt satır
  ornamentLine(deco, 20, W - 20, y + 2);
  y += 10;
  cont.add(uiIcon(scene, PAD + 7, y + 9, 'lock', 14));
  cont.add(txt(scene, PAD + 18, y, 'Trait: görülemez', { size: 12, italic: true, color: '#8a7e66' }));
  cont.add(txt(scene, W - 20, y, 'Kapatmak için dokun', { size: 12, italic: true, color: '#8a7e66' }).setOrigin(1, 0));
  y += 24;

  // ------------------------------------------------------------ zemin: koyu (yaratıkta koyu kırmızı), altın kenarlı
  const H = y;
  const fill = creature ? 0x2a0f12 : 0x14101c;
  bg.fillStyle(0x000000, 0.4);
  bg.fillRoundedRect(4, 6, W, H, 12);
  bg.fillStyle(fill, 0.97);
  bg.fillRoundedRect(0, 0, W, H, 12);
  bg.fillStyle(creature ? 0xd94a3a : 0xd9b45a, creature ? 0.07 : 0.05);
  bg.fillRoundedRect(4, 4, W - 8, 66, 10);
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
  (cont as any).creature = creature;
  return cont;
}

/**
 * Portre: NPC ve Joseph için ensurePortrait (kullanıcı görseli ya da LPC'den üretilmiş), yaratıkta sprite sayfasının
 * ilk karesi (goblinler LPC sayfası). Önce baş harf/siluet çizilir; görsel gelince üstünü örter — kutucuk hiç boş kalmaz.
 */
function addPortrait(scene: Phaser.Scene, cont: Phaser.GameObjects.Container, under: Phaser.GameObjects.Graphics, cx: number, cy: number, size: number, c: any, npc: NpcDef | null, mdef: MonsterDef | undefined, opts: AppraisalOpts) {
  const fb = scene.add.graphics();
  fb.fillStyle(0x000000, 0.3);
  fb.fillCircle(cx, cy - size * 0.12, size * 0.2);
  fb.fillRoundedRect(cx - size * 0.3, cy + size * 0.12, size * 0.6, size * 0.3, size * 0.12);
  cont.add(fb);
  const initial = txt(scene, cx, cy - size * 0.12, String(c.name ?? '?').charAt(0).toUpperCase(), { size: Math.round(size * 0.26), bold: true, font: FONT.title, color: '#8a7e66' }).setOrigin(0.5);
  cont.add(initial);
  const put = (key: string | null) => {
    if (!key || !cont.active || !scene.textures.exists(key)) return;
    const img = scene.add.image(cx, cy, key).setDisplaySize(size, size);
    const fr = scene.add.graphics();
    fr.lineStyle(1, COLORS.goldDark, 1);
    fr.strokeRect(cx - size / 2, cy - size / 2, size, size);
    // kutucuk zemininin hemen üstüne (yazıların altına) yerleştir
    cont.addAt([img, fr], cont.getIndex(under) + 1);
    fb.setVisible(false);
    initial.setVisible(false);
  };
  try {
    if (opts.self) {
      ensurePortrait(scene, 'joseph', 'normal', opts.josephLayers ?? ['j_body', 'j_head']).then((r) => put(r.key));
    } else if (npc) {
      ensurePortrait(scene, npc.portrait ?? npc.id, 'normal').then((r) => put(r.key));
    } else if (mdef) {
      if (mdef.sprite.startsWith('m_goblin')) {
        const sheet = mdef.sprite.slice(2);
        put(scene.textures.exists(sheet) ? lpcPortraitKey(scene, sheet) : null);
      } else put(monsterPortraitKey(scene, mdef.sprite));
    }
  } catch {
    /* portre üretilemedi: baş harf kalır */
  }
}

/** Yüzde: %60 · %8 · %1,2 (küçük oranlarda bir ondalık, virgül). */
function fmtPct(p: number): string {
  const v = p * 100;
  if (v >= 10 || Number.isInteger(Math.round(v * 10) / 10)) return String(Math.round(v));
  return (Math.round(v * 10) / 10).toFixed(1).replace('.', ',');
}
