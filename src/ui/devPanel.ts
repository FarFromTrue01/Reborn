// Geliştirici modu paneli (C6). Başlık ekranında sürüm numarasına 7 kez dokununca açılır; Ayarlar'dan kapatılır.
// Normal oyuncu bu sekmeyi görmez.
import Phaser from 'phaser';
import { G } from '../game/G';
import * as R from '../game/rules';
import { Q } from '../game/questrt';
import { COLORS, FONT, txt, Button, uiIcon } from './kit';
import { ScrollList } from './panels';
import { STAT_KEYS, STAT_POINTS_PER_LEVEL, SP_PER_LEVEL } from '../core/formulas';
import { SKILLS } from '../data/skills';
import { SUBRANK_MAX, subRankToString, skillThreshold } from '../core/ranks';
import { canonicalCoins, emptyWallet, walletTotal } from '../core/money';
import { advance as advTime } from '../core/time';
import { activeQuests, currentObjective } from '../core/quests';
import { MAIN_QUESTS } from '../data/quests';
import { RANK_THRESHOLDS } from '../core/guild';
import { fmtExp, fmtHp } from './format';
import { Dev } from '../game/dev';
import { CHECKPOINTS } from '../story/checkpoints';
import { MONSTERS } from '../data/monsters';
import { ITEMS } from '../data/items';
import { newSkill } from '../core/skills';
import { codexUnlockAll, newCodex } from '../core/codex';
import { errors, errorsText, clearErrors } from '../game/errorLog';
import { importToSlot } from '../core/slots';
import { pickSlot } from './slotPicker';
import { leaveGame } from '../game/sceneFlow';

type Scn = Phaser.Scene & { render(): void; world: any; ui: any; close(): void };

/** Durum görüntüleyicinin araması (oturum boyunca). */
const DEV_FILTER = { q: '' };

/** window.__qa (geliştirici modunda kurulur). */
const qa = () => (window as any).__qa as { checkpoint(id: string): Promise<boolean> } | undefined;

