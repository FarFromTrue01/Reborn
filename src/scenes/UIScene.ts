import Phaser from 'phaser';
import { G } from '../game/G';
import { Display } from '../game/display';
import { Input, type Action } from '../game/input';
import { Sound } from '../audio/audio';
import { COLORS, FONT, txt, drawFrame, drawBlue, drawBar, Button } from '../ui/kit';
import { clockLabel, dateLabel } from '../core/time';
import { formatPrice } from '../core/money';
import { coinRow, richLine, plainMoney } from '../ui/coins';
import { expToNext } from '../core/formulas';
import { cooldownInfo } from '../core/eating';
import { subRankToString as srs } from '../core/ranks';
import { ensurePortrait, EXPR_GLYPH } from '../ui/portraits';
import { NPC_BY_ID, type NpcDef } from '../data/npcs';
import { TECHNIQUES, SKILLS } from '../data/skills';
import { DIVINE_BY_ID } from '../data/divine';
import { appraisalView } from '../core/appraisal';
import { derive } from '../core/creature';
import { subRankToString, skillThreshold } from '../core/ranks';
import { ITEMS } from '../data/items';
import { TITLES } from '../data/titles';
import { STAT_KEYS } from '../core/formulas';
import { EQUIP_SLOTS, EQUIP_SLOT_NAMES } from '../core/types';
import { itemLabel } from '../ui/format';
import type { WorldScene } from './WorldScene';
import { fogOf } from './WorldScene';
import { TERRAIN, TILE } from '../world/types';
import type { Expression } from '../data/manifest';
import { LIGHT_MAX } from '../core/divine';

interface SayOpts {
  expr?: Expression;
  name?: string;
  voice?: string;
}

const SPEAKER_NAMES: Record<string, string> = { joseph: 'Joseph', system: 'Sistem' };

export class UIScene extends Phaser.Scene {
  hud!: Phaser.GameObjects.Container;
  hudG!: Phaser.GameObjects.Graphics;
  hudTexts: Record<string, Phaser.GameObjects.Text> = {};
  minimap!: Phaser.GameObjects.Image;
  minimapTex!: Phaser.Textures.CanvasTexture;
  minimapT = 0;
  touch!: Phaser.GameObjects.Container;
  touchButtons: Record<string, Button> = {};
  skillBtns: Button[] = [];
  divBtns: Button[] = [];
  cdOverlay!: Phaser.GameObjects.Graphics;
  joy: { id: number; bx: number; by: number; base: Phaser.GameObjects.Graphics; knob: Phaser.GameObjects.Graphics } | null = null;
  toasts: Phaser.GameObjects.Container[] = [];
  sysQueue: { title: string; lines: string[]; sound?: string; big?: boolean }[] = [];
  sysShowing: Phaser.GameObjects.Container | null = null;
  dlg: Phaser.GameObjects.Container | null = null;
  dlgState: { full: string; shown: number; t: number; done: boolean; resolve: () => void; voice: string; pause: number; textObj: Phaser.GameObjects.Text; auto: number } | null = null;
  choiceResolve: ((i: number) => void) | null = null;
  choiceObjs: Phaser.GameObjects.GameObject[] = [];
  appraisalWin: Phaser.GameObjects.Container | null = null;
  contextLabel: string | null = null;
  contextKind: string | null = null;
  moneyRow: (Phaser.GameObjects.Container & { rowWidth: number }) | null = null;
  moneyKey = '';
  eatBtn: Button | null = null;
  eatCount: Phaser.GameObjects.Text | null = null;
  joyFixed: { base: Phaser.GameObjects.Graphics; knob: Phaser.GameObjects.Graphics; x: number; y: number } | null = null;
  hudPanelH = 150;
  damageFlash!: Phaser.GameObjects.Rectangle;
  zoneBanner: Phaser.GameObjects.Container | null = null;
  ghostHp = 1;
  fpsText: Phaser.GameObjects.Text | null = null;
  menuIsOpen = false;
  overlay: Phaser.GameObjects.Container | null = null;
  hideHud = false;
  private isTouch = false;
  private skillIds: string[] = [];
  private divIds: string[] = [];

  constructor() {
    super('UI');
  }

  get world(): WorldScene {
    return this.scene.get('World') as WorldScene;
  }

