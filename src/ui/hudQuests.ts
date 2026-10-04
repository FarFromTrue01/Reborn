// Sol üst HUD'daki Görevler kutusu (B3/C2) ve yoldaş HP çubukları (C4).
// Kutu açılıp kapanabilir; dokunulan görev takip edilir ve yön oku onu gösterir.
// 0.5.0: Ana Görevler ve Yan Görevler (pano dahil) ayrı başlıklar altında; hangi kategorinin görüneceği
// Menü → Görevler'den seçilir ve kutunun açık/kapalı durumu gibi localStorage'da kalır.
import Phaser from 'phaser';
import { G } from '../game/G';
import { Q } from '../game/questrt';
import { activeQuests, currentObjective, visibleObjectives, hudQuestGroups, type QuestHudPrefs } from '../core/quests';
import { COLORS, FONT, txt, uiIcon } from './kit';
import { Sound } from '../audio/audio';

export const KIND_ICON: Record<string, string> = { main: 'main_quest', side: 'side_quest', board: 'board_quest' };

const PREF_KEYS: Record<keyof QuestHudPrefs, string> = { main: 'elonth.questbox.main', side: 'elonth.questbox.side' };

/** HUD'da hangi görev kategorileri görünsün (varsayılan: ikisi de). */
export function loadQuestHudPrefs(): QuestHudPrefs {
  const p: QuestHudPrefs = { main: true, side: true };
  try {
    for (const k of ['main', 'side'] as const) p[k] = localStorage.getItem(PREF_KEYS[k]) !== '0';
  } catch {
    /* depolama yok */
  }
  return p;
}

export function saveQuestHudPref(cat: keyof QuestHudPrefs, on: boolean) {
  try {
    localStorage.setItem(PREF_KEYS[cat], on ? '1' : '0');
  } catch {
    /* depolama yok */
  }
}

const CAT_TITLE = { main: 'Ana Görevler', side: 'Yan Görevler' } as const;
/** Kategori başına HUD'da gösterilen en fazla görev. */
const PER_CAT = 3;

