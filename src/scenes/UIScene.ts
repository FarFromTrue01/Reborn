import Phaser from 'phaser';
import { hungerState, HUNGER_NAMES, SATIETY_MAX } from '../core/hunger';
import { isLowHp, HEARTBEAT_EVERY } from '../world/combatFx';
import { G } from '../game/G';
import { Display } from '../game/display';
import { Input, type Action } from '../game/input';
import { touchIntent } from '../game/touch';
import { Sound } from '../audio/audio';
import { COLORS, FONT, txt, drawFrame, drawBlue, drawBar, Button, uiIcon, rankBadge, fullScreenRect } from '../ui/kit';
import { QuestBox, PartyBars } from '../ui/hudQuests';
import { playQuestComplete, playRankUp, type QuestDoneInfo, type PromotionInfo } from '../ui/celebrations';
import { buildAppraisalPanel } from '../ui/appraisalPanel';
import { ToastStack } from '../ui/toastStack';
import { buildSysBox } from '../ui/sysBox';
import { sysDuration, sysPlacement } from '../ui/sysLayout';
import { SysFlow } from '../ui/sysFlow';
import { clockLabel, dateLabel } from '../core/time';
import { formatPrice } from '../core/money';
import { coinRow, richLine, plainMoney, hasMoneyTokens, richParagraph, type RichTyper } from '../ui/coins';
import { BUILDING_ICON, MINIMAP_BUILDINGS } from '../ui/mapIcons';
import { techniqueCost, techniqueCooldown } from '../core/skills';
import { ownerOf } from '../world/techniques';
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
import { itemLabel, fmtExp, fmtHp } from '../ui/format';
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

/** Sabit joystick tabanının yarıçapı (arayüz birimi). */
const JOY_FIXED_R = 76;

const SPEAKER_NAMES: Record<string, string> = { joseph: 'Joseph', system: 'Sistem' };

/** Sistem kuyruğu: mavi bildirim ya da kutlama sahnesi (aynı sırayla, üst üste binmeden). */
interface SysItem {
  title: string;
  lines: string[];
  sound?: string;
  big?: boolean;
  overlay?: 'quest' | 'rank';
  data?: QuestDoneInfo | PromotionInfo;
}

export class UIScene extends Phaser.Scene {
  hud!: Phaser.GameObjects.Container;
  hudG!: Phaser.GameObjects.Graphics;
  hudTexts: Record<string, Phaser.GameObjects.Text> = {};
  satIcon: Phaser.GameObjects.Image | null = null;
  minimap!: Phaser.GameObjects.Image;
  minimapTex!: Phaser.Textures.CanvasTexture;
  minimapT = 0;
  /** Mini haritadaki yan görev işaretleri (mavi ışık ve dalgalar): her kare çizilir, yalnızca işaret varken. */
  minimapMarks: Phaser.GameObjects.Graphics | null = null;
  /** Mini haritadaki simgeler (dükkânlar ve yan görev işaretleri); havuz, her çizimde yeniden yerleştirilir. */
  minimapIcons: Phaser.GameObjects.Container | null = null;
  /** Açık dükkân panelini kapatır (dükkân açıkken; QA ve geri tuşu için). */
  shopClose: (() => void) | null = null;
  /** Son mini harita çiziminin dönüşümü ve işaret noktaları (mini harita pikseli). */
  mmMarks: { x: number; y: number; kind: string; building: boolean }[] = [];
  touch!: Phaser.GameObjects.Container;
  touchButtons: Record<string, Button> = {};
  skillBtns: Button[] = [];
  divBtns: Button[] = [];
  cdOverlay!: Phaser.GameObjects.Graphics;
  joy: { id: number; bx: number; by: number; base: Phaser.GameObjects.Graphics; knob: Phaser.GameObjects.Graphics } | null = null;
  /** B1 (0.11.0): sol üst bildirimlerin düzeni ve ömrü (ui/toastStack). */
  toastStack = new ToastStack<Phaser.GameObjects.Container>();
  /** Sistem bildirimleri: tek kuyruk (kapanış sürerken yenisi başlamaz; 0.8.0). */
  sysFlow: SysFlow<SysItem, Phaser.GameObjects.Container> = this.makeSysFlow();
  /** Kuyrukta sırası gelmiş kutlama sahnesi (görev bitişi / terfi); kendi dokunuşlarını yönetir. */
  sysOverlay: { root: Phaser.GameObjects.Container; skip(): void } | null = null;
  dlg: Phaser.GameObjects.Container | null = null;
  dlgState: { full: string; shown: number; t: number; done: boolean; resolve: () => void; voice: string; pause: number; textObj: Phaser.GameObjects.Text; auto: number; rich?: RichTyper } | null = null;
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
  hudPanelH = 166;
  /** HUD'un alt kenarı (görev kutusu ve yoldaş çubukları dahil): bildirimler bunun altına dizilir. */
  hudBottom = 170;
  /** B2: sağ üst saat/bölge kutusunun sol kenarı (sistem bildirimi bu ikisinin arasına yerleşir). */
  hudClockX = 9999;
  questBox: QuestBox | null = null;
  partyBars: PartyBars | null = null;
  private rankKey = '';
  private rankBox: Phaser.GameObjects.Container | null = null;
  private questT = 0;
  damageFlash!: Phaser.GameObjects.Rectangle;
  edgeFlash: Phaser.GameObjects.Image | null = null;
  lowVignette: Phaser.GameObjects.Image | null = null;
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

