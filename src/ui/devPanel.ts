// Geliştirici modu paneli (C6). Başlık ekranında sürüm numarasına 7 kez dokununca açılır; Ayarlar'dan kapatılır.
// Normal oyuncu bu sekmeyi görmez.
import Phaser from 'phaser';
import { G } from '../game/G';
import * as R from '../game/rules';
import { Q } from '../game/questrt';
import { COLORS, FONT, txt, Button, uiIcon } from './kit';
import { ScrollList } from './panels';
import { STAT_KEYS } from '../core/formulas';
import { SKILLS } from '../data/skills';
import { SUBRANK_MAX, subRankToString, skillThreshold } from '../core/ranks';
import { canonicalCoins, emptyWallet, walletTotal } from '../core/money';
import { advance as advTime } from '../core/time';
import { activeQuests, currentObjective } from '../core/quests';
import { MAIN_QUESTS } from '../data/quests';
import { fmtExp, fmtHp } from './format';

type Scn = Phaser.Scene & { render(): void; world: any; ui: any; close(): void };

export function renderDevPanel(scene: Scn, c: Phaser.GameObjects.Container, w: number, h: number) {
  c.add(uiIcon(scene, 16, 16, 'dev', 30));
  c.add(txt(scene, 38, 0, 'Geliştirici Modu', { size: 24, font: FONT.title, color: COLORS.textGold }));
  const list = new ScrollList(scene, 0, 44, w, h - 52);
  c.add(list);
  list.updateMask();
  const I = list.inner;
  let y = 0;
  const p = G.p;
  const refresh = () => {
    G.invalidate();
    G.events.emit('stats');
    G.events.emit('quests');
    scene.world?.player?.refreshLayers?.();
    const sy = list.scrollY;
    scene.render();
    void sy;
  };
  const head = (t: string) => {
    I.add(txt(scene, 0, y, t, { size: 16, bold: true, font: FONT.title, color: '#ffe9a0' }));
    y += 30;
  };
  const btn = (x: number, label: string, fn: () => void, bw = 70) => {
    I.add(new Button(scene, x + bw / 2, y + 18, label, () => { fn(); refresh(); }, { w: bw, h: 38, size: 14, style: 'blue' }));
    return x + bw + 6;
  };
  const rowLabel = (t: string) => I.add(txt(scene, 0, y + 9, t, { size: 15, bold: true, color: COLORS.text }));

  // ------------------------------------------------------------ Joseph
  head('Joseph');
  rowLabel(`Level ${p.level} · EXP ${fmtExp(p.exp)}`);
  let x = 260;
  x = btn(x, '−1', () => (p.level = Math.max(0, p.level - 1)));
  x = btn(x, '+1', () => { p.level++; p.unspent += 4; p.sp += 1; });
  x = btn(x, '+50 EXP', () => R.gainExp(50), 100);
  y += 44;
  for (const k of STAT_KEYS) {
    rowLabel(`${k} ${p.alloc[k]}`);
    let xx = 260;
    xx = btn(xx, '−1', () => (p.alloc[k] = Math.max(0, p.alloc[k] - 1)));
    xx = btn(xx, '+1', () => p.alloc[k]++);
    y += 44;
  }
  rowLabel(`HP ${fmtHp(p.hp)}/${fmtHp(G.d.maxHp)} · MP ${Math.floor(p.mp)}/${G.d.maxMp}`);
  x = 260;
  x = btn(x, 'HP 1', () => (p.hp = 1));
  x = btn(x, 'Doldur', () => { p.hp = G.d.maxHp; p.mp = G.d.maxMp; p.stamina = G.d.maxStamina; }, 90);
  y += 44;
  rowLabel(`Para ${walletTotal(p.wallet)} bronz`);
  x = 260;
  x = btn(x, '+10b', () => R.giveMoney(10, 'Geliştirici', true));
  x = btn(x, '+1g', () => R.giveMoney(100, 'Geliştirici', true));
  x = btn(x, '+10g', () => R.giveMoney(1000, 'Geliştirici', true));
  x = btn(x, 'Sıfırla', () => (p.wallet = emptyWallet()), 80);
  y += 44;
  for (const s of p.skills) {
    const def = SKILLS[s.id];
    rowLabel(`${def?.name ?? s.id} ${subRankToString(s.rank)} · ${fmtExp(s.exp)}/${skillThreshold(s.rank)}`);
    let xx = 360;
    xx = btn(xx, '−', () => (s.rank = Math.max(0, s.rank - 1)), 50);
    xx = btn(xx, '+', () => (s.rank = Math.min(SUBRANK_MAX, s.rank + 1)), 50);
    xx = btn(xx, '+5 EXP', () => R.gainSkillExp(s.id, 5 / G.d.divLearning), 90);
    y += 44;
  }
  // ------------------------------------------------------------ zaman ve ışınlanma
  head('Zaman');
  rowLabel(`${G.state.time.day}. gün · ${String(Math.floor(G.state.time.minute / 60)).padStart(2, '0')}:${String(G.state.time.minute % 60).padStart(2, '0')}`);
  x = 260;
  x = btn(x, '+1 sa', () => (G.state.time = advTime(G.state.time, 60)));
  x = btn(x, '+6 sa', () => (G.state.time = advTime(G.state.time, 360)));
  x = btn(x, '+1 gün', () => { G.state.time = { day: G.state.time.day + 1, minute: 7 * 60 }; R.onNewDay(); scene.world?.director?.onNewDay(); }, 80);
  y += 44;
  x = 0;
  for (const hh of [6, 9, 12, 15, 18, 21]) x = btn(x, `${hh}:00`, () => (G.state.time = { ...G.state.time, minute: hh * 60 }));
  y += 50;
  head('Işınlanma');
  const tps: [string, string, string | [number, number]][] = [
    ['Meydan', 'world', 'plaza'], ['Doğu M.', 'world', 'east_plaza'], ['Meşe', 'world', 'oak'], ['Haldor', 'world', 'haldor_field'],
    ['Otlak', 'world', 'pasture'], ['Değirmen', 'world', 'mill_yard'], ['Kontrol N.', 'world', 'checkpoint'], ['Uyanış', 'world', 'wake'],
    ['Orman k.', 'world', 'forest_edge'], ['Goblin', 'world', 'goblin_camp'], ['Han', 'inn', [7, 10]], ['Lonca', 'guild', [7, 9]],
    ['Şifacı', 'healer', [4, 6]], ['Demirci', 'smithy', [4, 7]], ['Bodrum', 'mill_cellar', [4, 8]],
  ];
  x = 0;
  tps.forEach(([label, map, at], i) => {
    if (x > w - 110) { x = 0; y += 44; }
    x = btn(x, label, () => {
      const wld = scene.world;
      const pt = Array.isArray(at) ? { x: at[0], y: at[1] } : wld.getWorldPoint(at);
      scene.close();
      if (pt) wld.loadMap(map, pt.x, pt.y, 'down');
    }, 100);
    void i;
  });
  y += 50;
  // ------------------------------------------------------------ görevler ve lonca
  head('Görevler ve Lonca');
  rowLabel(`Lonca Puanı ${G.state.guild.points} · Borç ${G.state.guild.debt} · Rütbe ${p.guildRank === null ? 'yok' : subRankToString(p.guildRank)}`);
  x = 420;
  x = btn(x, '−10', () => (G.state.guild.points -= 10), 60);
  x = btn(x, '+10', () => { G.state.guild.points += 10; Q.checkPromotion(true); }, 60);
  x = btn(x, 'Terfi', () => { if (G.state.guild.pending) G.state.guild.pending.day = 0; Q.checkPromotion(); }, 70);
  y += 44;
  for (const id of activeQuests(G.state.quests)) {
    const def = Q.def(id);
    if (!def) continue;
    const st = G.state.quests.quests[id];
    const ci = currentObjective(def, st);
    rowLabel(`${def.title}${ci >= 0 ? ` — ${def.objectives[ci].label}` : ' (hazır)'}`);
    y += 26;
    let xx = 20;
    xx = btn(xx, 'Amaç +1', () => { if (ci >= 0) Q.advance(id, ci, 1); }, 100);
    xx = btn(xx, 'Amacı bitir', () => { if (ci >= 0) Q.advance(id, ci, def.objectives[ci].count ?? 1); }, 120);
    xx = btn(xx, 'Tamamla', () => { Q.complete(id); scene.world?.director?.onQuestDevComplete?.(id); }, 100);
    xx = btn(xx, 'Başarısız', () => Q.fail(id), 100);
    y += 46;
  }
  x = 0;
  I.add(txt(scene, 0, y + 8, 'Ana görev başlat:', { size: 14, color: COLORS.textDim }));
  y += 30;
  for (const q of MAIN_QUESTS) {
    if (Q.status(q.id)) continue;
    if (x > w - 160) { x = 0; y += 44; }
    x = btn(x, q.title.slice(0, 16), () => Q.start(q.id), 150);
  }
  y += 56;
  // ------------------------------------------------------------ kapat
  head('Mod');
  I.add(txt(scene, 0, y, 'NPC\'lerin Saygınlık değerleri geliştirici modunda başlarının üstünde görünür.', { size: 13, italic: true, color: COLORS.textDim, wrap: w - 20 }));
  y += 30;
  btn(0, 'Geliştirici modunu kapat', () => {
    G.settings.devMode = false;
    G.saveSettings();
    (scene as any).tab = 'settings';
  }, 260);
  y += 60;
  list.setContentHeight(y);
  void canonicalCoins;
}