export class QuestBox extends Phaser.GameObjects.Container {
  boxH = 0;
  collapsed = false;
  private key = '';
  w = 300;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    scene.add.existing(this);
    try {
      this.collapsed = localStorage.getItem('elonth.questbox') === '0';
    } catch {
      /* depolama yok */
    }
  }

  /** Görev durumu değişince (ya da her saniye) çağrılır; değişiklik yoksa yeniden çizmez. */
  refresh(force = false) {
    const log = G.state.quests;
    const ids = activeQuests(log);
    const prefs = loadQuestHudPrefs();
    const key = JSON.stringify([this.collapsed, prefs, log.tracked, ids.map((id) => [id, log.quests[id].progress])]);
    if (key === this.key && !force) return;
    this.key = key;
    this.removeAll(true);
    const W = this.w;
    const g = this.scene.add.graphics();
    this.add(g);
    // başlık
    const head = this.scene.add.container(0, 0);
    head.add(uiIcon(this.scene, 18, 16, 'quests', 22));
    head.add(txt(this.scene, 34, 6, `Görevler${ids.length ? ` (${ids.length})` : ''}`, { size: 15, bold: true, font: FONT.title, color: COLORS.textGold, stroke: true }));
    head.add(txt(this.scene, W - 14, 6, this.collapsed ? '▸' : '▾', { size: 16, bold: true, color: COLORS.textGold }).setOrigin(1, 0));
    const hz = this.scene.add.zone(0, 0, W, 32).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    hz.on('pointerdown', (_p: any, _x: number, _y: number, ev: any) => {
      ev?.stopPropagation?.();
      this.collapsed = !this.collapsed;
      try {
        localStorage.setItem('elonth.questbox', this.collapsed ? '0' : '1');
      } catch {
        /* */
      }
      Sound.sfx('click', 0.4);
      this.refresh(true);
    });
    head.addAt(hz, 0);
    this.add(head);
    let y = 32;
    if (!this.collapsed) {
      const groups = hudQuestGroups(ids, (id) => Q.def(id)?.kind, prefs);
      if (!ids.length) {
        this.add(txt(this.scene, 14, y, 'Aktif görev yok.', { size: 13, italic: true, color: COLORS.textDim }));
        y += 22;
      } else if (!groups.length) {
        this.add(txt(this.scene, 14, y, 'Görevler HUD\'da gizli (Menü → Görevler).', { size: 12, italic: true, color: COLORS.textDim, wrap: W - 24 }));
        y += 22;
      }
      let hidden = 0;
      for (const grp of groups) {
        // kategori başlığı (kategori boşsa hiç çizilmez: hudQuestGroups boşları atar)
        const ct = txt(this.scene, 12, y + 2, CAT_TITLE[grp.cat].toUpperCase(), { size: 11, bold: true, font: FONT.title, color: '#c9b98f', stroke: true });
        this.add(ct);
        const lg = this.scene.add.graphics();
        lg.lineStyle(1, COLORS.gold, 0.25);
        lg.lineBetween(ct.width + 22, y + 10, W - 12, y + 10);
        this.add(lg);
        y += 18;
        // takip edilen görev kendi kategorisinde her zaman görünür
        const shown = grp.ids.slice(0, PER_CAT);
        if (log.tracked && grp.ids.includes(log.tracked) && !shown.includes(log.tracked)) shown[shown.length - 1] = log.tracked;
        hidden += grp.ids.length - shown.length;
        for (const id of shown) y += this.row(id, y);
        y += 2;
      }
      if (hidden > 0) {
        this.add(txt(this.scene, 14, y, `+${hidden} görev daha (Menü → Görevler)`, { size: 12, italic: true, color: COLORS.textDim }));
        y += 20;
      }
      y += 4;
    }
    this.boxH = y;
    g.fillStyle(0x0c0a12, 0.72);
    g.fillRoundedRect(0, 0, W, y, 8);
    g.lineStyle(1.5, COLORS.goldDark, 1);
    g.strokeRoundedRect(0, 0, W, y, 8);
    g.lineStyle(1, COLORS.gold, 0.35);
    g.lineBetween(10, 31, W - 10, 31);
  }

  /** Tek görev satırı; yüksekliğini döndürür. */
  private row(id: string, y: number): number {
    const log = G.state.quests;
    const def = Q.def(id);
    const st = log.quests[id];
    if (!def || !st) return 0;
    const W = this.w;
    const tracked = log.tracked === id;
    const row = this.scene.add.container(0, y);
    const ci = currentObjective(def, st);
    const vis = visibleObjectives(def, st);
    const o = def.objectives[ci >= 0 && vis.includes(ci) ? ci : vis[vis.length - 1]];
    const prog = o && (o.count ?? 1) > 1 ? ` ${st.progress[def.objectives.indexOf(o)]}/${o.count}` : '';
    const t1 = txt(this.scene, 32, 2, def.title, { size: 14, bold: true, color: tracked ? '#ffe9a0' : COLORS.text, stroke: true });
    const t2 = txt(this.scene, 32, 20, (o?.label ?? '') + prog, { size: 12, color: tracked ? '#cfe6b8' : COLORS.textDim, wrap: W - 44, stroke: true });
    const rh = Math.max(40, 22 + t2.height + 4);
    const bg = this.scene.add.graphics();
    if (tracked) {
      bg.fillStyle(0xd9b45a, 0.14);
      bg.fillRoundedRect(4, 0, W - 8, rh - 2, 6);
      bg.lineStyle(1, COLORS.gold, 0.7);
      bg.strokeRoundedRect(4, 0, W - 8, rh - 2, 6);
    }
    row.add(bg);
    row.add(uiIcon(this.scene, 17, 14, KIND_ICON[def.kind] ?? 'quests', 20));
    if (tracked) row.add(uiIcon(this.scene, W - 18, 14, 'target', 18));
    row.add([t1, t2]);
    const z = this.scene.add.zone(0, 0, W, rh).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    z.on('pointerdown', (_p: any, _x: number, _y: number, ev: any) => {
      ev?.stopPropagation?.();
      Q.track(tracked ? null : id);
      Sound.sfx('click', 0.5);
    });
    row.addAt(z, 0);
    this.add(row);
    return rh;
  }
}

/** Yoldaşların küçük HP çubukları. */
export class PartyBars extends Phaser.GameObjects.Container {
  h = 0;
  private g: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.g = scene.add.graphics();
    this.add(this.g);
    scene.add.existing(this);
  }

  draw(members: { name: string; hp: number; max: number; down: boolean }[]) {
    const g = this.g;
    g.clear();
    while (this.labels.length > members.length) this.labels.pop()!.destroy();
    while (this.labels.length < members.length) {
      const t = txt(this.scene, 0, 0, '', { size: 12, bold: true, stroke: true });
      this.labels.push(t);
      this.add(t);
    }
    if (!members.length) {
      this.h = 0;
      return;
    }
    const W = 300;
    const rowH = 22;
    this.h = members.length * rowH + 10;
    g.fillStyle(0x0c0a12, 0.66);
    g.fillRoundedRect(0, 0, W, this.h, 8);
    g.lineStyle(1, COLORS.goldDark, 1);
    g.strokeRoundedRect(0, 0, W, this.h, 8);
    members.forEach((m, i) => {
      const y = 5 + i * rowH;
      const t = this.labels[i];
      t.setText(m.down ? `${m.name} (yerde)` : m.name).setPosition(12, y + 3).setColor(m.down ? '#ff9a8a' : COLORS.text);
      const bx = 112, bw = W - bx - 12;
      g.fillStyle(0x000000, 0.6);
      g.fillRect(bx, y + 6, bw, 9);
      g.fillStyle(m.down ? 0x6a3030 : COLORS.hp, 1);
      g.fillRect(bx, y + 6, bw * Math.max(0, Math.min(1, m.hp / Math.max(1, m.max))), 9);
      g.lineStyle(1, COLORS.goldDark, 1);
      g.strokeRect(bx - 1, y + 5, bw + 2, 11);
    });
  }
}