  /**
   * Oturum durumunu sıfırla. UI sahnesi stop() + launch() ile yeniden kurulduğunda alanlar eski
   * değerini korur: "Ana Menüye Dön" sonrası menuIsOpen true kalınca HUD ve dokunmatik butonlar
   * bir daha görünmüyordu. Yeni alan eklerken buraya da ekle (tests/sceneState.test.ts denetler).
   */
  private resetState() {
    this.hud = undefined!;
    this.hudG = undefined!;
    this.hudTexts = {};
    this.minimap = undefined!;
    this.minimapTex = undefined!;
    this.minimapT = 0;
    this.minimapMarks = null;
    this.minimapIcons = null;
    this.shopClose = null;
    this.mmMarks = [];
    this.mmMarksDrawn = false;
    this.touch = undefined!;
    this.touchButtons = {};
    this.skillBtns = [];
    this.divBtns = [];
    this.cdOverlay = undefined!;
    this.joy = null;
    this.toastStack = new ToastStack();
    this.sysFlow = this.makeSysFlow();
    this.sysOverlay = null;
    this.dlg = null;
    this.dlgState = null;
    this.choiceResolve = null;
    this.choiceObjs = [];
    this.appraisalWin = null;
    this.contextLabel = null;
    this.contextKind = null;
    this.moneyRow = null;
    this.moneyKey = '';
    this.eatBtn = null;
    this.eatCount = null;
    this.joyFixed = null;
    this.hudPanelH = 166;
    this.satIcon = null;
    this.hudBottom = 170;
    this.hudClockX = 9999;
    this.questBox = null;
    this.partyBars = null;
    this.rankKey = '';
    this.rankBox = null;
    this.questT = 0;
    this.damageFlash = undefined!;
    this.edgeFlash = null;
    this.lowVignette = null;
    this.heartT = 0;
    this.zoneBanner = null;
    this.ghostHp = 1;
    this.fpsText = null;
    this.menuIsOpen = false;
    this.overlay = null;
    this.hideHud = false;
    this.isTouch = false;
    this.skillIds = [];
    this.divIds = [];
    // önceki oturumda basılı kalmış joystick / tuşlar
    Input.clear();
    Input.touchMove = false;
  }

