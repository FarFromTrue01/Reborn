// Menü → Ansiklopedi (B15, 0.10.0): Yaratıklar · Karakterler · Bitkiler. Sayfa = bölge ("Brindlewood ve Çevresi",
// "Eros"…). Solda kayıt listesi (bilinmeyen: karartılmış siluet ve "???"), sağda kart. Veri core/codex.ts.
import Phaser from 'phaser';
import { G } from '../game/G';
import { COLORS, FONT, txt, uiIcon, iconImage, Button, rankBadge, itemRankBadge, fitText } from './kit';
import { ScrollList } from './panels';
import { ornamentLine } from './appraisalPanel';
import { Sound } from '../audio/audio';
import { monsterIconKey, ensurePortrait } from './portraits';
import {
  CODEX_KINDS, codexPages, codexKnown, codexName, monsterCard, personCard, plantCard, PLANTS, codexBadge, codexIsNew, codexMarkSeen,
  codexNewCount, codexSorted, codexTotals, type CodexKind, type CodexCard,
} from '../core/codex';
import { NPC_BY_ID } from '../data/npcs';
import { ITEMS } from '../data/items';

/** Oturum boyunca seçili tür, sayfa ve kayıt. */
const SEL: { kind: CodexKind; page: number; id: string | null } = { kind: 'monsters', page: 0, id: null };

/** Kartın görseli: bilinmiyorsa karartılmış siluet. */
function entryImage(scene: Phaser.Scene, kind: CodexKind, id: string, x: number, y: number, size: number, known: boolean): Phaser.GameObjects.GameObject {
  const shade = (im: Phaser.GameObjects.Image) => {
    im.setDisplaySize(size, size);
    if (!known) im.setTint(0x000000).setAlpha(0.75);
    return im;
  };
  if (kind === 'monsters') {
    const key = monsterIconKey(scene, id);
    if (key) return shade(scene.add.image(x, y, key));
  } else if (kind === 'plants') {
    const p = PLANTS.find((q) => q.id === id);
    const im = iconImage(scene, x, y, ITEMS[p?.item ?? '']?.icon ?? 'herb', size);
    if (!known) im.setTint(0x000000).setAlpha(0.75);
    return im;
  } else {
    const n = NPC_BY_ID[id];
    const c = scene.add.container(x, y);
    if (n) {
      ensurePortrait(scene, n.portrait ?? n.id, 'normal').then((r) => {
        if (!c.scene || !scene.textures.exists(r.key)) return;
        c.add(shade(scene.add.image(0, 0, r.key)));
      }).catch(() => {});
    }
    return c;
  }
  return scene.add.circle(x, y, size / 2, 0x000000, 0.6);
}

function cardOf(kind: CodexKind, id: string): CodexCard {
  const c = G.state.codex;
  if (kind === 'monsters') return monsterCard(c, id);
  if (kind === 'plants') return plantCard(c, id);
  return personCard(c, id, { affinity: G.state.affinity[id] ?? 0, flags: G.state.flags });
}

/** Kırmızı "!" rozeti (yeni keşif / sayı). */
function newMark(scene: Phaser.Scene, x: number, y: number, label = '!'): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const r = label.length > 1 ? 11 : 9;
  g.fillStyle(0xd02a2a, 1);
  g.fillCircle(0, 0, r);
  g.lineStyle(1.5, 0xffd0c0, 1);
  g.strokeCircle(0, 0, r);
  c.add(g);
  c.add(txt(scene, 0, 0, label, { size: label.length > 1 ? 11 : 13, bold: true, color: '#ffffff' }).setOrigin(0.5));
  return c;
}

/** C13: Menüdeki Ansiklopedi düğmesi için kırmızı işaretli kayıt sayısı. */
export function codexBadgeCount(): number {
  return codexNewCount(G.state.codex);
}

/** Ad kutusunun sağındaki rütbe rozeti (bilinmeyen kayıtta yok; okunamayan kişide "???"). */
function badgeFor(scene: Phaser.Scene, kind: CodexKind, id: string, x: number, y: number): Phaser.GameObjects.GameObject | null {
  const b = codexBadge(G.state.codex, kind, id);
  if (!b) return null;
  if (b === 'unknown') {
    const c = scene.add.container(x, y);
    const g = scene.add.graphics();
    g.fillStyle(0x2a2430, 1);
    g.fillRoundedRect(-17, -11, 34, 22, 6);
    g.lineStyle(1, COLORS.goldDark, 1);
    g.strokeRoundedRect(-17, -11, 34, 22, 6);
    c.add([g, txt(scene, 0, 0, '???', { size: 12, bold: true, color: '#8a8070' }).setOrigin(0.5)]);
    return c;
  }
  if ('sub' in b) return rankBadge(scene, x, y, b.sub, 28, true);
  return itemRankBadge(scene, x, y, b.letter, 26);
}