export function renderDevPanel(scene: Scn, c: Phaser.GameObjects.Container, w: number, h: number) {
  c.add(uiIcon(scene, 16, 16, 'dev', 30));
  c.add(txt(scene, 38, 0, 'Geliştirici Modu', { size: 24, font: FONT.title, color: COLORS.textGold }));
  const list = new ScrollList(scene, 0, 44, w, h - 52);
  c.add(list);
  list.updateMask();
  const I = list.inner;
  let y = 0;
  let x = 0;
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

  // ------------------------------------------------------------ 0.11.0 (E): hikâye noktasına atla
  head('Hikâye noktasına atla');
  I.add(txt(scene, 0, y, 'Bayraklar, görevler, envanter, para ve konum tutarlı kurulur (yeni oyundan).', { size: 13, italic: true, color: COLORS.textDim, wrap: w - 20 }));
  y += 24;
  x = 0;
  for (const cp of CHECKPOINTS) {
    if (x > w - 210) { x = 0; y += 44; }
    x = btn(x, cp.name, () => {
      scene.close();
      void qa()?.checkpoint(cp.id);
    }, 200);
  }
  y += 52;
  // ------------------------------------------------------------ dövüş araçları
  head('Dövüş');
  x = 0;
  x = btn(x, `Ölümsüz: ${Dev.god ? 'AÇIK' : 'kapalı'}`, () => (Dev.god = !Dev.god), 150);
  x = btn(x, `Tek vuruş: ${Dev.oneHit ? 'AÇIK' : 'kapalı'}`, () => (Dev.oneHit = !Dev.oneHit), 150);
  x = btn(x, `Katman: ${Dev.debug ? 'AÇIK' : 'kapalı'}`, () => (Dev.debug = !Dev.debug), 140);
  x = btn(x, 'Yaratıkları yeniden doğur', () => scene.world?.respawnAll?.(), 220);
  y += 44;
  I.add(txt(scene, 0, y + 6, 'Yanına doğur:', { size: 14, color: COLORS.textDim }));
  x = 120;
  for (const m of Object.values(MONSTERS)) {
    if (x > w - 130) { x = 120; y += 44; }
    x = btn(x, m.name.slice(0, 12), () => {
      const a = scene.world?.player?.actor;
      if (a) scene.world.spawnAt(m.id, Math.round(a.x / 32) + 3, Math.round(a.y / 32), 1, 1, 'dev');
    }, 120);
  }
  y += 52;
  // ------------------------------------------------------------ Joseph
  head('Joseph');
  rowLabel(`Level ${p.level} · EXP ${fmtExp(p.exp)}`);
  x = 260;
  x = btn(x, '−1', () => (p.level = Math.max(0, p.level - 1)));
  x = btn(x, '+1', () => { p.level++; p.unspent += STAT_POINTS_PER_LEVEL; p.sp += SP_PER_LEVEL; });
  x = btn(x, '+50 EXP', () => R.gainExp(50), 100);
  y += 44;
  for (const k of STAT_KEYS) {
    rowLabel(`${k} ${p.alloc[k]}`);
    let xx = 260;
    xx = btn(xx, '−1', () => (p.alloc[k] = Math.max(0, p.alloc[k] - 1)));
    xx = btn(xx, '+1', () => p.alloc[k]++);
    y += 44;
  }
  // E: ilerleme — Divine level ±, SP +1, haftalık kuraldan bağımsız Sistem Teklifi
  rowLabel(`Divine Level ${G.state.divine.level} · SP ${p.sp}`);
  x = 260;
  x = btn(x, 'D −1', () => (G.state.divine.level = Math.max(0, G.state.divine.level - 1)), 60);
  x = btn(x, 'D +1', () => { G.state.divine.level++; G.events.emit('divineLevel', G.state.divine.level); }, 60);
  x = btn(x, 'SP +1', () => p.sp++, 64);
  x = btn(x, 'Teklif (haftasız)', () => { G.state.lastSkillLearnWeek = null; if (p.sp < 1) p.sp = 1; (scene as any).tab = 'status'; void (scene as any).systemOffer?.(); }, 150);
  y += 44;
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
  // E: skill ekle
  I.add(txt(scene, 0, y + 6, 'Skill ekle:', { size: 14, color: COLORS.textDim }));
  x = 100;
  for (const def of Object.values(SKILLS)) {
    if (p.skills.some((s) => s.id === def.id)) continue;
    if (x > w - 140) { x = 100; y += 44; }
    x = btn(x, def.name.slice(0, 13), () => { p.skills.push(newSkill(def.id)); G.events.emit('skills'); }, 130);
  }
  y += 52;
  // E: listeden eşya ekle
  I.add(txt(scene, 0, y + 6, 'Eşya ekle:', { size: 14, color: COLORS.textDim }));
  x = 100;
  for (const it of Object.values(ITEMS)) {
    if (x > w - 130) { x = 100; y += 44; }
    x = btn(x, it.name.slice(0, 12), () => R.giveItems([{ id: it.id, qty: 1 }], 'Geliştirici', true), 120);
  }
  y += 52;
  // E: Ansiklopedi
  rowLabel('Ansiklopedi');
  x = 260;
  x = btn(x, 'Tamamen aç', () => codexUnlockAll(G.state.codex, G.state.time.day), 130);
  x = btn(x, 'Sıfırla', () => (G.state.codex = newCodex()), 90);
  y += 52;
  // ------------------------------------------------------------ zaman ve ışınlanma
  head('Zaman');
  x = 0;
  x = btn(x, `Saat ×${Dev.clockScale === 4 ? '4 (açık)' : '1'}`, () => (Dev.clockScale = Dev.clockScale === 4 ? 1 : 4), 130);
  x = btn(x, Dev.clockPaused ? 'Saati sürdür' : 'Saati durdur', () => (Dev.clockPaused = !Dev.clockPaused), 140);
  y += 44;
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
  btn(0, 'Görev hedefine ışınlan', () => {
    scene.close();
    void scene.world?.teleportToQuestTarget?.();
  }, 220);
  y += 50;
  // ------------------------------------------------------------ görevler ve lonca
  head('Görevler ve Lonca');
  rowLabel(`Lonca Puanı ${G.state.guild.points} · Borç ${G.state.guild.debt} · Rütbe ${p.guildRank === null ? 'yok' : subRankToString(p.guildRank)}`);
  x = 420;
  x = btn(x, '−10', () => (G.state.guild.points -= 10), 60);
  x = btn(x, '+10', () => { G.state.guild.points += 10; Q.checkPromotion(); }, 60);
  x = btn(x, 'Eşiğe', () => { const r = G.p.guildRank; if (r !== null && r + 1 < RANK_THRESHOLDS.length) G.state.guild.points = Math.max(G.state.guild.points, RANK_THRESHOLDS[r + 1]); Q.checkPromotion(); }, 76);
  x = btn(x, 'Terfi (anında)', () => { Q.checkPromotion(); Q.promote(); }, 140);
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
  // ------------------------------------------------------------ E: durum (bayrak ve sayaçlar, aranabilir)
  head('Durum');
  rowLabel(`Bayrak ${Object.keys(G.state.flags).length} · Sayaç ${Object.keys(G.state.counters).length}${DEV_FILTER.q ? ` · arama: "${DEV_FILTER.q}"` : ''}`);
  x = 420;
  x = btn(x, 'Ara', () => { DEV_FILTER.q = (window.prompt('Bayrak / sayaç ara', DEV_FILTER.q) ?? '').trim(); }, 70);
  x = btn(x, 'Temizle', () => (DEV_FILTER.q = ''), 90);
  y += 44;
  const rows = [...Object.entries(G.state.flags).map(([k, v]) => `⚑ ${k} = ${v}`), ...Object.entries(G.state.counters).map(([k, v]) => `# ${k} = ${v}`)]
    .filter((r) => !DEV_FILTER.q || r.toLowerCase().includes(DEV_FILTER.q.toLowerCase()))
    .sort();
  const shown = rows.slice(0, 80);
  const t = txt(scene, 0, y, shown.join('\n') || '—', { size: 12, color: '#cfe6b8', wrap: w - 20 });
  I.add(t);
  y += t.height + (rows.length > shown.length ? 20 : 8);
  if (rows.length > shown.length) I.add(txt(scene, 0, y - 18, `… ${rows.length - shown.length} satır daha (aramayı daralt)`, { size: 12, italic: true, color: COLORS.textDim }));
  // ------------------------------------------------------------ E: kayıt dışa/içe aktarma
  head('Kayıt dışa / içe aktar');
  x = 0;
  x = btn(x, 'JSON\'u kopyala', () => {
    const json = JSON.stringify(G.state);
    void navigator.clipboard?.writeText(json).then(() => R.toast('Kayıt panoya kopyalandı.', 'info')).catch(() => window.prompt('Kopyala:', json));
  }, 160);
  x = btn(x, 'Yapıştır → yuvaya yükle', async () => {
    const json = window.prompt('Kayıt JSON\'unu yapıştır');
    if (!json) return;
    const slot = await pickSlot(scene, 'store', G.slot);
    if (!slot || slot === 'legacy') return;
    if (!importToSlot(localStorage, slot, json)) {
      R.toast('Geçersiz kayıt.', 'warn');
      return;
    }
    if (G.load(slot)) {
      scene.close();
      leaveGame(scene.scene, scene.ui, 'World');
    }
  }, 230);
  y += 52;
  // ------------------------------------------------------------ E: hata kaydı
  head(`Hata kaydı (${errors().length})`);
  x = 0;
  x = btn(x, 'Kopyala', () => void navigator.clipboard?.writeText(errorsText()).catch(() => window.prompt('Kopyala:', errorsText())), 100);
  x = btn(x, 'Temizle', () => clearErrors(), 100);
  y += 44;
  for (const e of errors().slice(-12).reverse()) {
    const et = txt(scene, 0, y, `${new Date(e.at).toLocaleTimeString('tr-TR')} · ${e.source}: ${e.message}\n${e.stack.split('\n').slice(0, 3).join('\n')}`, { size: 11, color: '#ffb0a0', wrap: w - 20 });
    I.add(et);
    y += et.height + 6;
  }
  y += 10;
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