  create() {
    this.resetState();
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
      // 0.9.0: menü açıkken sistem bildirimi menünün üstünde gösterilir (UI sahnesi menünün arkasında duraklatılmış)
      ['sysmsg', (m: any) => {
        const menu = this.scene.get('Menu') as any;
        if (this.menuIsOpen && this.scene.isActive('Menu') && menu?.showNotice) menu.showNotice(m);
        else this.queueSys(m);
      }],
      ['questdone', (q: QuestDoneInfo) => this.queueSys({ title: 'GÖREV TAMAMLANDI', lines: [], overlay: 'quest', data: q })],
      ['promotion', (p: PromotionInfo) => this.queueSys({ title: 'TERFİ', lines: [], overlay: 'rank', data: p })],
      ['stats', () => this.refreshButtons()],
      ['skills', () => this.refreshButtons()],
      ['settings', () => this.applySettings()],
      ['quests', () => this.questBox?.refresh(true)],
      ['think', (t: string) => this.thinkBubble(t)],
      ['saved', () => this.showSaved()],
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
    this.edgeFlash?.destroy();
    this.lowVignette?.destroy();
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
    // B3: Level ve rütbe ayrı kutucuklarda
    T('lvLabel', 0, 16, { size: 14, font: FONT.ui, bold: true, color: '#e8dcc0', stroke: true });
    T('lvNum', 0, 11, { size: 21, font: FONT.ui, bold: true, color: '#ffd75e', stroke: true });
    this.hudTexts.lvLabel.setText('Level:');
    this.rankKey = '';
    this.rankBox = null;
    T('hp', 28, 43, { size: 14, font: FONT.ui, bold: true, stroke: true });
    T('mp', 28, 67, { size: 12, font: FONT.ui, bold: true, stroke: true });
    T('st', 296, 84, { size: 11, font: FONT.ui, bold: true, stroke: true, color: '#cfeac0' }).setOrigin(1, 0);
    // B13: Tokluk (dayanıklılığın altında, ikon + bar; Aç/Çok aç renkli)
    T('sat', 296, 100, { size: 11, font: FONT.ui, bold: true, stroke: true, color: '#f3dc95' }).setOrigin(1, 0);
    this.satIcon = this.add.image(26, 106, 'uiicons', 'inv_food').setScale(15 / 72);
    this.hud.add(this.satIcon);
    T('exp', 296, 116, { size: 11, font: FONT.ui, bold: true, stroke: true, color: '#d8c8ff' }).setOrigin(1, 0);
    T('light', 28, 130, { size: 11, font: FONT.ui, bold: true, stroke: true, color: '#ffe9a0' });
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
    this.minimapMarks = this.add.graphics().setPosition(W - 178, 12);
    this.hud.add(this.minimapMarks);
    this.minimapIcons = this.add.container(W - 178, 12);
    this.hud.add(this.minimapIcons);
    const mf = this.add.graphics();
    drawFrame(mf, W - 180, 10, 164, 164, { alpha: 0, ornate: true });
    this.hud.add(mf);
    // menü ve appraisal butonları
    const menuB = new Button(this, W - 52, 216, '☰', () => this.openMenu(), { w: 60, h: 60, style: 'round', size: 26 });
    this.hud.add(menuB);
    const apB = new Button(this, W - 124, 216, '', () => { Input.press('appraise'); }, { w: 60, h: 60, style: 'round', icon: 'sk_appraisal' });
    this.hud.add(apB);
    // Görevler kutusu ve yoldaş HP çubukları (HP panelinin altında)
    this.questBox = new QuestBox(this, 8, 166);
    this.hud.add(this.questBox);
    this.questBox.refresh(true);
    this.partyBars = new PartyBars(this, 8, 200);
    this.hud.add(this.partyBars);
    this.buildTouch();
    // Bekleme ve parlama göstergeleri butonların ÜSTÜNDE çizilir
    this.cdOverlay = this.add.graphics().setDepth(21);
    this.damageFlash = fullScreenRect(this, 0xff0000, 0).setDepth(50);
    this.makeVignette('vignette_red');
    this.edgeFlash = this.add.image(Display.uiW / 2, Display.uiH / 2, 'vignette_red').setDisplaySize(Display.uiW, Display.uiH).setDepth(50).setAlpha(0);
    this.lowVignette = this.add.image(Display.uiW / 2, Display.uiH / 2, 'vignette_red').setDisplaySize(Display.uiW, Display.uiH).setDepth(49).setAlpha(0);
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
      if (key === 'heavy') {
        // A6: Ağır butonu basılı tutulur (şarj), bırakınca ağır saldırı çıkar
        b.removeAllListeners('pointerdown');
        b.on('pointerdown', () => {
          Sound.unlock();
          if (this.dialogueOpen()) {
            this.advanceDialogue();
            return;
          }
          Input.held.add('heavy');
          b.setScale(0.92);
        });
        const up = () => {
          Input.held.delete('heavy');
          b.setScale(1);
        };
        b.on('pointerup', up);
        b.on('pointerout', up);
        b.on('pointerupoutside', up);
      }
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
      base.fillCircle(0, 0, JOY_FIXED_R);
      base.lineStyle(2.5, COLORS.gold, 0.75);
      base.strokeCircle(0, 0, JOY_FIXED_R);
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
    this.tickToasts();
    const dt = dms / 1000;
    if (!this.hud) return;
    this.drawHud(dt);
    this.updateLowHp(dt);
    this.minimapT -= dt;
    if (this.minimapT <= 0) {
      this.minimapT = 0.25;
      this.drawMinimap(false);
    }
    this.drawMinimapMarks();
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
    const panelH = hasLight ? 184 : 166;
    this.hudPanelH = panelH;
    drawFrame(g, 8, 6, 300, panelH, { alpha: 0.8, ornate: false });
    this.hudTexts.name.setText('Joseph');
    // Level kutusu: "Level:" + farklı renkte, kalın sayı
    const lvX = 22 + this.hudTexts.name.width + 10;
    this.hudTexts.lvLabel.setPosition(lvX + 8, 15);
    this.hudTexts.lvNum.setText(String(p.level)).setPosition(lvX + 12 + this.hudTexts.lvLabel.width, 10);
    const lvW = this.hudTexts.lvLabel.width + this.hudTexts.lvNum.width + 22;
    g.fillStyle(0x3a2e1a, 0.92);
    g.fillRoundedRect(lvX, 11, lvW, 26, 6);
    g.lineStyle(1, COLORS.gold, 0.9);
    g.strokeRoundedRect(lvX, 11, lvW, 26, 6);
    // Rütbe kutusu: rozet + kademe
    const rkX = lvX + lvW + 6;
    const rk = p.guildRank !== null && G.state.guild.member ? srs(p.guildRank) : '';
    const rkKey = rk + ':' + rkX;
    if (rkKey !== this.rankKey) {
      this.rankKey = rkKey;
      this.rankBox?.destroy();
      const c = this.add.container(rkX, 11);
      if (rk) {
        c.add(rankBadge(this, 15, 13, p.guildRank!, 26));
        c.add(txt(this, 31, 4, rk, { size: 15, bold: true, font: FONT.title, color: COLORS.textGold, stroke: true }));
      } else c.add(txt(this, 8, 5, 'Rütbesiz', { size: 13, italic: true, color: COLORS.textDim, stroke: true }));
      this.rankBox = c;
      this.hud.add(c);
    }
    const rkW = rk ? 31 + rk.length * 11 + 10 : 76;
    g.fillStyle(0x1a1622, 0.92);
    g.fillRoundedRect(rkX, 11, rkW, 26, 6);
    g.lineStyle(1, rk ? COLORS.gold : COLORS.goldDark, 0.9);
    g.strokeRoundedRect(rkX, 11, rkW, 26, 6);
    const hpF = p.hp / d.maxHp;
    this.ghostHp = Math.max(hpF, this.ghostHp - dt * 0.5);
    drawBar(g, 20, 42, 276, 18, hpF, COLORS.hp, 0x180808, this.ghostHp);
    if (hpF < 0.3) {
      const pulse = 0.25 + Math.sin(this.time.now / 160) * 0.2;
      g.lineStyle(2, 0xff3020, pulse);
      g.strokeRect(19, 41, 278, 20);
    }
    this.hudTexts.hp.setText(`HP ${fmtHp(p.hp)} / ${fmtHp(d.maxHp)}`);
    drawBar(g, 20, 66, 276, 13, d.maxMp ? p.mp / d.maxMp : 0, COLORS.mp, 0x0a0f20);
    this.hudTexts.mp.setText(`MP ${Math.floor(p.mp)} / ${d.maxMp}`);
    drawBar(g, 20, 86, 186, 9, p.stamina / d.maxStamina, COLORS.st, 0x0a160a);
    this.hudTexts.st.setText(`Dayanıklılık ${Math.floor(p.stamina)}`);
    // B13: Tokluk
    const sat = G.state.satiety ?? 100;
    const hs = hungerState(sat);
    const satCol = hs === 'starving' ? 0xe04030 : hs === 'hungry' ? 0xf09030 : 0xd9b45a;
    drawBar(g, 36, 102, 170, 9, sat / SATIETY_MAX, satCol, 0x1a1206);
    if (hs !== 'normal') {
      const pulse = 0.35 + Math.sin(this.time.now / 220) * 0.25;
      g.lineStyle(1.5, satCol, pulse);
      g.strokeRect(35, 101, 172, 11);
    }
    this.hudTexts.sat.setText(hs === 'normal' ? `Tokluk ${Math.floor(sat)}` : `${HUNGER_NAMES[hs]}! ${Math.floor(sat)}`).setColor(hs === 'starving' ? '#ff8a7a' : hs === 'hungry' ? '#ffc070' : '#f3dc95');
    const need = expToNext(p.level);
    drawBar(g, 20, 118, 186, 9, p.exp / need, 0x9a6ae8, 0x140a20);
    this.hudTexts.exp.setText(`EXP ${fmtExp(p.exp)} / ${need}`);
    let y = 136;
    if (hasLight) {
      drawBar(g, 20, 136, 276, 9, G.state.divine.light / LIGHT_MAX, COLORS.light, 0x1a1404);
      this.hudTexts.light.setText(`Işık ${Math.floor(G.state.divine.light)}`).setPosition(28, 132);
      y = 154;
    } else this.hudTexts.light.setText('');
    // Para: simgelerle (yalnızca değişince yeniden çizilir)
    const key = JSON.stringify(p.wallet) + y;
    if (key !== this.moneyKey) {
      this.moneyKey = key;
      this.moneyRow?.destroy();
      this.moneyRow = coinRow(this, 22, y + 2 + 13, p.wallet, { size: 20, font: 17, stroke: true });
      this.hud.add(this.moneyRow);
    }
    // görev kutusu ve yoldaşlar
    if (this.questBox) {
      this.questBox.y = panelH + 12;
      this.questT -= dt;
      if (this.questT <= 0) {
        this.questT = 0.5;
        this.questBox.refresh();
      }
      let yb = this.questBox.y + this.questBox.boxH;
      const members = this.world?.partyStatus?.() ?? [];
      if (this.partyBars) {
        this.partyBars.y = yb + 6;
        this.partyBars.draw(members);
        if (members.length) yb = this.partyBars.y + this.partyBars.h;
      }
      if (Math.abs(yb - this.hudBottom) > 0.5) {
        this.hudBottom = yb;
        // A7.8c: görev kutusu büyüyünce/küçülünce bildirimler altına kayar (üst üste binmez).
        // B1: yalnızca konum — kaybolma animasyonuna ve alpha'ya dokunulmaz.
        this.relayoutToasts();
      }
    }
    // sağ üst: okunur saat, tarih ve bölge (arkasında koyu zemin)
    this.hudTexts.clock.setText(clockLabel(G.state.time));
    this.hudTexts.date.setText(dateLabel(G.state.time));
    // B7: iç mekânda kısa ad ("Maceracılar Loncası"); tam ad haritada ve girişteki bölge yazısında
    const md = this.world?.mapData;
    this.hudTexts.zone.setText(md?.indoor ? md.short ?? md.name : this.world?.zone?.name ?? md?.name ?? '');
    const tw = Math.max(this.hudTexts.date.width, this.hudTexts.zone.width, this.hudTexts.clock.width) + 24;
    g.fillStyle(0x0c0a12, 0.62);
    g.fillRoundedRect(W - 196 - tw + 8, 8, tw + 4, 88, 8);
    this.hudClockX = W - 196 - tw + 8;
    // bekleme süreleri
    const c = this.cdOverlay;
    c.clear();
    const w = this.world;
    if (!w?.player) return;
    this.skillBtns.forEach((b, i) => {
      const id = this.skillIds[i];
      if (!id || !b.visible) return;
      const cd = w.player.skillCd[id] ?? 0;
      const owner = ownerOf(id);
      const lacking = G.p.mp < techniqueCost(id, owner);
      if (cd > 0 || lacking) {
        c.fillStyle(0x000000, 0.55);
        c.slice(b.x, b.y, b.w / 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, cd > 0 ? cd / techniqueCooldown(id, owner) : 1), false);
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
    // B16: toplama noktaları ve yaratık bölgeleri (keşfedilmiş; bilinmiyorsa soluk sarı, tükenmişse gri)
    if (!m.indoor) {
      for (const mk of w.mapMarkerList?.() ?? []) {
        if (mk.kind === 'quest') continue;
        const x = ox + mk.x * scale, y = oy + mk.y * scale;
        if (x < 3 || y < 3 || x > S - 3 || y > S - 3) continue;
        ctx.fillStyle = mk.faded ? '#6a6658' : !mk.known ? '#d9c070' : mk.kind === 'spawn' ? '#ff7a5a' : '#7ad870';
        ctx.beginPath();
        ctx.arc(x, y, mk.kind === 'spawn' ? 2.6 : 2.1, 0, Math.PI * 2);
        ctx.fill();
        if (mk.kind === 'spawn' && !mk.faded) {
          ctx.strokeStyle = 'rgba(255,120,90,0.6)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
    // yan görev işaretleri (0.6.0): konumlar burada, ışık ve dalgalar her kare drawMinimapMarks'ta
    this.mmMarks = [];
    if (!m.indoor) {
      for (const s of w.sideMarkSpots?.() ?? []) {
        const x = ox + s.x * scale, y = oy + s.y * scale;
        if (x >= 4 && y >= 4 && x <= S - 4 && y <= S - 4) this.mmMarks.push({ x, y, kind: s.kind, building: !!s.building });
      }
    } else {
      for (const n of w.npcs) {
        const k = w.sideMarks?.[n.def.id];
        if (k && n.markerKind) this.mmMarks.push({ x: ox + (n.x / TILE) * scale, y: oy + (n.y / TILE) * scale, kind: k, building: false });
      }
    }
    this.placeMinimapIcons(m, fog, ox, oy, scale, S);
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

  /**
   * Mini haritadaki simgeler (0.9.0): dükkân/han/lonca simgeleri (büyük haritadaki gibi, keşfedilmişse) ve yan görev
   * işaretlerinin üstünde mavi ünlem/soru. Görüntüler havuzdan; mini haritanın dışında kalanlar gizlenir.
   */
  private placeMinimapIcons(m: any, fog: Uint8Array | number[], ox: number, oy: number, scale: number, S: number) {
    const box = this.minimapIcons;
    if (!box) return;
    const want: [string, number, number, number][] = [];
    if (!m.indoor) {
      const bmeta = this.cache.json.get('buildingsMeta');
      for (const b of m.buildings) {
        if (!MINIMAP_BUILDINGS.includes(b.id) || !bmeta?.[b.id]) continue;
        const bx = b.tx + bmeta[b.id].w / TILE / 2, by = b.tyBottom - 2;
        if (!fog[Math.floor(by) * m.w + Math.floor(bx)]) continue;
        want.push([BUILDING_ICON[b.id], ox + bx * scale, oy + by * scale, 15]);
      }
    }
    for (const mk of this.mmMarks) want.push([mk.kind === 'turnin' ? 'side_turnin' : 'side_quest', mk.x, mk.y - 9, 15]);
    const pool = box.list as Phaser.GameObjects.Image[];
    let n = 0;
    for (const [key, x, y, size] of want) {
      if (x < 6 || y < 6 || x > S - 6 || y > S - 6) continue;
      let im = pool[n];
      if (!im) {
        im = this.add.image(0, 0, 'uiicons', key);
        box.add(im);
      }
      im.setFrame(key).setPosition(x, y).setScale(size / 72).setVisible(true);
      n++;
    }
    for (let i = n; i < pool.length; i++) pool[i].setVisible(false);
  }

  /** Mavi parlayan nokta ve genişleyip sönen halkalar (yalnızca işaret varken; ekran dışı işaretler zaten atlandı). */
  private mmMarksDrawn = false;
  drawMinimapMarks() {
    const g = this.minimapMarks;
    if (!g) return;
    if (!this.mmMarks.length) {
      if (this.mmMarksDrawn) g.clear();
      this.mmMarksDrawn = false;
      return;
    }
    this.mmMarksDrawn = true;
    g.clear();
    const t = this.time.now / 1000;
    for (const mk of this.mmMarks) {
      const col = mk.kind === 'turnin' ? 0x9fdcff : 0x4aa8ff;
      for (let k = 0; k < 2; k++) {
        const ph = (t / 1.6 + k / 2) % 1;
        g.lineStyle(1.5, col, 0.85 * (1 - ph));
        g.strokeCircle(mk.x, mk.y, 3 + ph * (mk.building ? 13 : 10));
      }
      g.fillStyle(col, 0.35);
      g.fillCircle(mk.x, mk.y, mk.building ? 6 : 4.5);
      g.fillStyle(0xe6f6ff, 1);
      g.fillCircle(mk.x, mk.y, 2.2);
    }
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
    if (this.sysFlow.busy) this.dismissSys();
    if (this.menuIsOpen || this.world?.cutscene) return;
    const x = p.x / Display.uiZoom, y = p.y / Display.uiZoom;
    if (!p.wasTouch && !this.isTouch) return;
    // Önce hareket niyeti: sabit modda yalnızca joystick dairesi, serbest modda ekranın sol yarısı joystick'indir;
    // altında bir NPC olsa bile Appraisal açılmaz. Geri kalanda bir NPC'ye/canavara dokunmak Appraisal'dır.
    const intent = touchIntent({
      x, y, uiW: Display.uiW, joyActive: !!this.joy,
      fixed: this.joyFixed ? { x: this.joyFixed.x, y: this.joyFixed.y, r: JOY_FIXED_R * 1.25 } : null,
    });
    if (intent === 'world') {
      const target = this.world?.creatureAtScreen(p.x, p.y);
      if (target) this.world.tapAppraise(target);
      return;
    }
    if (this.joy) return; // joystick başka bir parmakta
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
      Input.touchX = 0;
      Input.touchY = 0;
    } else {
      const k = (len - dead) / (1 - dead) / Math.max(0.001, Math.hypot(dx, dy));
      Input.touchX = dx * k;
      Input.touchY = dy * k;
    }
    Input.moveX = Input.touchX;
    Input.moveY = Input.touchY;
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
      Input.touchX = 0;
      Input.touchY = 0;
      Input.touchMove = false;
    }
  }

  // ================================================================== bildirimler
  toast(text: string, kind = 'info', icon?: string) {
    const y0 = this.hudBottom + 10;
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
    this.tweens.add({ targets: c, alpha: 1, duration: 180, ease: 'Quad.Out' });
    for (const old of this.toastStack.add(c, performance.now())) old.destroy();
    this.relayoutToasts(c);
  }

  /** B1: bildirimleri HUD'un altına dizer — yalnızca x/y tween'i (önceki konum tween'i durur, kaybolma sürer). */
  private relayoutToasts(fresh?: Phaser.GameObjects.Container) {
    for (const { item, y } of this.toastStack.layout(this.hudBottom)) {
      const prev = item.getData('moveTween') as Phaser.Tweens.Tween | undefined;
      prev?.stop();
      const tw = this.tweens.add({ targets: item, y, x: 16, duration: item === fresh ? 180 : 150, ease: 'Quad.Out' });
      item.setData('moveTween', tw);
    }
  }

  /** B1: her bildirimin kendi ömrü — ömrü dolan kaybolur, kaybolması biten (ya da kesin sınırı aşan) yok edilir. */
  private tickToasts() {
    for (const a of this.toastStack.tick(performance.now())) {
      const c = a.item;
      if (a.kind === 'fade') this.tweens.add({ targets: c, alpha: 0, duration: 400 });
      else {
        (c.getData('moveTween') as Phaser.Tweens.Tween | undefined)?.stop();
        c.destroy();
      }
    }
  }

  get toasts(): Phaser.GameObjects.Container[] {
    return this.toastStack.items;
  }

  /** Kısa iç ses (ör. "Bu paraya şimdi dokunamam."): Joseph'in başının üstünde. */
  thinkBubble(text: string) {
    const w = this.world;
    if (w?.player) w.bubbleAt(w.player.actor, text, 2.6, true);
    else this.toast(text, 'warn');
  }

  /** C7: köşede kısa süre "Kaydedildi" simgesi. */
  showSaved() {
    const W = Display.uiW, H = Display.uiH;
    const c = this.add.container(W - 24, H - 22).setDepth(55);
    const t = txt(this, -34, 0, 'Kaydedildi', { size: 14, bold: true, color: COLORS.textGold, stroke: true }).setOrigin(1, 0.5);
    c.add([uiIcon(this, -14, 0, 'save', 24), t]);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 250, hold: 1400, yoyo: true, onComplete: () => c.destroy() });
  }

  toastInfo(text: string) {
    this.toast(text, 'info');
  }

  /** A7.8a: kontrol ipucu ekranın alt ortasında (görev panelinin üstüne binmez). */
  hintBottom(text: string, ms = 4500) {
    const W = Display.uiW, H = Display.uiH;
    const c = this.add.container(W / 2, H - 130).setDepth(40);
    const t = txt(this, 0, 0, text, { size: 16, bold: true, stroke: true, color: COLORS.text, align: 'center', wrap: Math.min(620, W - 60) }).setOrigin(0.5);
    const g = this.add.graphics();
    g.fillStyle(0x0c0a12, 0.8);
    g.fillRoundedRect(-t.width / 2 - 14, -t.height / 2 - 8, t.width + 28, t.height + 16, 8);
    g.lineStyle(1, COLORS.goldDark, 0.9);
    g.strokeRoundedRect(-t.width / 2 - 14, -t.height / 2 - 8, t.width + 28, t.height + 16, 8);
    c.add([g, t]);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 250, hold: ms, yoyo: true, onComplete: () => c.destroy() });
  }