  create() {
    this.cameras.main.setZoom(Display.uiZoom);
    this.cameras.main.setOrigin(0, 0);
    this.isTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
    this.input.addPointer(3);
    this.build();
    const off = Display.onResize(() => {
      this.cameras.main.setSize(Display.w, Display.h);
      this.cameras.main.setZoom(Display.uiZoom);
      this.rebuild();
    });
    const handlers: [string, (...a: any[]) => void][] = [
      ['toast', (t: any) => this.toast(t.text, t.kind, t.icon)],
      ['sysmsg', (m: any) => this.queueSys(m)],
      ['stats', () => this.refreshButtons()],
      ['skills', () => this.refreshButtons()],
      ['settings', () => this.applySettings()],
    ];
    for (const [k, h] of handlers) G.events.on(k, h);
    this.events.once('shutdown', () => {
      off();
      for (const [k, h] of handlers) G.events.off(k, h);
    });
    // joystick
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: any[]) => this.onDown(p, over));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.onUp(p));
  }

  applySettings() {
    Display.uiScaleSetting = G.settings.uiScale;
    Display.compute();
    this.cameras.main.setZoom(Display.uiZoom);
    this.rebuild();
  }

  rebuild() {
    const keep = this.dlg;
    this.hud?.destroy();
    this.touch?.destroy();
    this.cdOverlay?.destroy();
    this.damageFlash?.destroy();
    this.fpsText?.destroy();
    this.build();
    if (keep) this.children.bringToTop(keep);
  }

  // ================================================================== HUD
  build() {
    const W = Display.uiW, H = Display.uiH;
    this.hud = this.add.container(0, 0).setDepth(10);
    this.hudG = this.add.graphics();
    this.hud.add(this.hudG);
    this.hudTexts = {};
    this.moneyRow = null;
    this.moneyKey = '';
    const T = (k: string, x: number, y: number, o: any) => {
      const t = txt(this, x, y, '', o);
      this.hudTexts[k] = t;
      this.hud.add(t);
      return t;
    };
    // Sol üst: kimlik ve barlar
    T('name', 22, 12, { size: 19, font: FONT.title, color: COLORS.textGold, bold: true, stroke: true });
    T('lv', 0, 15, { size: 15, font: FONT.ui, bold: true, color: '#fff2c0', stroke: true });
    T('hp', 28, 43, { size: 14, font: FONT.ui, bold: true, stroke: true });
    T('mp', 28, 67, { size: 12, font: FONT.ui, bold: true, stroke: true });
    T('st', 296, 84, { size: 11, font: FONT.ui, bold: true, stroke: true, color: '#cfeac0' }).setOrigin(1, 0);
    T('exp', 296, 100, { size: 11, font: FONT.ui, bold: true, stroke: true, color: '#d8c8ff' }).setOrigin(1, 0);
    T('light', 28, 114, { size: 11, font: FONT.ui, bold: true, stroke: true, color: '#ffe9a0' });
    // Sağ üst: saat, tarih, bölge (okunur boyutta) ve mini harita
    T('clock', W - 196, 12, { size: 26, font: FONT.title, color: COLORS.textGold, bold: true, stroke: true, align: 'right' }).setOrigin(1, 0);
    T('date', W - 196, 46, { size: 15, color: '#e8dcc0', stroke: true, bold: true }).setOrigin(1, 0);
    T('zone', W - 196, 70, { size: 15, color: '#cfe6b8', stroke: true, italic: true, bold: true }).setOrigin(1, 0);
    if (!this.textures.exists('minimap')) this.minimapTex = this.textures.createCanvas('minimap', 160, 160)!;
    else this.minimapTex = this.textures.get('minimap') as Phaser.Textures.CanvasTexture;
    this.minimap = this.add.image(W - 98, 92, 'minimap').setDisplaySize(160, 160);
    // Mini haritaya dokununca tam ekran harita
    this.minimap.setInteractive({ useHandCursor: true });
    this.minimap.on('pointerup', () => this.openMenu('map'));
    this.hud.add(this.minimap);
    const mf = this.add.graphics();
    drawFrame(mf, W - 180, 10, 164, 164, { alpha: 0, ornate: true });
    this.hud.add(mf);
    // menü ve appraisal butonları
    const menuB = new Button(this, W - 52, 216, '☰', () => this.openMenu(), { w: 60, h: 60, style: 'round', size: 26 });
    this.hud.add(menuB);
    const apB = new Button(this, W - 124, 216, '', () => { Input.press('appraise'); }, { w: 60, h: 60, style: 'round', icon: 'sk_appraisal' });
    this.hud.add(apB);
    this.buildTouch();
    // Bekleme ve parlama göstergeleri butonların ÜSTÜNDE çizilir
    this.cdOverlay = this.add.graphics().setDepth(21);
    this.damageFlash = this.add.rectangle(0, 0, W, H, 0xff0000, 0).setOrigin(0, 0).setDepth(50);
    if (G.settings.showFps) this.fpsText = txt(this, W / 2, 8, '', { size: 13, stroke: true }).setOrigin(0.5, 0).setDepth(60);
    this.refreshButtons();
    this.drawMinimap(true);
  }

  buildTouch() {
    const W = Display.uiW, H = Display.uiH;
    this.touch = this.add.container(0, 0).setDepth(20);
    this.touchButtons = {};
    const big = this.isTouch;
    const mk = (key: Action, label: string, x: number, y: number, r: number, icon?: string, color?: number) => {
      const b = new Button(this, x, y, label, () => {}, { w: r * 2, h: r * 2, style: 'round', size: Math.round(r * 0.42), icon, color, sound: null });
      b.removeAllListeners('pointerup');
      b.on('pointerdown', () => {
        Sound.unlock();
        if (this.dialogueOpen()) {
          this.advanceDialogue();
          return;
        }
        Input.press(key);
        b.setScale(0.92);
      });
      b.on('pointerup', () => b.setScale(1));
      b.on('pointerout', () => b.setScale(1));
      this.touch.add(b);
      this.touchButtons[key] = b;
      return b;
    };
    const s = big ? 1 : 0.8;
    const ax = W - 110 * s, ay = H - 120 * s;
    mk('attack', 'Saldır', ax, ay, 56 * s, undefined, 0x3a1a1a);
    mk('dodge', 'Kaçış', ax - 120 * s, ay + 52 * s, 38 * s, undefined, 0x16304a);
    mk('heavy', 'Ağır', ax - 20 * s, ay - 110 * s, 36 * s, undefined, 0x3a2410);
    mk('interact', 'Etkileşim', ax - 128 * s, ay - 52 * s, 36 * s, undefined, 0x1e3a1e);
    // Hızlı Yemek: Kaçış butonunun solunda
    this.eatBtn = mk('eat', '', ax - 212 * s, ay + 66 * s, 32 * s, 'bread', 0x2a2016);
    this.eatCount = txt(this, this.eatBtn.x + 22 * s, this.eatBtn.y + 14 * s, '', { size: Math.round(15 * s + 2), bold: true, stroke: true }).setOrigin(1, 0.5);
    this.touch.add(this.eatCount);
    // Sabit joystick: tabanı her zaman sol altta görünür
    this.joyFixed = null;
    if (G.settings.joystick === 'fixed' && this.isTouch) {
      const jx = 150, jy = H - 150;
      const base = this.add.graphics();
      base.fillStyle(0x000000, 0.3);
      base.fillCircle(0, 0, 76);
      base.lineStyle(2.5, COLORS.gold, 0.75);
      base.strokeCircle(0, 0, 76);
      base.lineStyle(1, COLORS.goldDark, 0.8);
      base.strokeCircle(0, 0, 40);
      base.setPosition(jx, jy);
      const knob = this.add.graphics();
      knob.fillStyle(0xd9b45a, 0.6);
      knob.fillCircle(0, 0, 32);
      knob.lineStyle(2, 0xf3dc95, 0.95);
      knob.strokeCircle(0, 0, 32);
      knob.setPosition(jx, jy);
      this.touch.add([base, knob]);
      this.joyFixed = { base, knob, x: jx, y: jy };
    }
    this.skillBtns = [];
    for (let i = 0; i < 4; i++) {
      const ang = Math.PI * (1.02 + i * 0.16);
      const r = 205 * s;
      const b = mk(('skill' + (i + 1)) as Action, '', ax + Math.cos(ang) * r, ay + Math.sin(ang) * r * 0.95 + 10, 28 * s, 'stone', 0x1a1426);
      this.skillBtns.push(b);
    }
    this.divBtns = [];
    for (let i = 0; i < 3; i++) {
      const b = mk(('div' + (i + 1)) as Action, '', ax + 60 * s - i * 66 * s, ay - 200 * s, 26 * s, 'dv_holy_shield', 0x3a2e0a);
      this.divBtns.push(b);
    }
    if (!big) {
      // klavye ipuçları
      const hint = txt(this, 14, H - 26, 'WASD: hareket · Shift: koş · J/Tık: saldırı · K: ağır · Boşluk: kaçış · E: etkileşim · F: hızlı yemek · Q: Appraisal · 1-4: skill · Z/X/C: Divine · Esc: menü', { size: 11, color: COLORS.textDim, stroke: true });
      this.touch.add(hint);
    }
  }

  refreshButtons() {
    if (!this.skillBtns?.length) return;
    const w = this.world;
    const techs = w?.equippedTechniques?.() ?? [];
    this.skillIds = techs;
    this.skillBtns.forEach((b, i) => {
      const id = techs[i];
      b.setVisible(!!id);
      if (id) {
        const sk = Object.values(SKILLS).find((s) => s.tiers.some((t) => t.technique === id));
        b.iconImg?.setFrame(sk?.icon ?? 'stone');
      }
    });
    const divs = w?.ownedDivineActives?.() ?? [];
    this.divIds = divs;
    this.divBtns.forEach((b, i) => {
      const id = divs[i];
      b.setVisible(!!id);
      if (id) b.iconImg?.setFrame(DIVINE_BY_ID[id].icon);
    });
  }

  update(_t: number, dms: number) {
    const dt = dms / 1000;
    if (!this.hud) return;
    this.drawHud(dt);
    this.minimapT -= dt;
    if (this.minimapT <= 0) {
      this.minimapT = 0.25;
      this.drawMinimap(false);
    }
    this.tickDialogue(dt);
    if (this.fpsText) this.fpsText.setText(`${Math.round(this.game.loop.actualFps)} FPS`);
    const hide = this.hideHud || this.menuIsOpen;
    this.hud.setVisible(!hide);
    this.touch.setVisible(!hide && !this.dialogueOpen() && !(this.world?.cutscene));
    this.cdOverlay.setVisible(this.touch.visible);
    this.updateInteractButton();
    this.updateEatButton();
  }

  drawHud(dt: number) {
    const g = this.hudG;
    g.clear();
    const p = G.p;
    const d = G.d;
    const W = Display.uiW;
    // sol üst panel
    const hasLight = G.state.divine.skills.length > 0;
    const panelH = hasLight ? 168 : 150;
    this.hudPanelH = panelH;
    drawFrame(g, 8, 6, 300, panelH, { alpha: 0.8, ornate: false });
    this.hudTexts.name.setText('Joseph');
    const lvX = 22 + this.hudTexts.name.width + 12;
    const rank = p.guildRank !== null ? `  ·  ${srs(p.guildRank)}` : '';
    this.hudTexts.lv.setText(`Lv ${p.level}${rank}`).setPosition(lvX + 8, 15);
    g.fillStyle(0x3a2e1a, 0.9);
    g.fillRoundedRect(lvX, 13, this.hudTexts.lv.width + 16, 22, 6);
    g.lineStyle(1, COLORS.gold, 0.9);
    g.strokeRoundedRect(lvX, 13, this.hudTexts.lv.width + 16, 22, 6);
    const hpF = p.hp / d.maxHp;
    this.ghostHp = Math.max(hpF, this.ghostHp - dt * 0.5);
    drawBar(g, 20, 42, 276, 18, hpF, COLORS.hp, 0x180808, this.ghostHp);
    if (hpF < 0.3) {
      const pulse = 0.25 + Math.sin(this.time.now / 160) * 0.2;
      g.lineStyle(2, 0xff3020, pulse);
      g.strokeRect(19, 41, 278, 20);
    }
    this.hudTexts.hp.setText(`HP ${Math.ceil(p.hp)} / ${d.maxHp}`);
    drawBar(g, 20, 66, 276, 13, d.maxMp ? p.mp / d.maxMp : 0, COLORS.mp, 0x0a0f20);
    this.hudTexts.mp.setText(`MP ${Math.floor(p.mp)} / ${d.maxMp}`);
    drawBar(g, 20, 86, 186, 9, p.stamina / d.maxStamina, COLORS.st, 0x0a160a);
    this.hudTexts.st.setText(`Dayanıklılık ${Math.floor(p.stamina)}`);
    const need = expToNext(p.level);
    drawBar(g, 20, 102, 186, 9, p.exp / need, 0x9a6ae8, 0x140a20);
    this.hudTexts.exp.setText(`EXP ${Math.floor(p.exp)} / ${need}`);
    let y = 120;
    if (hasLight) {
      drawBar(g, 20, 120, 276, 9, G.state.divine.light / LIGHT_MAX, COLORS.light, 0x1a1404);
      this.hudTexts.light.setText(`Işık ${Math.floor(G.state.divine.light)}`).setPosition(28, 116);
      y = 138;
    } else this.hudTexts.light.setText('');
    // Para: simgelerle (yalnızca değişince yeniden çizilir)
    const key = JSON.stringify(p.wallet) + y;
    if (key !== this.moneyKey) {
      this.moneyKey = key;
      this.moneyRow?.destroy();
      this.moneyRow = coinRow(this, 22, y + 2 + 13, p.wallet, { size: 20, font: 17, stroke: true });
      this.hud.add(this.moneyRow);
    }
    // sağ üst: okunur saat, tarih ve bölge (arkasında koyu zemin)
    this.hudTexts.clock.setText(clockLabel(G.state.time));
    this.hudTexts.date.setText(dateLabel(G.state.time));
    this.hudTexts.zone.setText(this.world?.zone?.name ?? this.world?.mapData?.name ?? '');
    const tw = Math.max(this.hudTexts.date.width, this.hudTexts.zone.width, this.hudTexts.clock.width) + 24;
    g.fillStyle(0x0c0a12, 0.62);
    g.fillRoundedRect(W - 196 - tw + 8, 8, tw + 4, 88, 8);
    // bekleme süreleri
    const c = this.cdOverlay;
    c.clear();
    const w = this.world;
    if (!w?.player) return;
    this.skillBtns.forEach((b, i) => {
      const id = this.skillIds[i];
      if (!id || !b.visible) return;
      const cd = w.player.skillCd[id] ?? 0;
      const t = TECHNIQUES[id];
      const lacking = G.p.mp < t.mp;
      if (cd > 0 || lacking) {
        c.fillStyle(0x000000, 0.55);
        c.slice(b.x, b.y, b.w / 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, cd > 0 ? cd / t.cooldown : 1), false);
        c.fillPath();
      }
    });
    this.divBtns.forEach((b, i) => {
      const id = this.divIds[i];
      if (!id || !b.visible) return;
      const def = DIVINE_BY_ID[id];
      const cd = w.player.skillCd['dv_' + id] ?? 0;
      if (cd > 0 || G.state.divine.light < def.light) {
        c.fillStyle(0x000000, 0.55);
        c.fillCircle(b.x, b.y, b.w / 2);
      }
    });
  }

  drawMinimap(force: boolean) {
    const w = this.world;
    if (!w?.mapData || !this.minimapTex) return;
    const m = w.mapData;
    const ctx = this.minimapTex.getContext();
    const S = 160;
    ctx.fillStyle = '#05040a';
    ctx.fillRect(0, 0, S, S);
    const a = w.player?.actor;
    if (!a) return;
    const scale = m.indoor ? Math.min(S / m.w, S / m.h) : 3;
    const cx = a.x / TILE, cy = a.y / TILE;
    const ox = m.indoor ? (S - m.w * scale) / 2 : S / 2 - cx * scale;
    const oy = m.indoor ? (S - m.h * scale) / 2 : S / 2 - cy * scale;
    const fog = fogOf(m);
    const x0 = Math.max(0, Math.floor(-ox / scale)), y0 = Math.max(0, Math.floor(-oy / scale));
    const x1 = Math.min(m.w, Math.ceil((S - ox) / scale)), y1 = Math.min(m.h, Math.ceil((S - oy) / scale));
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = y * m.w + x;
        if (!fog[i]) continue;
        ctx.fillStyle = terrainColor(m.terrain[i], m.solid[i], m.indoor);
        ctx.fillRect(ox + x * scale, oy + y * scale, scale + 0.5, scale + 0.5);
      }
    // binalar
    ctx.fillStyle = '#8a5a3a';
    for (const b of m.buildings) {
      const bx = ox + b.tx * scale, by = oy + (b.tyBottom - 5) * scale;
      const i = (b.tyBottom - 1) * m.w + b.tx + 1;
      if (fog[i]) ctx.fillRect(bx, by, 5 * scale, 4 * scale);
    }
    // NPC ve düşmanlar
    for (const n of w.npcs) {
      ctx.fillStyle = '#f0d27a';
      ctx.fillRect(ox + (n.x / TILE) * scale - 1, oy + (n.y / TILE) * scale - 1, 2.5, 2.5);
    }
    for (const e of w.enemies) {
      if (!e.alive || !e.aware) continue;
      ctx.fillStyle = '#ff4030';
      ctx.fillRect(ox + (e.x / TILE) * scale - 1, oy + (e.y / TILE) * scale - 1, 2.5, 2.5);
    }
    // oyuncu
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ox + cx * scale, oy + cy * scale, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
    this.minimapTex.refresh();
  }

  onMapChanged() {
    this.drawMinimap(true);
    this.refreshButtons();
  }

  setContext(label: string | null, kind: string | null = null) {
    this.contextLabel = label;
    this.contextKind = kind;
  }

  /**
   * Etkileşim butonu: menzilde bir şey varsa renk değiştirir, nabız gibi parlar ve ~%10 büyür.
   * Konuş (NPC) mavi, diğer etkileşimler (kapı, eşya, toplama, yatak) yeşil. Menzilde bir şey yoksa sönük.
   */
  updateInteractButton() {
    const b = this.touchButtons.interact;
    if (!b) return;
    const kind = this.contextLabel !== null ? this.contextKind : null;
    const talk = kind === 'npc';
    const color = kind ? (talk ? 0x1d4f8c : 0x2a6a24) : 0x1e2a1e;
    if (b.opts.color !== color) {
      b.opts.color = color;
      b.redraw();
    }
    b.setText(this.contextLabel ?? 'Etkileşim');
    const base = this.isTouch ? 1 : 0.8;
    void base;
    if (kind) {
      const t = this.time.now / 1000;
      b.setAlpha(1);
      if (!(b as any).down) b.setScale(1.1 + Math.sin(t * 5) * 0.025);
      const c = this.cdOverlay;
      const ring = talk ? 0x7cc8ff : 0x9fe08a;
      c.lineStyle(3, ring, 0.45 + Math.sin(t * 5) * 0.3);
      c.strokeCircle(b.x, b.y, (b.w / 2) * 1.1 + 5 + Math.sin(t * 5) * 2);
      c.fillStyle(ring, 0.1 + Math.sin(t * 5) * 0.05);
      c.fillCircle(b.x, b.y, (b.w / 2) * 1.1 + 4);
    } else {
      b.setAlpha(0.42);
      b.setScale(1);
    }
  }

  /** Hızlı Yemek butonu: atanmış yiyeceğin ikonu, adedi ve dairesel bekleme göstergesi. */
  updateEatButton() {
    const b = this.eatBtn;
    if (!b || !this.world?.player) return;
    const id = this.world.quickFoodId();
    const n = id ? G.p.inventory[id] ?? 0 : 0;
    if (id && b.iconImg) {
      const icon = ITEMS[id]?.icon ?? 'bread';
      if (b.iconImg.frame.name !== icon) b.iconImg.setFrame(icon);
    }
    this.eatCount?.setText(n ? `${n}` : '');
    const cd = cooldownInfo(this.world.eatState, this.world.playClock);
    b.setAlpha(!id ? 0.35 : cd.left > 0 ? 0.75 : 1);
    if (id && cd.left > 0) {
      const c = this.cdOverlay;
      c.fillStyle(0x000000, 0.6);
      c.slice(b.x, b.y, b.w / 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (cd.left / cd.total), false);
      c.fillPath();
      c.lineStyle(2, 0xf3dc95, 0.9);
      c.beginPath();
      c.arc(b.x, b.y, b.w / 2 + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - cd.left / cd.total), false);
      c.strokePath();
    }
  }

  // ================================================================== joystick
  onDown(p: Phaser.Input.Pointer, over: any[] = []) {
    Sound.unlock();
    if (over.length) return;
    if (this.dialogueOpen()) {
      this.advanceDialogue();
      return;
    }
    if (this.sysShowing) {
      this.dismissSys();
    }
    if (this.menuIsOpen || this.world?.cutscene) return;
    const x = p.x / Display.uiZoom, y = p.y / Display.uiZoom;
    if (!p.wasTouch && !this.isTouch) return;
    // Dünyadaki bir NPC'ye ya da canavara dokunmak: Appraisal (joystick/saldırı başlamaz)
    const target = this.world?.creatureAtScreen(p.x, p.y);
    if (target) {
      this.world.tapAppraise(target);
      return;
    }
    if (x < Display.uiW * 0.45 && !this.joy) {
      if (this.joyFixed) {
        // Sabit joystick: taban yerinde kalır, topuz parmağı izler
        this.joy = { id: p.id, bx: this.joyFixed.x, by: this.joyFixed.y, base: this.joyFixed.base, knob: this.joyFixed.knob };
        Input.touchMove = true;
        this.onMove(p);
        return;
      }
      const base = this.add.graphics().setDepth(30);
      base.fillStyle(0x000000, 0.25);
      base.fillCircle(0, 0, 70);
      base.lineStyle(2, COLORS.gold, 0.6);
      base.strokeCircle(0, 0, 70);
      base.setPosition(x, y);
      const knob = this.add.graphics().setDepth(31);
      knob.fillStyle(0xd9b45a, 0.55);
      knob.fillCircle(0, 0, 30);
      knob.lineStyle(2, 0xf3dc95, 0.9);
      knob.strokeCircle(0, 0, 30);
      knob.setPosition(x, y);
      this.joy = { id: p.id, bx: x, by: y, base, knob };
      Input.touchMove = true;
    }
  }

  onMove(p: Phaser.Input.Pointer) {
    if (!this.joy || p.id !== this.joy.id) return;
    const x = p.x / Display.uiZoom, y = p.y / Display.uiZoom;
    let dx = x - this.joy.bx, dy = y - this.joy.by;
    const d = Math.hypot(dx, dy);
    const max = 70;
    if (d > max && this.joyFixed) {
      // sabit modda taban yerinde kalır
      dx = (dx / d) * max;
      dy = (dy / d) * max;
    } else if (d > max) {
      // taban parmağı takip etsin
      this.joy.bx += (dx / d) * (d - max);
      this.joy.by += (dy / d) * (d - max);
      this.joy.base.setPosition(this.joy.bx, this.joy.by);
      dx = x - this.joy.bx;
      dy = y - this.joy.by;
    }
    this.joy.knob.setPosition(this.joy.bx + dx, this.joy.by + dy);
    const len = Math.min(1, Math.hypot(dx, dy) / max);
    const dead = 0.12;
    if (len < dead) {
      Input.moveX = 0;
      Input.moveY = 0;
    } else {
      const k = (len - dead) / (1 - dead) / Math.max(0.001, Math.hypot(dx, dy));
      Input.moveX = dx * k;
      Input.moveY = dy * k;
    }
  }

  onUp(p: Phaser.Input.Pointer) {
    if (this.joy && p.id === this.joy.id) {
      if (this.joyFixed) this.joyFixed.knob.setPosition(this.joyFixed.x, this.joyFixed.y);
      else {
        this.joy.base.destroy();
        this.joy.knob.destroy();
      }
      this.joy = null;
      Input.moveX = 0;
      Input.moveY = 0;
      Input.touchMove = false;
    }
  }

  // ================================================================== bildirimler
  toast(text: string, kind = 'info', icon?: string) {
    const y0 = this.hudPanelH + 18;
    const c = this.add.container(16, y0).setDepth(40);
    const color = kind === 'exp' ? COLORS.textBlue : kind === 'divine' ? '#ffe9a0' : kind === 'money' ? '#f3dc95' : kind === 'warn' ? COLORS.textRed : COLORS.text;
    const hasIcon = !!icon && this.textures.get('icons').has(icon);
    const t = richLine(this, hasIcon ? 40 : 12, 17, text, { size: 16, bold: true, stroke: true, color });
    const g = this.add.graphics();
    const w = t.rowWidth + (hasIcon ? 52 : 24);
    g.fillStyle(0x0c0a12, 0.8);
    g.fillRoundedRect(0, 0, w, 34, 6);
    g.lineStyle(1, kind === 'divine' ? COLORS.gold : COLORS.goldDark, 0.9);
    g.strokeRoundedRect(0, 0, w, 34, 6);
    c.add(g);
    if (hasIcon) c.add(this.add.image(20, 17, 'icons', icon).setScale(0.75));
    c.add(t);
    c.setAlpha(0);
    c.x = -40;
    this.tweens.add({ targets: c, alpha: 1, x: 16, duration: 180, ease: 'Quad.Out' });
    this.toasts.unshift(c);
    this.toasts.forEach((tc, i) => this.tweens.add({ targets: tc, y: y0 + i * 40, duration: 150 }));
    if (this.toasts.length > 6) {
      const old = this.toasts.pop()!;
      old.destroy();
    }
    this.time.delayedCall(2600, () => {
      this.tweens.add({ targets: c, alpha: 0, duration: 400, onComplete: () => { c.destroy(); this.toasts = this.toasts.filter((x) => x !== c); } });
    });
  }

  toastInfo(text: string) {
    this.toast(text, 'info');
  }

  queueSys(m: { title: string; lines: string[]; sound?: string; big?: boolean }) {
    this.sysQueue.push(m);
    if (!this.sysShowing) this.nextSys();
  }

  nextSys() {
    const m = this.sysQueue.shift();
    if (!m) {
      this.sysShowing = null;
      return;
    }
    Sound.sfx(m.sound ?? 'system', 0.8);
    const W = Display.uiW;
    const w = m.big ? 520 : 440;
    const lineH = 22;
    const h = 56 + m.lines.length * lineH;
    const c = this.add.container(W / 2, m.big ? 150 : 120).setDepth(45);
    const g = this.add.graphics();
    drawBlue(g, -w / 2, 0, w, h, 0.82);
    c.add(g);
    c.add(txt(this, 0, 12, `【 ${m.title} 】`, { size: 18, font: FONT.title, color: '#e6f6ff', bold: true, align: 'center' }).setOrigin(0.5, 0));
    m.lines.forEach((l, i) => {
      if (/\{[mw]:/.test(l)) c.add(richLine(this, 0, 44 + i * lineH + 10, l, { size: 15, color: COLORS.textBlue, originX: 0.5 }));
      else c.add(txt(this, 0, 44 + i * lineH, l, { size: 15, color: COLORS.textBlue, align: 'center', wrap: w - 40 }).setOrigin(0.5, 0));
    });
    c.setAlpha(0).setScale(0.96, 0.6);
    this.tweens.add({ targets: c, alpha: 1, scaleY: 1, scaleX: 1, duration: 220, ease: 'Back.Out' });
    this.sysShowing = c;
    const dur = 2400 + m.lines.length * 700;
    this.time.delayedCall(dur, () => {
      if (this.sysShowing === c) this.dismissSys();
    });
  }

  dismissSys() {
    const c = this.sysShowing;
    if (!c) return;
    this.sysShowing = null;
    this.tweens.add({ targets: c, alpha: 0, y: c.y - 10, duration: 200, onComplete: () => { c.destroy(); this.nextSys(); } });
  }

  showZone(name: string) {
    this.zoneBanner?.destroy();
    const W = Display.uiW;
    const c = this.add.container(W / 2, 200).setDepth(35);
    const t = txt(this, 0, 0, name, { size: 30, font: FONT.title, color: COLORS.textGold, stroke: true, shadow: true }).setOrigin(0.5);
    const g = this.add.graphics();
    g.lineStyle(1.5, COLORS.gold, 0.9);
    g.lineBetween(-t.width / 2 - 60, 26, t.width / 2 + 60, 26);
    g.fillStyle(COLORS.gold, 1);
    g.fillTriangle(-4, 26, 0, 22, 4, 26);
    g.fillTriangle(-4, 26, 0, 30, 4, 26);
    c.add([g, t]);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 600, hold: 1800, yoyo: true, onComplete: () => c.destroy() });
    this.zoneBanner = c;
  }

  flashDamage() {
    this.damageFlash.setFillStyle(0xff0000, 0.22);
    this.tweens.add({ targets: this.damageFlash, fillAlpha: 0, duration: 300 });
  }

  // ================================================================== konuşma
  dialogueOpen() {
    return !!this.dlg || !!this.choiceResolve;
  }

  menuOpen() {
    return this.menuIsOpen;
  }

  private async ensureBox(speaker: string | null, kind: 'say' | 'think' | 'system' | 'narrate', opts: SayOpts) {
    this.dlg?.destroy();
    const W = Display.uiW, H = Display.uiH;
    const boxW = Math.min(1000, W - 40), boxH = 170;
    const x = (W - boxW) / 2, y = H - boxH - 18;
    const c = this.add.container(0, 0).setDepth(100);
    const g = this.add.graphics();
    if (kind === 'system') drawBlue(g, x, y, boxW, boxH, 0.85);
    else if (kind === 'narrate') {
      g.fillStyle(0x000000, 0.6);
      g.fillRect(0, y - 10, W, boxH + 30);
    } else drawFrame(g, x, y, boxW, boxH, { alpha: kind === 'think' ? 0.72 : 0.95 });
    c.add(g);
    let textX = x + 32;
    if (kind === 'say' && speaker) {
      const npc = NPC_BY_ID[speaker];
      const pid = speaker === 'joseph' ? 'joseph' : npc?.portrait ?? speaker;
      const layers = speaker === 'joseph' ? (this.world?.player?.actor.layers.map((l) => l.texture.key) ?? ['j_body', 'j_head']) : undefined;
      const { key } = await ensurePortrait(this, pid, opts.expr ?? 'normal', layers);
      const ps = 140;
      const px = x + 18, py = y - 30;
      const pf = this.add.graphics();
      drawFrame(pf, px - 4, py - 4, ps + 8, ps + 8, { ornate: false });
      const img = this.add.image(px + ps / 2, py + ps / 2, key);
      img.setDisplaySize(ps, ps);
      c.add([pf, img]);
      const glyph = EXPR_GLYPH[opts.expr ?? 'normal'];
      if (glyph && !key.startsWith('uportrait')) c.add(txt(this, px + ps - 10, py + 6, glyph.ch, { size: 26, bold: true, color: glyph.color, stroke: true }).setOrigin(1, 0));
      textX = px + ps + 26;
      // isim plakası
      const name = opts.name ?? SPEAKER_NAMES[speaker] ?? npc?.name ?? speaker;
      const nt = txt(this, textX, y - 16, name, { size: 19, font: FONT.title, bold: true, color: COLORS.textGold });
      const ng = this.add.graphics();
      ng.fillStyle(0x16121f, 1);
      ng.fillRoundedRect(textX - 12, y - 22, nt.width + 24, 32, 6);
      ng.lineStyle(1.5, COLORS.gold, 1);
      ng.strokeRoundedRect(textX - 12, y - 22, nt.width + 24, 32, 6);
      c.add([ng, nt]);
    } else if (kind === 'system') {
      c.add(txt(this, x + 24, y + 12, '【 SİSTEM 】', { size: 15, font: FONT.title, color: '#e6f6ff', bold: true }));
    }
    const tw = x + boxW - textX - 28;
    const style = kind === 'think' ? { size: 21, italic: true, color: '#a9c8ff', font: FONT.body } : kind === 'system' ? { size: 20, color: COLORS.textBlue, font: FONT.ui } : kind === 'narrate' ? { size: 22, color: COLORS.text, font: FONT.body, italic: true } : { size: 21, color: COLORS.text, font: FONT.body };
    const t = txt(this, textX, y + (kind === 'system' ? 42 : 26), '', { ...style, wrap: tw, lineSpacing: 4 });
    c.add(t);
    // devam oku
    const arrow = txt(this, x + boxW - 30, y + boxH - 30, '▼', { size: 14, color: COLORS.textGold });
    arrow.setName('arrow');
    arrow.setVisible(false);
    this.tweens.add({ targets: arrow, y: arrow.y + 4, yoyo: true, repeat: -1, duration: 400 });
    c.add(arrow);
    // tıklayınca ilerle
    const hit = this.add.zone(0, 0, W, H).setOrigin(0, 0).setInteractive();
    hit.on('pointerdown', () => this.advanceDialogue());
    c.addAt(hit, 0);
    this.dlg = c;
    return t;
  }

  private run(text: string, voice: string, t: Phaser.GameObjects.Text): Promise<void> {
    return new Promise((resolve) => {
      this.dlgState = { full: text, shown: 0, t: 0, done: false, resolve, voice, pause: 0, textObj: t, auto: 0 };
    });
  }

  private tickDialogue(dt: number) {
    const s = this.dlgState;
    if (!s) return;
    if (!s.done) {
      if (s.pause > 0) {
        s.pause -= dt;
        return;
      }
      s.t += dt * G.settings.textSpeed;
      while (s.t >= 1 && s.shown < s.full.length) {
        s.t -= 1;
        const ch = s.full[s.shown];
        s.shown++;
        Sound.blip(s.voice, ch);
        if (ch === '.' || ch === '!' || ch === '?') {
          s.pause = 0.22;
          break;
        }
        if (ch === ',') {
          s.pause = 0.08;
          break;
        }
      }
      s.textObj.setText(s.full.slice(0, s.shown));
      if (s.shown >= s.full.length) {
        s.done = true;
        (this.dlg?.getByName('arrow') as Phaser.GameObjects.Text)?.setVisible(true);
      }
    } else if (G.settings.autoAdvance) {
      s.auto += dt;
      if (s.auto > 1.2 + s.full.length * 0.03) this.advanceDialogue();
    }
  }

  advanceDialogue() {
    const s = this.dlgState;
    if (!s) return;
    if (!s.done) {
      s.shown = s.full.length;
      s.textObj.setText(s.full);
      s.done = true;
      (this.dlg?.getByName('arrow') as Phaser.GameObjects.Text)?.setVisible(true);
      return;
    }
    Sound.sfx('click', 0.4);
    this.dlgState = null;
    s.resolve();
  }

  closeDialogue() {
    this.dlg?.destroy();
    this.dlg = null;
    this.dlgState = null;
  }

  async say(speaker: string, text: string, opts: SayOpts = {}) {
    const npc = NPC_BY_ID[speaker];
    const voice = opts.voice ?? (speaker === 'joseph' ? 'joseph' : npc?.voice ?? 'male');
    const t = await this.ensureBox(speaker, 'say', opts);
    G.state.history.push({ speaker: opts.name ?? SPEAKER_NAMES[speaker] ?? npc?.name ?? speaker, text, kind: 'say' });
    this.trimHistory();
    await this.run(text, voice, t);
  }

  async think(text: string) {
    const t = await this.ensureBox(null, 'think', {});
    G.state.history.push({ speaker: 'Joseph (iç ses)', text, kind: 'thought' });
    this.trimHistory();
    await this.run(text, 'joseph', t);
  }

  async system(text: string) {
    const t = await this.ensureBox(null, 'system', {});
    G.state.history.push({ speaker: 'Sistem', text, kind: 'system' });
    this.trimHistory();
    await this.run(text, 'system', t);
  }

  async narrate(text: string) {
    const t = await this.ensureBox(null, 'narrate', {});
    await this.run(text, 'none', t);
  }

  trimHistory() {
    if (G.state.history.length > 400) G.state.history.splice(0, G.state.history.length - 400);
  }

  choice(options: string[]): Promise<number> {
    return new Promise((resolve) => {
      const W = Display.uiW, H = Display.uiH;
      const bw = Math.min(560, W - 80);
      const startY = H - 200 - options.length * 66;
      this.choiceObjs = [];
      options.forEach((o, i) => {
        const b = new Button(this, W / 2, startY + i * 66, o, () => {
          for (const x of this.choiceObjs) x.destroy();
          this.choiceObjs = [];
          this.choiceResolve = null;
          G.state.history.push({ speaker: 'Joseph', text: '» ' + plainMoney(o), kind: 'choice' });
          resolve(i);
        }, { w: bw, h: 56, size: 19 });
        b.setDepth(110);
        b.setAlpha(0);
        this.tweens.add({ targets: b, alpha: 1, duration: 200, delay: i * 60 });
        this.choiceObjs.push(b);
      });
      this.choiceResolve = resolve;
    });
  }

  // ================================================================== Appraisal penceresi
  showAppraisal(c: any, npc: NpcDef | null) {
    this.appraisalWin?.destroy();
    const W = Display.uiW;
    const mine = G.p.skills.find((s) => s.id === 'appraisal')!.rank;
    const theirs = c.skills.find((s: any) => s.id === 'appraisal')?.rank ?? 0;
    const v = appraisalView(mine, theirs);
    const d = derive(c);
    const lines: [string, string][] = [];
    const Q = '???';
    lines.push(['İsim', v.identity ? c.name : Q]);
    lines.push(['Title', c.titles.length ? c.titles.map((t: string) => `${TITLES[t]?.name} (${TITLES[t]?.rank})`).join(', ') : 'Yok']);
    lines.push(['Irk', v.identity ? c.race : Q]);
    lines.push(['Cinsiyet', v.identity ? c.gender : Q]);
    lines.push(['Yaş', v.identity ? (c.age ?? '—') + '' : Q]);
    lines.push(['Lonca Rütbesi', v.identity ? (npc?.guildLabel ?? (c.guildRank !== null ? subRankToString(c.guildRank) : 'Yok')) : Q]);
    lines.push(['Level', v.identity ? String(c.level) : Q]);
    lines.push(['HP', v.stats ? `${npc ? d.maxHp : c.hp}/${d.maxHp}` : Q]);
    lines.push(['MP', v.stats ? `${d.maxMp}/${d.maxMp}` : Q]);
    lines.push(['Statlar', v.stats ? STAT_KEYS.map((k) => `${k} ${d.stats[k]}`).join(' · ') : Q]);
    const eq = EQUIP_SLOTS.filter((s) => c.equipment[s]).map((s) => itemLabel(c.equipment[s]));
    if (c.natural) eq.unshift(`${c.natural.name} [DMG: ${c.natural.dmg[0]}-${c.natural.dmg[1]}]`);
    lines.push(['Ekipman', v.stats ? (eq.length ? eq.join(', ') : 'Yok') : Q]);
    const sk = c.skills.map((s: any) => `${SKILLS[s.id]?.name ?? s.id} (${subRankToString(s.rank)})${v.skillExp ? ` [${Math.floor(s.exp)}/${skillThreshold(s.rank)}]` : ''}`);
    lines.push(['Skill', v.skills ? sk.join(', ') : Q]);
    const inv = Object.entries(c.inventory ?? {}).map(([k, q]) => `${ITEMS[k]?.name ?? k} ×${q}`);
    lines.push(['Envanter', v.skills ? (inv.length ? inv.join(', ') : 'Boş') : Q]);
    const w = 600;
    const cont = this.add.container(W / 2 - w / 2, 64).setDepth(60);
    const g = this.add.graphics();
    cont.add(g);
    cont.add(txt(this, w / 2, 14, '【 APPRAISAL 】', { size: 18, font: FONT.title, color: '#e6f6ff', bold: true }).setOrigin(0.5, 0));
    const diffTxt = v.diff >= 2 ? 'Hedef çok üstün: sadece Title okunabiliyor.' : v.diff === 1 ? 'Hedefin direnci senden bir harf yüksek.' : v.diff === 0 ? 'Rütbeleriniz eşit.' : v.diff === -1 ? 'Hedef senden bir harf düşük.' : 'Hedef seninle kıyaslanamayacak kadar düşük.';
    cont.add(txt(this, w / 2, 40, diffTxt, { size: 12, italic: true, color: '#9fc8ff' }).setOrigin(0.5, 0));
    let yy = 66;
    for (const [k, val] of lines) {
      cont.add(txt(this, 24, yy, k, { size: 15, bold: true, color: '#cfeaff' }));
      const vt = txt(this, 160, yy, val, { size: 15, color: val === Q ? '#6f8fb0' : COLORS.text, wrap: w - 180 });
      cont.add(vt);
      yy += Math.max(24, vt.height + 4);
    }
    const h = yy + 34;
    drawBlue(g, 0, 0, w, h, 0.86);
    cont.add(txt(this, w / 2, h - 26, 'Trait: görülemez', { size: 11, italic: true, color: '#6f8fb0' }).setOrigin(0.5, 0));
    const close = this.add.zone(0, 0, w, h).setOrigin(0, 0).setInteractive();
    close.on('pointerdown', () => this.closeAppraisal());
    cont.addAt(close, 0);
    cont.setAlpha(0);
    this.tweens.add({ targets: cont, alpha: 1, duration: 200 });
    this.appraisalWin = cont;
    this.time.delayedCall(7000, () => {
      if (this.appraisalWin === cont) this.closeAppraisal();
    });
  }

  closeAppraisal() {
    const c = this.appraisalWin;
    if (!c) return;
    this.appraisalWin = null;
    this.tweens.add({ targets: c, alpha: 0, duration: 200, onComplete: () => c.destroy() });
  }

  // ================================================================== menü ve ekranlar
  openMenu(tab?: string) {
    if (this.menuIsOpen || this.dialogueOpen() || this.world?.cutscene) return;
    this.menuIsOpen = true;
    this.world.paused = true;
    this.world.physics.pause();
    Input.clear();
    Sound.sfx('open');
    this.scene.launch('Menu', { tab });
    this.scene.bringToTop('Menu');
  }

  closeMenu() {
    if (this.scene.isActive('Menu')) this.scene.stop('Menu');
    this.menuIsOpen = false;
    this.world.paused = false;
    this.world.physics.resume();
    Sound.sfx('close');
    this.refreshButtons();
  }

  deathScreen(lostMoney: number, lostExp: number): Promise<void> {
    return new Promise((resolve) => {
      const W = Display.uiW, H = Display.uiH;
      const c = this.add.container(0, 0).setDepth(200);
      const bg = this.add.rectangle(0, 0, W, H, 0x000000, 1).setOrigin(0, 0);
      c.add(bg);
      const t = txt(this, W / 2, H / 2 - 60, 'Öldün.', { size: 56, font: FONT.title, color: '#c8323c', shadow: true }).setOrigin(0.5);
      const lines = [
        `Kaybedilen para (%10): ${lostMoney > 0 ? formatPrice(lostMoney) : 'yok'}`,
        `Bugün kazanılan EXP kaybedildi: ${lostExp}`,
        G.state.spawn.x ? 'Son uyuduğun yatakta uyanacaksın.' : 'Ormanda ilk uyandığın yerde gözlerini açacaksın.',
      ];
      const l = txt(this, W / 2, H / 2 + 20, lines.join('\n'), { size: 18, color: COLORS.textDim, align: 'center', lineSpacing: 8 }).setOrigin(0.5, 0);
      const hint = txt(this, W / 2, H - 70, 'Devam etmek için dokun', { size: 15, color: COLORS.textGold }).setOrigin(0.5);
      c.add([t, l, hint]);
      c.setAlpha(0);
      Sound.sfx('heartbeat');
      this.tweens.add({ targets: c, alpha: 1, duration: 800 });
      this.tweens.add({ targets: hint, alpha: 0.3, yoyo: true, repeat: -1, duration: 700 });
      this.time.delayedCall(1200, () => {
        const z = this.add.zone(0, 0, W, H).setOrigin(0, 0).setInteractive().setDepth(201);
        const done = () => {
          z.destroy();
          this.input.keyboard?.off('keydown', done);
          this.tweens.add({ targets: c, alpha: 0, duration: 500, onComplete: () => c.destroy() });
          resolve();
        };
        z.on('pointerdown', done);
        this.input.keyboard?.once('keydown', done);
      });
    });
  }

  /** Tam ekran siyah perde (sahneler için). */
  curtain(alpha: number, ms = 600): Promise<void> {
    return new Promise((resolve) => {
      if (!this.overlay) {
        const r = this.add.rectangle(0, 0, Display.uiW, Display.uiH, 0x000000, 1).setOrigin(0, 0);
        this.overlay = this.add.container(0, 0, [r]).setDepth(90).setAlpha(0);
      }
      this.children.bringToTop(this.overlay);
      if (this.dlg) this.children.bringToTop(this.dlg);
      this.tweens.add({ targets: this.overlay, alpha, duration: ms, onComplete: () => resolve() });
    });
  }

  overlayText(text: string, opts: { size?: number; y?: number; color?: string; font?: string } = {}): Phaser.GameObjects.Text {
    const t = txt(this, Display.uiW / 2, opts.y ?? Display.uiH / 2, text, { size: opts.size ?? 28, font: opts.font ?? FONT.body, color: opts.color ?? COLORS.text, align: 'center', wrap: Display.uiW - 160 }).setOrigin(0.5).setDepth(95);
    return t;
  }
}

function terrainColor(t: number, solid: number, indoor: boolean) {
  if (indoor) return solid ? '#3a2a1e' : '#8a6a4a';
  switch (t) {
    case TERRAIN.forest: return solid ? '#163a1c' : '#24502a';
    case TERRAIN.water: return '#2a6fa8';
    case TERRAIN.dirt: return '#a8854f';
    case TERRAIN.mud: return '#6b4a2a';
    case TERRAIN.sand: return '#d8c070';
    case TERRAIN.cobble: return '#8a8a96';
    case TERRAIN.farm: return '#7a5530';
    default: return solid ? '#2e6a2e' : '#4a8a3a';
  }
}