export function renderCodexTab(scene: Phaser.Scene & { render(): void }, c: Phaser.GameObjects.Container, w: number, h: number) {
  // C13: kendi simgesi (menüdeki düğmeyle aynı; Konuşmalar'ınki değil)
  c.add(uiIcon(scene, 16, 16, 'skills', 30));
  c.add(txt(scene, 38, 0, 'Ansiklopedi', { size: 24, font: FONT.title, color: COLORS.textGold }));
  // tür sekmeleri
  CODEX_KINDS.forEach((k, i) => {
    const on = SEL.kind === k.kind;
    const b = new Button(scene, w - (CODEX_KINDS.length - i) * 150 + 70, 16, `      ${k.name}`, () => {
      SEL.kind = k.kind;
      SEL.page = 0;
      SEL.id = null;
      Sound.sfx('click', 0.5);
      scene.render();
    }, { w: 142, h: 36, size: 14, style: on ? 'gold' : 'ghost' });
    b.add(uiIcon(scene, -50, 0, k.icon, 20));
    b.setAlpha(on ? 1 : 0.7);
    c.add(b);
    // C13: türdeki kırmızı işaretli kayıt sayısı
    const nNew = codexNewCount(G.state.codex, k.kind);
    if (nNew) c.add(newMark(scene, b.x + 64, 4, String(nNew)));
  });
  const pages = codexPages(G.state.codex, SEL.kind);
  SEL.page = Math.max(0, Math.min(pages.length - 1, SEL.page));
  const page = pages[SEL.page];
  // sayfa (bölge) seçimi
  const py = 50;
  const prev = new Button(scene, 22, py + 16, '◀', () => { SEL.page = (SEL.page + pages.length - 1) % pages.length; SEL.id = null; scene.render(); }, { w: 40, h: 34, size: 16 });
  const next = new Button(scene, 290, py + 16, '▶', () => { SEL.page = (SEL.page + 1) % pages.length; SEL.id = null; scene.render(); }, { w: 40, h: 34, size: 16 });
  c.add([prev, next]);
  c.add(txt(scene, 156, py + 4, page.locked ? '???' : page.region.name, { size: 16, bold: true, font: FONT.title, color: '#f3dc95', align: 'center' }).setOrigin(0.5, 0));
  c.add(txt(scene, 156, py + 24, `Sayfa ${SEL.page + 1}/${pages.length}`, { size: 11, color: COLORS.textDim }).setOrigin(0.5, 0));
  // C13: sayaçlar — "Karakterler — Toplam: x / y" ve "Brindlewood ve Çevresi: z / t"
  const tot = codexTotals(G.state.codex, SEL.kind);
  const kindName = CODEX_KINDS.find((k) => k.kind === SEL.kind)!.name;
  c.add(txt(scene, 330, py, `${kindName} — Toplam: ${tot.known} / ${tot.total}`, { size: 15, bold: true, color: '#f3dc95' }));
  c.add(txt(scene, 330, py + 20, page.locked ? 'Bu bölgeye henüz ayak basmadın.' : `${page.region.name}: ${page.known} / ${page.total}`, { size: 14, bold: true, color: page.locked ? COLORS.textDim : '#cfe6b8' }));
  const top = py + 46;
  if (page.locked) {
    const g = scene.add.graphics();
    ornamentLine(g, 20, w - 20, top + 10);
    c.add(g);
    c.add(txt(scene, w / 2, top + 80, '???', { size: 64, bold: true, font: FONT.title, color: '#3a3428' }).setOrigin(0.5));
    c.add(txt(scene, w / 2, top + 140, 'Bu sayfa, o topraklara gidince dolacak.', { size: 15, italic: true, color: COLORS.textDim }).setOrigin(0.5));
    return;
  }
  // liste
  const lw = Math.floor(w * 0.4);
  const list = new ScrollList(scene, 0, top, lw, h - top - 8);
  c.add(list);
  list.updateMask();
  // C13: bilinenler önce (alfabetik), bilinmeyenler sonra
  const ids = codexSorted(G.state.codex, SEL.kind, page.ids);
  const id0 = SEL.id && ids.includes(SEL.id) ? SEL.id : ids.find((id) => codexKnown(G.state.codex, SEL.kind, id)) ?? ids[0];
  // seçili kayda dokunuldu: "!" kalkar ve kayıtta saklanır
  if (id0 && SEL.id === id0 && codexIsNew(G.state.codex, SEL.kind, id0)) {
    codexMarkSeen(G.state.codex, SEL.kind, id0);
    G.scheduleSave();
  }
  let y = 0;
  for (const id of ids) {
    const known = codexKnown(G.state.codex, SEL.kind, id);
    const on = id === id0;
    const rc = scene.add.container(0, y);
    const g = scene.add.graphics();
    g.fillStyle(on ? 0x3a2e1a : 0x1a1622, 0.95);
    g.fillRoundedRect(0, 0, lw - 14, 52, 8);
    g.lineStyle(on ? 2 : 1, on ? COLORS.gold : COLORS.goldDark, 1);
    g.strokeRoundedRect(0, 0, lw - 14, 52, 8);
    rc.add(g);
    rc.add(entryImage(scene, SEL.kind, id, 28, 26, 40, known));
    const nameT = txt(scene, 56, 15, known ? codexName(SEL.kind, id) : '???', { size: 15, bold: true, color: known ? COLORS.text : '#5a5246' });
    rc.add(nameT);
    fitText(nameT, lw - 14 - 56 - 48);
    // C13: ad kutusunun sağında rütbe rozeti; yeni keşifte kutuda kırmızı "!"
    const bdg = badgeFor(scene, SEL.kind, id, lw - 14 - 24, 26);
    if (bdg) rc.add(bdg);
    if (codexIsNew(G.state.codex, SEL.kind, id)) rc.add(newMark(scene, 10, 8));
    const z = scene.add.zone(0, 0, lw - 14, 52).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    z.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (list.wasDrag() || !list.containsPointer(p)) return;
      SEL.id = id;
      Sound.sfx('click', 0.5);
      scene.render();
    });
    rc.addAt(z, 0);
    list.inner.add(rc);
    y += 58;
  }
  list.setContentHeight(y);
  // kart
  const dx = lw + 10, dw = w - dx;
  const bg = scene.add.graphics();
  bg.fillStyle(0x14111a, 0.95);
  bg.fillRoundedRect(dx, top, dw, h - top - 8, 10);
  bg.lineStyle(1.5, COLORS.goldDark, 1);
  bg.strokeRoundedRect(dx, top, dw, h - top - 8, 10);
  c.add(bg);
  if (!id0) return;
  const card = cardOf(SEL.kind, id0);
  c.add(entryImage(scene, SEL.kind, id0, dx + 58, top + 58, 84, card.known));
  c.add(txt(scene, dx + 112, top + 22, card.known ? card.title : '???', { size: 24, bold: true, font: FONT.title, color: card.known ? COLORS.textGold : '#5a5246', wrap: dw - 130 }));
  if (card.subtitle) c.add(txt(scene, dx + 112, top + 58, card.subtitle, { size: 14, color: '#a89c84' }));
  let yy = top + 112;
  if (!card.known) {
    const hint = SEL.kind === 'monsters' ? 'Bu yaratığı Appraisal ile incele.' : SEL.kind === 'people' ? 'Bu kişiyle konuş.' : 'Bu bitkiyi topla.';
    c.add(txt(scene, dx + 20, yy, hint, { size: 15, italic: true, color: COLORS.textDim, wrap: dw - 40 }));
    return;
  }
  const g2 = scene.add.graphics();
  ornamentLine(g2, dx + 16, dx + dw - 16, yy - 8);
  c.add(g2);
  for (const [k, v] of card.rows) {
    c.add(txt(scene, dx + 20, yy, k, { size: 13, bold: true, color: '#b8a888' }));
    const t = txt(scene, dx + 150, yy, v, { size: 14, color: v === '???' ? '#5a5246' : COLORS.text, wrap: dw - 170 });
    c.add(t);
    yy += Math.max(22, t.height + 6);
  }
  for (const n of card.notes) {
    yy += 4;
    const t = txt(scene, dx + 20, yy, n, { size: 13, italic: true, color: '#cfe6b8', wrap: dw - 40 });
    c.add(t);
    yy += t.height + 4;
  }
  // C13: kartın en altında Appraisal kaydı
  if (card.footer) c.add(txt(scene, dx + dw - 16, h - 18, card.footer, { size: 12, italic: true, color: '#8fb8d8' }).setOrigin(1, 1));
}