  queueSys(m: SysItem) {
    this.sysFlow.push(m);
  }

  get sysShowing() {
    return this.sysFlow.current;
  }

  get sysQueue() {
    return this.sysFlow.queue;
  }

  makeSysFlow() {
    return new SysFlow<SysItem, Phaser.GameObjects.Container>({
      show: (m) => this.showSys(m),
      hide: (c, done) => {
        this.tweens.add({ targets: c, alpha: 0, y: c.y - 10, duration: 200, onComplete: () => { c.destroy(); done(); } });
      },
    });
  }

  private showSys(m: SysItem): Phaser.GameObjects.Container {
    this.sysOverlay = null;
    if (m.overlay && m.data) {
      // kutlama sahnesi: dokununca sona atlar, ikinci dokunuş (ya da kısa bekleme) kapatır
      const done = () => {
        if (this.sysOverlay !== ov) return;
        this.sysOverlay = null;
        this.sysFlow.finish(ov.root);
      };
      const ov = m.overlay === 'rank' ? playRankUp(this, m.data as PromotionInfo, done) : playQuestComplete(this, m.data as QuestDoneInfo, done);
      this.sysOverlay = ov;
      return ov.root;
    }
    Sound.sfx(m.sound ?? 'system', 0.8);
    // B2 (0.11.0): ölçülen satırlarla büyüyen kutu; sol üst panel ile sağ üst saat kutusunun arasında
    const W = Display.uiW;
    const w = Math.min(m.big ? 520 : 460, W - 40);
    const c = buildSysBox(this, { title: m.title, lines: m.lines, width: w });
    const pos = sysPlacement({
      W, boxW: w, leftEdge: 8 + 300 + 8, rightEdge: Math.min(this.hudClockX, W - 196), leftBottom: this.hudPanelH + 12, rightBottom: 100,
    });
    c.setPosition(pos.x, pos.y).setDepth(45);
    c.setAlpha(0).setScale(0.96, 0.6);
    this.tweens.add({ targets: c, alpha: 1, scaleY: 1, scaleX: 1, duration: 220, ease: 'Back.Out' });
    // gerçek zamanlı: oyun dünyası donsa da (menü) bildirim kapanır; yalnızca hâlâ ekrandaysa
    this.time.delayedCall(sysDuration(m.lines), () => this.sysFlow.dismiss(c));
    return c;
  }

