// Menü → Görevler sekmesi (C2/B6): solda görev listesi, sağda ayrıntı (açıklama, amaçlar, ödül, rütbe, puan, risk).
import Phaser from 'phaser';
import { G } from '../game/G';
import { Q, KIND_NAMES, questExp } from '../game/questrt';
import { visibleObjectives, objectiveDone } from '../core/quests';
import { QUEST_POINTS, groupPoints } from '../core/guild';
import { COLORS, FONT, txt, uiIcon, Button } from './kit';
import { ScrollList, confirmBox } from './panels';
import { KIND_ICON, loadQuestHudPrefs, saveQuestHudPref } from './hudQuests';
import { richLine } from './coins';
import { NPC_BY_ID } from '../data/npcs';
import { ornamentLine } from './appraisalPanel';
import { Sound } from '../audio/audio';

export function renderQuestsTab(scene: Phaser.Scene & { render(): void }, c: Phaser.GameObjects.Container, w: number, h: number, sel: string | null, onSelect: (id: string) => void) {
  c.add(uiIcon(scene, 16, 16, 'quests', 30));
  c.add(txt(scene, 38, 0, 'Görevler', { size: 24, font: FONT.title, color: COLORS.textGold }));
  const log = G.state.quests;
  const active = log.order.filter((id) => log.quests[id]?.status === 'active');
  const ended = log.order.filter((id) => log.quests[id] && log.quests[id].status !== 'active').reverse();
  const g0 = G.state.guild;
  if (g0.member) c.add(txt(scene, w, 6, `Lonca Puanı ${g0.points}${g0.debt ? ` · Borç ${g0.debt} bronz` : ''}`, { size: 14, bold: true, color: '#f3dc95' }).setOrigin(1, 0));
  const lw = Math.floor(w * 0.42);
  // HUD'da hangi kategoriler görünsün: iki anahtar (listenin altında)
  const prefs = loadQuestHudPrefs();
  const bw = (lw - 20) / 2;
  (['main', 'side'] as const).forEach((cat, i) => {
    const on = prefs[cat];
    const b = new Button(scene, bw / 2 + i * (bw + 6), h - 30, `        ${cat === 'main' ? 'Ana görevleri göster' : 'Yan görevleri göster'}`, () => {
      saveQuestHudPref(cat, !on);
      G.events.emit('quests');
      scene.render();
    }, { w: bw, h: 44, size: 13, textColor: on ? COLORS.text : COLORS.textDim });
    b.add(uiIcon(scene, -bw / 2 + 18, 0, on ? 'check' : 'cross', 16).setAlpha(on ? 1 : 0.6));
    b.setName('hud_' + cat);
    c.add(b);
  });
  const list = new ScrollList(scene, 0, 44, lw, h - 52 - 56);
  c.add(list);
  list.updateMask();
  let y = 0;
  const id0 = sel && log.quests[sel] ? sel : active[0] ?? ended[0] ?? null;
  const header = (t: string) => {
    list.inner.add(txt(scene, 6, y + 4, t, { size: 14, bold: true, color: '#b8a888', font: FONT.title }));
    y += 28;
  };
  const row = (id: string) => {
    const def = Q.def(id);
    const st = log.quests[id];
    if (!def || !st) return;
    const rc = scene.add.container(0, y);
    const on = id === id0;
    const g = scene.add.graphics();
    g.fillStyle(on ? 0x3a2e1a : 0x1a1622, 0.95);
    g.fillRoundedRect(0, 0, lw - 14, 54, 8);
    g.lineStyle(on ? 2 : 1, on ? COLORS.gold : COLORS.goldDark, 1);
    g.strokeRoundedRect(0, 0, lw - 14, 54, 8);
    rc.add(g);
    rc.add(uiIcon(scene, 22, 27, KIND_ICON[def.kind] ?? 'quests', 26));
    rc.add(txt(scene, 42, 7, def.title, { size: 15, bold: true, color: st.status === 'active' ? COLORS.text : COLORS.textDim, wrap: lw - 100 }));
    const stLabel = st.status === 'active' ? KIND_NAMES[def.kind] : st.status === 'done' ? 'Tamamlandı' : st.status === 'failed' ? 'Başarısız' : 'Bırakıldı';
    rc.add(txt(scene, 42, 31, stLabel + (def.rank ? ` · ${def.rank}` : ''), { size: 12, color: st.status === 'failed' || st.status === 'abandoned' ? COLORS.textRed : '#a89c84' }));
    if (log.tracked === id) rc.add(uiIcon(scene, lw - 34, 27, 'target', 22));
    else if (st.status === 'done') rc.add(uiIcon(scene, lw - 34, 27, 'check', 20));
    const z = scene.add.zone(0, 0, lw - 14, 54).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    z.on('pointerup', () => {
      if (list.wasDrag()) return;
      Sound.sfx('click', 0.5);
      onSelect(id);
    });
    rc.addAt(z, 0);
    list.inner.add(rc);
    y += 60;
  };
  header(`Aktif (${active.length})`);
  if (!active.length) {
    list.inner.add(txt(scene, 8, y, 'Aktif görev yok.', { size: 14, italic: true, color: COLORS.textDim }));
    y += 26;
  }
  for (const id of active) row(id);
  if (ended.length) {
    y += 6;
    header(`Biten (${ended.length})`);
    for (const id of ended) row(id);
  }
  list.setContentHeight(y + 10);

  // ------------------------------------------------------------ ayrıntı
  const dx = lw + 16, dw = w - lw - 16;
  const g = scene.add.graphics();
  g.fillStyle(0x1a1622, 0.92);
  g.fillRoundedRect(dx, 44, dw, h - 52, 10);
  g.lineStyle(1, COLORS.goldDark, 1);
  g.strokeRoundedRect(dx, 44, dw, h - 52, 10);
  c.add(g);
  if (!id0) {
    c.add(txt(scene, dx + 18, 64, 'Henüz bir görevin yok.', { size: 15, color: COLORS.textDim }));
    return;
  }
  const def = Q.def(id0)!;
  const st = log.quests[id0];
  let yy = 60;
  c.add(uiIcon(scene, dx + 30, yy + 14, KIND_ICON[def.kind] ?? 'quests', 32));
  c.add(txt(scene, dx + 54, yy - 2, def.title, { size: 21, bold: true, font: FONT.title, color: COLORS.textGold, wrap: dw - 70 }));
  const giver = def.giver ? NPC_BY_ID[def.giver]?.name ?? def.giver : null;
  c.add(txt(scene, dx + 54, yy + 26, `${KIND_NAMES[def.kind]}${giver ? ' · Veren: ' + giver : ''}`, { size: 13, color: '#a89c84' }));
  yy += 54;
  // rütbe ve puan
  if (def.guild && def.rank) {
    c.add(uiIcon(scene, dx + 30, yy + 12, 'rank_' + def.rank, 30));
    const pts = def.reward.points ?? QUEST_POINTS[def.rank];
    c.add(txt(scene, dx + 52, yy + 2, `Rütbe ${def.rank} görevi · ${def.group ? `${groupPoints(pts)} Lonca Puanı (grup: ${pts} puanın yarısı)` : `${pts} Lonca Puanı`}`, { size: 14, bold: true, color: '#f3dc95', wrap: dw - 70 }));
    yy += 34;
  }
  const dt = txt(scene, dx + 18, yy, def.desc, { size: 15, color: COLORS.text, wrap: dw - 36, lineSpacing: 3 });
  c.add(dt);
  yy += dt.height + 12;
  const dg = scene.add.graphics();
  ornamentLine(dg, dx + 20, dx + dw - 20, yy);
  c.add(dg);
  yy += 12;
  // amaçlar
  c.add(txt(scene, dx + 18, yy, 'AMAÇLAR', { size: 13, bold: true, font: FONT.title, color: '#b8a888' }));
  yy += 22;
  for (const i of visibleObjectives(def, st)) {
    const o = def.objectives[i];
    const ok = objectiveDone(def, st, i) || st.status === 'done';
    c.add(uiIcon(scene, dx + 28, yy + 10, ok ? 'check' : 'target', 18));
    const n = (o.count ?? 1) > 1 ? `  ${Math.min(st.progress[i], o.count!)}/${o.count}` : '';
    const ot = txt(scene, dx + 44, yy, o.label + n, { size: 15, color: ok ? COLORS.textDim : COLORS.text, wrap: dw - 70 });
    c.add(ot);
    yy += Math.max(24, ot.height + 4);
    const wait = !ok && st.status === 'active' && i === visibleObjectives(def, st).filter((j) => !objectiveDone(def, st, j))[0] ? Q.wait(id0) : null;
    if (wait) {
      const wt = txt(scene, dx + 44, yy - 2, '⏳ ' + wait, { size: 13, italic: true, color: '#a9c8ff', wrap: dw - 70 });
      c.add(wt);
      yy += wt.height + 6;
    }
  }
  yy += 6;
  // ödül
  const rw: string[] = [];
  if (def.reward.money) rw.push(`{m:${def.reward.money}}`);
  if (def.reward.text) rw.push(def.reward.text);
  const xp = questExp(def);
  if (xp > 0) rw.push(`+${xp} EXP`);
  if (rw.length) {
    c.add(uiIcon(scene, dx + 28, yy + 10, 'reward', 20));
    c.add(richLine(scene, dx + 44, yy + 10, 'Ödül: ' + rw.join(' · '), { size: 15, color: '#cfe6b8' }));
    yy += 30;
  }
  // risk
  const risk = Q.risk(def);
  if (risk && st.status === 'active') {
    c.add(uiIcon(scene, dx + 28, yy + 10, 'risk', 20));
    const rt = txt(scene, dx + 44, yy, risk, { size: 13, color: '#ffb0a0', wrap: dw - 70 });
    c.add(rt);
    yy += rt.height + 10;
  }
  // düğmeler
  if (st.status === 'active') {
    const tracked = log.tracked === id0;
    c.add(new Button(scene, dx + 130, h - 36, tracked ? 'Takibi bırak' : 'Takip et', () => {
      Q.track(tracked ? null : id0);
      scene.render();
    }, { w: 220, h: 48, size: 16 }));
    if (def.kind !== 'main') {
      c.add(new Button(scene, dx + dw - 120, h - 36, 'Bırak', async () => {
        const ok = await confirmBox(scene, def.guild ? `Görevi bırakırsan ceza ödersin.\n${Q.risk(def)}` : 'Görev bırakılsın mı?', 'Bırak', 'Vazgeç');
        if (!ok) return;
        Q.fail(id0, true);
        scene.render();
      }, { w: 180, h: 48, size: 16, textColor: COLORS.textRed }));
    }
  }
}