  /** Kuyruk boşalınca (kutlama sahneleri ve bildirimler bitince) çözülür. Hikâye bunu bekleyip devam eder. */
  whenOverlaysIdle(maxMs = 20000): Promise<void> {
    return new Promise((resolve) => {
      const t0 = Date.now();
      const check = () => {
        if (!this.sys?.isActive() || (!this.sysOverlay && !this.sysFlow.queue.some((m) => m.overlay)) || Date.now() - t0 > maxMs) resolve();
        else setTimeout(check, 100);
      };
      check();
    });
  }

  dismissSys() {
    if (this.sysOverlay) return;
    this.sysFlow.dismiss();
  }

  showZone(name: string) {
    this.zoneBanner?.destroy();
    const W = Display.uiW;
    const c = this.add.container(W / 2, 200).setDepth(35);
    const t = txt(this, 0, 0, name, { size: 30, font: FONT.title, color: COLORS.textGold, stroke: true }).setOrigin(0.5);
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

  /** B23: ekran kenarının kızarması (alpha: aldığın hasarın can oranıyla). */
  flashDamage(alpha = 0.22) {
    this.tweens.killTweensOf(this.edgeFlash ?? this.damageFlash);
    if (this.edgeFlash) {
      this.edgeFlash.setAlpha(alpha * 1.6);
      this.tweens.add({ targets: this.edgeFlash, alpha: 0, duration: 380 });
    }
    this.damageFlash.setFillStyle(0xff0000, alpha * 0.35);
    this.tweens.add({ targets: this.damageFlash, fillAlpha: 0, duration: 300 });
  }

  /** B23: kenarları kırmızı bir vinyet dokusu (ortası saydam). */
  private makeVignette(key: string) {
    if (this.textures.exists(key)) return;
    const S = 256;
    const tex = this.textures.createCanvas(key, S, S)!;
    const ctx = tex.getContext();
    const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.28, S / 2, S / 2, S * 0.72);
    g.addColorStop(0, 'rgba(200,0,0,0)');
    g.addColorStop(1, 'rgba(200,0,0,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    tex.refresh();
  }

  /** B23: düşük canda (<%25) kalp atışı ve hafif kırmızı vinyet; her kare. */
  private heartT = 0;
  updateLowHp(dt: number) {
    if (!this.lowVignette) return;
    const p = G.p;
    const low = !!this.world?.player && isLowHp(p.hp, G.d.maxHp) && !this.world.cutscene;
    if (!low) {
      this.lowVignette.setAlpha(Math.max(0, this.lowVignette.alpha - dt * 2));
      this.heartT = 0;
      return;
    }
    this.heartT -= dt;
    if (this.heartT <= 0) {
      this.heartT = HEARTBEAT_EVERY;
      Sound.sfx('heartbeat', 0.5);
    }
    const beat = Math.max(0, 1 - (HEARTBEAT_EVERY - this.heartT) * 3);
    this.lowVignette.setAlpha(0.22 + 0.18 * beat);
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
      const layers = speaker === 'joseph' ? (this.world?.player?.actor.portraitKeys() ?? ['j_body', 'j_head']) : undefined;
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
      // isim plakası (B4): ad + lonca rütbe rozeti + meslek/tanım
      const name = opts.name ?? SPEAKER_NAMES[speaker] ?? npc?.name ?? speaker;
      const nt = txt(this, textX, y - 16, name, { size: 19, font: FONT.title, bold: true, color: COLORS.textGold });
      const ng = this.add.graphics();
      const parts: Phaser.GameObjects.GameObject[] = [];
      let px2 = textX + nt.width + 10;
      const rank = speaker === 'joseph' ? (G.state.guild.member ? G.p.guildRank : null) : npc?.creature.guildRank ?? null;
      if (rank !== null && rank !== undefined) {
        parts.push(rankBadge(this, px2 + 12, y - 6, rank, 26));
        const lab = npc?.guildLabel?.includes('emekli') ? `${srs(rank)} (emekli)` : srs(rank);
        const rt = txt(this, px2 + 28, y - 14, lab, { size: 14, bold: true, color: '#f3dc95' });
        parts.push(rt);
        px2 += 34 + rt.width;
      }
      const title = speaker === 'joseph' ? (G.state.guild.member ? 'Maceracı · Köksüz' : 'Köksüz') : npc?.title;
      if (title) {
        if (rank !== null && rank !== undefined) px2 += 4;
        const tt = txt(this, px2 + 4, y - 13, title, { size: 14, italic: true, color: '#cfc3a6' });
        parts.push(tt);
        px2 += tt.width + 8;
      }
      const pw2 = px2 - textX + 12;
      ng.fillStyle(0x16121f, 1);
      ng.fillRoundedRect(textX - 12, y - 22, pw2, 32, 6);
      ng.lineStyle(1.5, COLORS.gold, 1);
      ng.strokeRoundedRect(textX - 12, y - 22, pw2, 32, 6);
      if (parts.length) {
        ng.lineStyle(1, COLORS.goldDark, 1);
        ng.lineBetween(textX + nt.width + 5, y - 16, textX + nt.width + 5, y + 4);
      }
      c.add([ng, nt, ...parts]);
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
      // para işaretli replik ({m:30}): simgeli paragraf, aynı yazı makinesiyle
      let rich: RichTyper | undefined;
      if (hasMoneyTokens(text)) {
        const st = t.style;
        rich = richParagraph(this, t.x, t.y, text, { size: parseInt(String(st.fontSize)) || 21, color: String(st.color), font: st.fontFamily, italic: st.fontStyle?.includes('italic'), wrap: (t.style.wordWrapWidth as number) ?? 600, lineSpacing: t.lineSpacing });
        this.dlg?.add(rich.container);
        t.setVisible(false);
      }
      this.dlgState = { full: rich ? rich.plain : text, shown: 0, t: 0, done: false, resolve, voice, pause: 0, textObj: t, auto: 0, rich };
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
      if (s.rich) s.rich.show(s.shown);
      else s.textObj.setText(s.full.slice(0, s.shown));
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
      if (s.rich) s.rich.show(s.shown);
      else s.textObj.setText(s.full);
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
      options.forEach((raw, i) => {
        // "{i:anahtar}Metin": solda uiicons simgesi (ör. yan görev seçeneği: mavi ünlem + görevin adı)
        const im = /^\{i:([a-z_A-Z0-9]+)\}/.exec(raw);
        const o = im ? raw.slice(im[0].length) : raw;
        const b = new Button(this, W / 2, startY + i * 66, o, () => {
          for (const x of this.choiceObjs) x.destroy();
          this.choiceObjs = [];
          this.choiceResolve = null;
          G.state.history.push({ speaker: 'Joseph', text: '» ' + plainMoney(o), kind: 'choice' });
          resolve(i);
        }, { w: bw, h: 56, size: 19, textColor: im?.[1].startsWith('side_') ? '#bfe4ff' : undefined });
        if (im) b.add(uiIcon(this, -bw / 2 + 30, 0, im[1], 34));
        b.setDepth(110);
        b.setAlpha(0);
        this.tweens.add({ targets: b, alpha: 1, duration: 200, delay: i * 60 });
        this.choiceObjs.push(b);
      });
      this.choiceResolve = resolve;
    });
  }

  // ================================================================== Appraisal penceresi
  showAppraisal(c: any, npc: NpcDef | null, self = false) {
    this.appraisalWin?.destroy();
    const W = Display.uiW, H = Display.uiH;
    const mine = G.p.skills.find((s) => s.id === 'appraisal')!.rank;
    const root = this.add.container(0, 0).setDepth(60);
    // Ekranın herhangi bir yerine dokununca kapanır (B1). Otomatik kapanma yok.
    const shade = fullScreenRect(this, 0x000000, 0.35).setInteractive();
    shade.on('pointerdown', () => this.closeAppraisal());
    root.add(shade);
    const josephLayers = self ? this.world?.player?.actor.portraitKeys() : undefined;
    const panel = buildAppraisalPanel(this, c, npc, { self, mineRank: mine, dropMult: G.d.dropMult, josephLayers });
    const pw = (panel as any).panelW, ph = (panel as any).panelH;
    const sc = Math.min(1, (H - 30) / ph, (W - 30) / pw);
    panel.setScale(sc);
    panel.setPosition((W - pw * sc) / 2, Math.max(12, (H - ph * sc) / 2));
    const pz = this.add.zone(0, 0, pw, ph).setOrigin(0, 0).setInteractive();
    pz.on('pointerdown', () => this.closeAppraisal());
    panel.addAt(pz, 0);
    root.add(panel);
    root.setAlpha(0);
    this.tweens.add({ targets: root, alpha: 1, duration: 160 });
    this.appraisalWin = root;
    this.input.keyboard?.once('keydown', () => {
      if (this.appraisalWin === root) this.closeAppraisal();
    });
    // A4: Appraisal açıkken dünya durur (ara sahnelerde yönetmen kapatır, dünya akmaya devam eder)
    if (!this.world?.cutscene) this.world?.freeze('appraisal');
  }

  closeAppraisal() {
    const c = this.appraisalWin;
    this.world?.unfreeze('appraisal');
    if (!c) return;
    this.appraisalWin = null;
    this.tweens.add({ targets: c, alpha: 0, duration: 200, onComplete: () => c.destroy() });
  }

  // ================================================================== menü ve ekranlar
  openMenu(tab?: string) {
    if (this.menuIsOpen || this.dialogueOpen() || this.world?.cutscene) return;
    this.menuIsOpen = true;
    this.closeAppraisal();
    // A3/A4: menü opak; arkadaki World ve UI duraklatılır ve çizilmez (müzik sürer).
    this.world.freeze('menu');
    this.world.scene.setVisible(false);
    Input.clear();
    Sound.sfx('open');
    this.scene.launch('Menu', { tab });
    this.scene.bringToTop('Menu');
    this.scene.setVisible(false);
    this.scene.pause();
  }

  closeMenu() {
    if (this.scene.isActive('Menu')) this.scene.stop('Menu');
    this.menuIsOpen = false;
    this.scene.resume();
    this.scene.setVisible(true);
    this.world.scene.setVisible(true);
    this.world.unfreeze('menu');
    Sound.sfx('close');
    this.refreshButtons();
  }

  deathScreen(lostMoney: number, lostExp: number, lostLoot: { items: { id: string; qty: number }[]; money: number } = { items: [], money: 0 }): Promise<void> {
    return new Promise((resolve) => {
      const W = Display.uiW, H = Display.uiH;
      const c = this.add.container(0, 0).setDepth(200);
      const bg = fullScreenRect(this, 0x000000, 1);
      c.add(bg);
      const t = txt(this, W / 2, H / 2 - 60, 'Öldün.', { size: 56, font: FONT.title, color: '#c8323c', shadow: true }).setOrigin(0.5);
      const lootParts = [...lostLoot.items.map((i) => `${ITEMS[i.id]?.name ?? i.id} ×${i.qty}`), ...(lostLoot.money > 0 ? [formatPrice(lostLoot.money)] : [])];
      const lines = [
        ...(lootParts.length ? [`Savaşta kazanılan ganimet kaybedildi: ${lootParts.join(', ')}`] : []),
        `Kaybedilen para (%10): ${lostMoney > 0 ? formatPrice(lostMoney) : 'yok'}`,
        `Bugün kazanılan EXP kaybedildi: ${lostExp}`,
        G.state.spawn.x ? 'Son uyuduğun yatakta uyanacaksın.' : 'Ormanda ilk uyandığın yerde gözlerini açacaksın.',
      ];
      const l = txt(this, W / 2, H / 2 + 20, lines.join('\n'), { size: 18, color: COLORS.textDim, align: 'center', lineSpacing: 8, wrap: W - 160 }).setOrigin(0.5, 0);
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
        const r = fullScreenRect(this, 0x000000, 1);
        this.overlay = this.add.container(0, 0, [r]).setDepth(90).setAlpha(0);
      }
      this.children.bringToTop(this.overlay);
      if (this.dlg) this.children.bringToTop(this.dlg);
      this.tweens.add({ targets: this.overlay, alpha, duration: ms, onComplete: () => resolve() });
    });
  }

  overlayText(text: string, opts: { size?: number; y?: number; color?: string; font?: string } = {}): Phaser.GameObjects.Text {
    const t = txt(this, Display.uiW / 2, opts.y ?? Display.uiH / 2, text, { size: opts.size ?? 28, font: opts.font ?? FONT.body, color: opts.color ?? COLORS.text, align: 'center', wrap: Display.uiW - 160 }).setOrigin(0.5).setDepth(95);
    // ekran boyutu değişince ortada kalsın (0.8.0)
    const off = Display.onResize(() => {
      if (t.active && t.parentContainer === null) t.setPosition(Display.uiW / 2, opts.y ?? Display.uiH / 2);
    });
    t.once('destroy', off);
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
