import Phaser from 'phaser';
import { G } from '../game/G';
import { Display } from '../game/display';
import { Sound } from '../audio/audio';
import { COLORS, FONT, txt, drawFrame, drawBlue, Button, iconImage, uiIcon, rankBadge, itemRankBadge, fullScreenRect, fitText, RANK_BG, RARITY_FRAME } from '../ui/kit';
import { renderDevPanel } from '../ui/devPanel';
import { renderQuestsTab } from '../ui/questsTab';
import { BUILDING_ICON } from '../ui/mapIcons';
import { statParts, plusStack } from '../ui/statPlus';
import { sortItems, SORT_PREFS } from '../core/itemSort';
import { sortBar } from '../ui/sortBar';
import { fmtExp, fmtHp } from '../ui/format';
import { prestigeLabel, itemPrestige } from '../core/prestige';
import { pointsToNext, RANK_THRESHOLDS, levelRequirement, examRequired, guildBar } from '../core/guild';
import { daysLeft, CITY_NAMES } from '../core/cards';
import { ScrollList, panelChoice, confirmBox } from '../ui/panels';
import { buildSettings } from '../ui/settingsPanel';
import { itemLabel, itemEffectsText } from '../ui/format';
import { STAT_KEYS, expToNext, STAT_POINTS_PER_LEVEL, strDamageMult } from '../core/formulas';
import { subRankToString, subRankLetter, skillThreshold, SUBRANK_MAX } from '../core/ranks';
import { SKILLS, RARITY_NAMES, TECHNIQUES } from '../data/skills';
import { TITLES, TRAIT_NAMES } from '../data/titles';
import { ITEMS } from '../data/items';
import { EQUIP_SLOTS, EQUIP_SLOT_NAMES, type EquipSlot } from '../core/types';
import { equip, unequip, transact } from '../core/transactions';
import { coinRow, plainMoney } from '../ui/coins';
import { divineExpToNext, divineStat, DIVINE_STATS, DIVINE_STAT_NAMES } from '../core/divine';
import { DIVINE_BY_ID } from '../data/divine';
import { nextTier, rollOfferCards, OFFER_ODDS, OFFER_NAMES, OFFER_RARITIES, techniquesOf, ownedTechniques, sanitizeSlots, techniqueSource, techniqueCost, techniqueCooldown, techniquePower, SKILL_SLOTS_OPEN, SKILL_SLOTS_TOTAL, type OfferSp } from '../core/skills';
import * as R from '../game/rules';
import { SLOT_KEYS, slotInfo, type SlotKey } from '../core/save';
import type { UIScene } from './UIScene';
import { leaveGame } from '../game/sceneFlow';
import type { WorldScene } from './WorldScene';
import { getMap, fogOf, clearFogCache } from './WorldScene';
import { TERRAIN, TILE } from '../world/types';
import { VILLAGE_X0, BARRIER_X, WORLD_H } from '../world/worldgen';

/** Konuşmalar sekmesinin sayfa büyüklüğü (satır). */
const HISTORY_PAGE = 40;

type Tab = 'status' | 'inventory' | 'equipment' | 'quests' | 'map' | 'history' | 'settings' | 'save' | 'dev';
const TABS: [Tab, string, string][] = [
  ['status', 'Status', 'status'],
  ['inventory', 'Envanter', 'inventory'],
  ['equipment', 'Ekipman', 'equipment'],
  ['quests', 'Görevler', 'quests'],
  ['map', 'Harita', 'map'],
  ['history', 'Konuşmalar', 'history'],
  ['settings', 'Ayarlar', 'settings'],
  ['save', 'Kaydet / Yükle', 'save'],
  ['dev', 'Geliştirici', 'dev'],
];
const SECTIONS = ['all', 'status', 'stats', 'skills', 'traits', 'titles', 'equipment', 'inventory'] as const;
const SECTION_NAMES: Record<string, string> = { all: 'Tümü', status: 'Status', stats: 'Stats', skills: 'Skills', traits: 'Traits', titles: 'Titles', equipment: 'Equipment', inventory: 'Inventory' };
type InvCat = 'all' | 'equip' | 'food' | 'material' | 'other' | 'cards';
const INV_CATS: [InvCat, string, string][] = [['all', 'Tümü', 'inv_all'], ['equip', 'Ekipman', 'inv_equip'], ['food', 'Yiyecek', 'inv_food'], ['material', 'Malzeme', 'inv_material'], ['other', 'Diğer', 'inv_other'], ['cards', 'Giriş Kartları', 'inv_cards']];
const CAT_NAME: Record<string, string> = { weapon: 'Silah', armor: 'Zırh', food: 'Yiyecek', consumable: 'İksir / sarf', material: 'Malzeme', book: 'Kitap', quest: 'Görev eşyası', junk: 'Değersiz' };

export class MenuScene extends Phaser.Scene {
  tab: Tab = 'status';
  section: (typeof SECTIONS)[number] = 'all';
  content!: Phaser.GameObjects.Container;
  px = 0;
  py = 0;
  pw = 0;
  ph = 0;
  cx = 0;
  cw = 0;
  selItem: string | null = null;
  selSlot: EquipSlot | null = null;
  invCat: InvCat = 'all';
  selQuest: string | null = null;

  constructor() {
    super('Menu');
  }

  get ui() {
    return this.scene.get('UI') as UIScene;
  }
  get world() {
    return this.scene.get('World') as WorldScene;
  }

  init(data: { tab?: Tab }) {
    this.resetState();
    if (data.tab) this.tab = data.tab;
  }

  /**
   * Menü her açılışta yeniden kurulur ama sahne nesnesi aynı kalır: seçimler ve eski nesnelere
   * işaret eden alanlar burada sıfırlanır. Sekme (tab), Status bölümü ve envanter kategorisi
   * bilerek hatırlanır (oyuncu menüyü kapatıp açınca kaldığı yerden devam eder).
   */
  private resetState() {
    this.content = undefined!;
    this.px = this.py = this.pw = this.ph = this.cx = this.cw = 0;
    this.selItem = null;
    this.selSlot = null;
    this.selQuest = null;
    this.invIds = [];
    this.selFrame = null;
    this.invDetail = null;
    this.histShown = HISTORY_PAGE;
    this.viewKey = '';
    this.notices = [];
  }

  create() {
    this.cameras.main.setZoom(Display.uiZoom);
    this.cameras.main.setOrigin(0, 0);
    const W = Display.uiW, H = Display.uiH;
    fullScreenRect(this, 0x05040a, 1).setInteractive();
    this.pw = Math.min(1180, W - 24);
    this.ph = Math.min(690, H - 20);
    this.px = (W - this.pw) / 2;
    this.py = (H - this.ph) / 2;
    const g = this.add.graphics();
    drawFrame(g, this.px, this.py, this.pw, this.ph);
    // sekmeler
    const tw = 210;
    const tabs = TABS.filter(([t]) => t !== 'dev' || G.settings.devMode);
    if (this.tab === 'dev' && !G.settings.devMode) this.tab = 'status';
    const step = Math.min(66, (this.ph - 140) / tabs.length);
    tabs.forEach(([t, label, icon], i) => {
      const b = new Button(this, this.px + 22 + tw / 2, this.py + 52 + i * step, '   ' + label, () => {
        this.tab = t;
        this.selItem = null;
        this.selSlot = null;
        this.selQuest = null;
        this.histShown = HISTORY_PAGE;
        this.render();
      }, { w: tw, h: step - 8, size: 17 });
      b.add(uiIcon(this, -tw / 2 + 26, 0, icon, 26));
      b.setName('tab_' + t);
    });
    new Button(this, this.px + 22 + tw / 2, this.py + this.ph - 46, 'Oyuna Dön', () => this.close(), { w: tw, h: 52, size: 18, textColor: COLORS.textGold });
    this.cx = this.px + tw + 50;
    this.cw = this.pw - tw - 74;
    this.content = this.add.container(this.cx, this.py + 24);
    this.input.keyboard?.on('keydown-ESC', () => this.close());
    this.input.keyboard?.on('keydown-TAB', (e: KeyboardEvent) => { e.preventDefault(); this.close(); });
    this.render();
  }

  close() {
    this.scene.stop();
    this.ui.closeMenu();
    // Grafik kalitesi çözünürlüğü belirler: canvas yeniden boyutlanır, sahneler yeniden kurulur
    Display.applyQuality(G.settings.quality);
    if (Math.abs(Display.uiScaleSetting - G.settings.uiScale) > 0.001) this.ui.applySettings();
  }

  /** Son çizimin anahtarı (sekme + bölüm + kategori): aynı görünüm yeniden çizilirken kaydırma korunur. */
  private viewKey = '';

  /** İçerikteki kaydırma listeleri (çizim sırasıyla). */
  private scrollLists(): ScrollList[] {
    const out: ScrollList[] = [];
    const walk = (list: Phaser.GameObjects.GameObject[]) => {
      for (const o of list) {
        if (o instanceof ScrollList) out.push(o);
        else if (o instanceof Phaser.GameObjects.Container) walk(o.list);
      }
    };
    if (this.content) walk(this.content.list);
    return out;
  }

  /**
   * 0.9.0 (madde 12): stat puanı verince, eşya/görev seçince vb. menü yeniden çizilir; aynı görünümdeyken
   * listelerin kaydırma konumu korunur (eskiden en üste atlıyordu). Sekme/bölüm değişince baştan açılır.
   */
  render() {
    const key = `${this.tab}:${this.section}:${this.invCat}`;
    const keep = key === this.viewKey ? this.scrollLists().map((l) => l.scrollY) : null;
    this.viewKey = key;
    this.renderView();
    if (keep && this.tab !== 'history') this.scrollLists().forEach((l, i) => keep[i] !== undefined && l.setScroll(keep[i]));
  }

  private renderView() {
    for (const [t] of TABS) {
      const b = this.children.getByName('tab_' + t) as Button;
      if (b) b.setAlpha(t === this.tab ? 1 : 0.62);
    }
    this.content.removeAll(true);
    this.invDetail = null;
    this.selFrame = null;
    switch (this.tab) {
      case 'status': return this.renderStatus();
      case 'inventory': return this.renderInventory();
      case 'equipment': return this.renderEquipment();
      case 'map': return this.renderMap();
      case 'history': return this.renderHistory();
      case 'settings': return void buildSettings(this, this.content, this.cw, this.ph - 48);
      case 'save': return this.renderSave();
      case 'quests': return this.renderQuests();
      case 'dev': return renderDevPanel(this, this.content, this.cw, this.ph - 48);
    }
  }

  // ================================================================ ortak çizim yardımcıları
  /** Çerçeveli kart: başlık şeridi + gövde. Gövdenin başladığı y'yi döndürür. */
  card(parent: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number, title: string, style: 'blue' | 'gold' | 'divine' = 'blue', right?: string, icon?: string) {
    const g = this.add.graphics();
    const edge = style === 'blue' ? 0x7cc8ff : style === 'gold' ? COLORS.gold : 0xffd56a;
    const fill = style === 'blue' ? 0x0c2148 : style === 'gold' ? 0x1c1626 : 0x2a2008;
    g.fillStyle(0x000000, 0.3);
    g.fillRoundedRect(x + 2, y + 4, w, h, 10);
    g.fillStyle(fill, 0.92);
    g.fillRoundedRect(x, y, w, h, 10);
    g.fillStyle(edge, style === 'divine' ? 0.22 : 0.16);
    g.fillRoundedRect(x, y, w, 34, { tl: 10, tr: 10, bl: 0, br: 0 });
    g.lineStyle(style === 'divine' ? 2.5 : 1.5, edge, 0.9);
    g.strokeRoundedRect(x, y, w, h, 10);
    if (style === 'divine') {
      g.lineStyle(1, 0xfff0b0, 0.5);
      g.strokeRoundedRect(x + 4, y + 4, w - 8, h - 8, 8);
    }
    parent.add(g);
    if (icon) parent.add(uiIcon(this, x + 26, y + 17, icon, 24));
    parent.add(txt(this, x + (icon ? 44 : 14), y + 7, title, { size: 17, bold: true, font: FONT.title, color: style === 'blue' ? '#e6f6ff' : '#ffe9a0' }));
    if (right) parent.add(txt(this, x + w - 14, y + 9, right, { size: 14, bold: true, color: style === 'blue' ? '#bfe4ff' : '#f3dc95' }).setOrigin(1, 0));
    return y + 44;
  }

  /** Yatay ilerleme çubuğu + etiket. */
  progress(parent: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number, frac: number, color: number, label: string, labelColor = '#ffffff') {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.5);
    g.fillRoundedRect(x, y, w, h, h / 2);
    g.fillStyle(color, 1);
    if (frac > 0) g.fillRoundedRect(x, y, Math.max(h, w * Math.min(1, frac)), h, h / 2);
    g.fillStyle(0xffffff, 0.18);
    if (frac > 0) g.fillRect(x + 3, y + 1, Math.max(0, w * Math.min(1, frac) - 6), Math.max(1, h * 0.3));
    parent.add(g);
    if (label) parent.add(txt(this, x + 8, y + h / 2, label, { size: Math.max(11, Math.min(14, h - 2)), bold: true, stroke: true, color: labelColor }).setOrigin(0, 0.5));
  }

  chip(parent: Phaser.GameObjects.Container, x: number, y: number, text: string, color = 0x3a2e1a, textColor = '#fff2c0') {
    const t = txt(this, x + 8, y + 3, text, { size: 13, bold: true, color: textColor });
    const g = this.add.graphics();
    g.fillStyle(color, 0.95);
    g.fillRoundedRect(x, y, t.width + 16, 22, 11);
    g.lineStyle(1, 0xffffff, 0.15);
    g.strokeRoundedRect(x, y, t.width + 16, 22, 11);
    parent.add([g, t]);
    return x + t.width + 22;
  }

  /** Joseph'in o anki görünümü (giysi katmanlarıyla). */
  josephSprite(parent: Phaser.GameObjects.Container, x: number, y: number, scale: number) {
    const keys: string[] = this.world?.player?.actor?.portraitKeys() ?? ['j_body', 'j_head'];
    const c = this.add.container(x, y);
    c.add(this.add.ellipse(0, 0, 40, 10, 0x000000, 0.35));
    for (const k of keys) if (this.textures.exists(k)) c.add(this.add.sprite(0, 0, k, 130).setOrigin(0.5, 61 / 64));
    c.setScale(scale);
    parent.add(c);
    return c;
  }

  // ================================================================ STATUS
  renderStatus() {
    const c = this.content;
    const w = this.cw, h = this.ph - 48;
    // bölüm sekmeleri
    let bx = 0;
    for (const s of SECTIONS) {
      const label = SECTION_NAMES[s];
      const bw = label.length * 9 + 28;
      const b = new Button(this, bx + bw / 2, 22, label, () => {
        this.section = s;
        this.render();
      }, { w: bw, h: 40, size: 14, style: 'blue' });
      b.setAlpha(this.section === s ? 1 : 0.5);
      c.add(b);
      bx += bw + 6;
    }
    const list = new ScrollList(this, 0, 52, w, h - 58);
    c.add(list);
    list.updateMask();
    const inner = list.inner;
    const W = w - 14;
    let y = 0;
    const p = G.p, d = G.d, dv = G.state.divine;
    const show = (s: string) => this.section === 'all' || this.section === s;
    const gap = 14;

    // ---------------------------------------------------------- STATUS kartı
    if (show('status')) {
      const ch = 196;
      const by = this.card(inner, 0, y, W, ch, 'STATUS', 'blue', 'Elonth Sistemi', 'status');
      const pg = this.add.graphics();
      pg.fillStyle(0x061230, 1);
      pg.fillRoundedRect(14, by, 110, 138, 8);
      pg.lineStyle(1, 0x7cc8ff, 0.6);
      pg.strokeRoundedRect(14, by, 110, 138, 8);
      inner.add(pg);
      this.josephSprite(inner, 69, by + 128, 2);
      const x0 = 142;
      inner.add(txt(this, x0, by - 2, 'Joseph', { size: 26, bold: true, font: FONT.title, color: '#ffffff' }));
      inner.add(txt(this, x0 + 120, by + 7, 'İnsan · Erkek · 18 yaş', { size: 14, color: '#9fc8ff' }));
      let cx = x0;
      cx = this.chip(inner, cx, by + 36, `Level ${p.level}`, 0x2a4a8a);
      const member = G.state.guild.member && p.guildRank !== null;
      if (member) inner.add(rankBadge(this, cx + 12, by + 47, p.guildRank!, 24));
      cx = this.chip(inner, cx + (member ? 26 : 0), by + 36, `Rütbe: ${member ? subRankToString(p.guildRank!) : 'Yok'}`, 0x3a2e1a);
      cx = this.chip(inner, cx, by + 36, 'Kast: Köksüz', 0x4a2020, '#ffd0c0');
      inner.add(uiIcon(this, cx + 12, by + 47, 'prestige', 22));
      cx = this.chip(inner, cx + 26, by + 36, `Saygınlık ${prestigeLabel(R.josephPrestige())}`, 0x4a3a10, '#ffe9a0');
      const bw = W - x0 - 20;
      const half = (bw - 12) / 2;
      this.progress(inner, x0, by + 68, half, 20, p.hp / d.maxHp, COLORS.hp, `HP ${fmtHp(p.hp)} / ${fmtHp(d.maxHp)}`);
      this.progress(inner, x0 + half + 12, by + 68, half, 20, d.maxMp ? p.mp / d.maxMp : 0, COLORS.mp, `MP ${Math.floor(p.mp)} / ${d.maxMp}`);
      this.progress(inner, x0, by + 94, half, 16, p.stamina / d.maxStamina, COLORS.st, `Dayanıklılık ${Math.floor(p.stamina)} / ${d.maxStamina}`);
      const need = expToNext(p.level);
      this.progress(inner, x0 + half + 12, by + 94, half, 16, p.exp / need, 0x9a6ae8, `EXP ${fmtExp(p.exp)} / ${need}`);
      inner.add(uiIcon(this, x0 + 10, by + 131, 'money', 20));
      inner.add(txt(this, x0 + 24, by + 122, 'Para', { size: 14, bold: true, color: '#cfeaff' }));
      inner.add(coinRow(this, x0 + 72, by + 131, p.wallet, { size: 20, font: 17 }));
      y += ch + gap;
      // Lonca kartı (C3/B6): rütbe, Lonca Puanı ve bir sonraki rütbeye ilerleme barı (sonunda hedef rozet)
      const gs = G.state.guild;
      const lh = 124;
      const lb = this.card(inner, 0, y, W, lh, 'LONCA KARTI', 'gold', gs.member ? 'Maceracılar Loncası — Brindlewood Şubesi' : 'Kayıtlı değil', 'card');
      if (gs.member && p.guildRank !== null) {
        const cur = p.guildRank;
        inner.add(rankBadge(this, 52, lb + 30, cur, 56, true));
        inner.add(txt(this, 92, lb + 4, subRankToString(cur), { size: 30, bold: true, font: FONT.title, color: COLORS.textGold }));
        const nxt = pointsToNext(gs.points, cur);
        const bx = 190, bw = W - bx - 84;
        inner.add(uiIcon(this, bx + 10, lb + 10, 'points', 22));
        inner.add(txt(this, bx + 26, lb, `Lonca Puanı: ${gs.points}`, { size: 17, bold: true, color: '#ffffff' }));
        if (nxt === null) {
          this.progress(inner, bx, lb + 30, bw, 20, 1, COLORS.gold, 'En yüksek rütbe', '#2a1a00');
        } else {
          const { lo, hi: hi0, frac } = guildBar(gs.points, cur);
          const hi = hi0 ?? lo;
          const lvNeed = levelRequirement(cur + 1);
          const note = nxt > 0 ? `${nxt} puan kaldı` : examRequired(cur + 1) ? 'Terfi sınavla' : p.level < lvNeed ? `Level ${lvNeed} gerekir` : 'Terfi hazır: Celeste\'yle konuş';
          inner.add(txt(this, bx + bw, lb + 2, note, { size: 14, bold: true, color: nxt > 0 ? '#d8c890' : '#9fe08a' }).setOrigin(1, 0));
          this.progress(inner, bx, lb + 30, bw, 20, frac, COLORS.gold, `${gs.points - lo} / ${hi - lo}`, '#ffffff');
          // hedef: bir sonraki rütbenin rozeti
          const tg = this.add.graphics();
          tg.lineStyle(1.5, COLORS.goldDark, 1);
          tg.lineBetween(bx + bw + 4, lb + 40, bx + bw + 22, lb + 40);
          inner.add(tg);
          inner.add(rankBadge(this, bx + bw + 46, lb + 40, cur + 1, 44, true));
          inner.add(txt(this, bx + bw + 46, lb + 64, subRankToString(cur + 1), { size: 12, bold: true, color: COLORS.textGold }).setOrigin(0.5, 0));
        }
        if (gs.debt) {
          inner.add(uiIcon(this, bx + 10, lb + 66, 'debt', 18));
          inner.add(txt(this, bx + 24, lb + 58, `Loncaya borç: ${gs.debt} bronz`, { size: 14, bold: true, color: COLORS.textRed }));
        }
      } else inner.add(txt(this, 20, lb + 4, gs.revoked ? 'Kartın alındı. Yeniden kayıt 1 gümüş; G-\'den ve 0 puandan başlarsın.' : 'Maceracılar Loncası\'na kayıt bir gümüş.', { size: 15, color: COLORS.textDim, wrap: W - 40 }));
      y += lh + gap;
    }

    // ---------------------------------------------------------- STATS kartı
    if (show('stats')) {
      const rowH = 54;
      const ch = 44 + 34 + STAT_KEYS.length * rowH + 44;
      const by = this.card(inner, 0, y, W, ch, 'STATS', 'blue', `Dağıtılmamış: ${p.unspent}  ·  SP: ${p.sp}`, 'stats');
      let cx = 14;
      cx = this.chip(inner, cx, by, `Fiziksel hasar ×${strDamageMult(d.stats.STR).toFixed(2)}`, 0x1a3a6a, '#dff0ff');
      cx = this.chip(inner, cx, by, `Kritik %${(d.crit * 100).toFixed(1)}`, 0x1a3a6a, '#dff0ff');
      cx = this.chip(inner, cx, by, `Hareket ×${d.moveSpeed.toFixed(2)}`, 0x1a3a6a, '#dff0ff');
      cx = this.chip(inner, cx, by, `Saldırı hızı ×${d.attackSpeed.toFixed(2)}`, 0x1a3a6a, '#dff0ff');
      this.chip(inner, cx, by, `DEF ${d.def}`, 0x1a3a6a, '#dff0ff');
      let ry = by + 34;
      const src = d.statSources;
      for (const k of STAT_KEYS) {
        const g = this.add.graphics();
        g.fillStyle(0x061230, 0.85);
        g.fillRoundedRect(14, ry, W - 28, rowH - 8, 8);
        g.lineStyle(1, 0x3d8bdb, 0.5);
        g.strokeRoundedRect(14, ry, W - 28, rowH - 8, 8);
        inner.add(g);
        inner.add(txt(this, 28, ry + 7, k, { size: 20, bold: true, font: FONT.title, color: '#e6f6ff' }));
        // 0.9.0: solda temel stat, sağında üst üste renkli artılar (yeşil ekipman, sarı unvan, mor skill)
        const { base, plus } = statParts(src, k);
        const bt = txt(this, 92, ry + (rowH - 8) / 2, String(base), { size: 24, bold: true, color: '#ffffff' }).setOrigin(0, 0.5);
        inner.add(bt);
        inner.add(plusStack(this, bt.x + bt.width + 5, ry + (rowH - 8) / 2, rowH - 10, plus, 14));
        inner.add(txt(this, 176, ry + 4, `Toplam ${d.stats[k]}`, { size: 13, color: '#9fd6ff', bold: true }));
        inner.add(txt(this, 176, ry + 23, statHint(k), { size: 13, color: '#6f9fcf', italic: true, wrap: W - 290 }));
        if (p.unspent > 0) {
          const b = new Button(this, W - 50, ry + (rowH - 8) / 2, '+', () => {
            R.allocateStat(k);
            Sound.sfx('click');
            this.render();
          }, { w: 52, h: 40, size: 24, style: 'blue' });
          inner.add(b);
        }
        ry += rowH;
      }
      inner.add(txt(this, 14, ry + 4, p.unspent > 0 ? `Level atladıkça ${STAT_POINTS_PER_LEVEL} stat puanı kazanırsın. ${p.unspent} puan dağıtılmayı bekliyor.` : `Stat puanları level atlayınca gelir (her level +${STAT_POINTS_PER_LEVEL}).`, { size: 13, italic: true, color: p.unspent ? '#ffe9a0' : '#6f9fcf' }));
      y += ch + gap;
    }

    // ---------------------------------------------------------- SKILLS (0.9.0: nadirlik çerçevesi, rütbe arka planı, slotlar)
    if (show('skills')) {
      const owned = ownedTechniques(p.skills);
      const slots = sanitizeSlots(G.state.skillSlots, owned);
      const inFight = !!(this.world?.inBattle || this.world?.player?.inCombat);
      const techRows = (s: any) => techniquesOf(s).length;
      const cardH = (s: any) => 92 + techRows(s) * 44;
      const slotH = 112;
      const ch = 44 + slotH + 10 + p.skills.reduce((a: number, s: any) => a + cardH(s) + 8, 0) + (p.sp > 0 ? 60 : 4);
      const by = this.card(inner, 0, y, W, ch, 'SKILLS', 'blue', `${p.skills.length} skill`, 'skills');
      // --- yetenek slotları: 1. açık, 2. kilitli "Yakında"
      inner.add(txt(this, 18, by - 4, 'YETENEK SLOTLARI', { size: 13, bold: true, font: FONT.title, color: '#bfe4ff' }));
      inner.add(txt(this, W - 18, by - 4, inFight ? 'Savaşta yetenek değiştirilemez.' : 'Yalnızca takılı yetenek kullanılır · pasifler her zaman açık', { size: 12, italic: true, color: inFight ? COLORS.textRed : '#6f9fcf' }).setOrigin(1, 0));
      const sw = (W - 28 - 10) / 2;
      for (let i = 0; i < SKILL_SLOTS_TOTAL; i++) {
        const sx = 14 + i * (sw + 10), sy = by + 20;
        const g = this.add.graphics();
        const locked = i >= SKILL_SLOTS_OPEN;
        g.fillStyle(locked ? 0x10182a : 0x0a1a3a, 0.95);
        g.fillRoundedRect(sx, sy, sw, 80, 8);
        g.lineStyle(1.5, locked ? 0x3a4a66 : 0x7cc8ff, 0.9);
        g.strokeRoundedRect(sx, sy, sw, 80, 8);
        inner.add(g);
        inner.add(txt(this, sx + 12, sy + 6, `Slot ${i + 1}`, { size: 12, bold: true, color: locked ? '#5a6a88' : '#9fd6ff' }));
        if (locked) {
          inner.add(uiIcon(this, sx + sw / 2 - 52, sy + 44, 'lock', 26));
          inner.add(txt(this, sx + sw / 2 - 30, sy + 30, 'Yakında', { size: 22, bold: true, font: FONT.title, color: '#7a8aa8' }));
          continue;
        }
        const t = slots[i] ? TECHNIQUES[slots[i]!] : null;
        if (!t) {
          inner.add(txt(this, sx + 14, sy + 32, owned.length ? 'Boş — aşağıdan bir yetenek tak.' : 'Boş — henüz aktif yeteneğin yok.', { size: 15, italic: true, color: '#8fa8c8' }));
          continue;
        }
        const src = techniqueSource(t.id);
        const owner = src ? p.skills.find((x: any) => x.id === src.skill) ?? null : null;
        inner.add(iconImage(this, sx + 32, sy + 46, SKILLS[src?.skill ?? '']?.icon ?? 'stone', 34));
        inner.add(txt(this, sx + 58, sy + 24, t.name, { size: 18, bold: true, color: '#ffffff' }));
        inner.add(txt(this, sx + 58, sy + 50, `MP ${techniqueCost(t.id, owner)} · Bekleme ${techniqueCooldown(t.id, owner)} sn · Güç ×${techniquePower(owner?.rank ?? 0).toFixed(2)}`, { size: 13, color: '#9fd6ff' }));
      }
      let ry = by + slotH + 10;
      for (const s of p.skills) {
        const def = SKILLS[s.id];
        const L = subRankLetter(s.rank);
        const hgt = cardH(s);
        const g = this.add.graphics();
        // arka plan rütbe rengi (G → X), çerçeve nadirlik rengi
        g.fillStyle(RANK_BG[L], 0.9);
        g.fillRoundedRect(14, ry, W - 28, hgt, 8);
        g.fillStyle(0x061230, 0.55);
        g.fillRoundedRect(14, ry, W - 28, hgt, 8);
        g.lineStyle(2.5, RARITY_FRAME[def.rarity], 1);
        g.strokeRoundedRect(14, ry, W - 28, hgt, 8);
        g.fillStyle(0x000000, 0.4);
        g.fillRoundedRect(24, ry + 12, 56, 56, 8);
        inner.add(g);
        inner.add(iconImage(this, 52, ry + 40, def.icon, 46));
        inner.add(txt(this, 94, ry + 8, def.name, { size: 19, bold: true, color: '#ffffff' }));
        const nameW = 94 + txt(this, 0, -999, def.name, { size: 19, bold: true }).setVisible(false).width + 10;
        let cx = this.chip(inner, nameW, ry + 9, subRankToString(s.rank), RANK_BG[L]);
        this.chip(inner, cx, ry + 9, RARITY_NAMES[def.rarity], def.rarity === 'legendary' ? 0x5a4410 : def.rarity === 'epic' ? 0x4a2470 : def.rarity === 'rare' ? 0x1a3a70 : 0x3a3a44);
        const max = s.rank >= SUBRANK_MAX;
        const th = skillThreshold(s.rank);
        this.progress(inner, 94, ry + 38, Math.min(300, W - 140), 14, max ? 1 : s.exp / th, max ? 0xffd040 : 0x3ab8e0, max ? 'MAX' : `${fmtExp(s.exp)} / ${th}`);
        inner.add(txt(this, 94, ry + 60, def.desc, { size: 13, color: '#9fc8ff', wrap: W - 130 }));
        const nt = nextTier(s);
        if (nt && W > 600) inner.add(txt(this, W - 24, ry + 38, `Sonraki (${nt.at}): ${nt.note}`, { size: 12, italic: true, color: '#8fb8e8', wrap: W - 440, align: 'right' }).setOrigin(1, 0));
        // aktif yetenekler: tak / çıkar (yalnızca savaş dışında)
        let ty = ry + 86;
        for (const tid of techniquesOf(s)) {
          const t = TECHNIQUES[tid];
          const on = slots.includes(tid);
          const tg = this.add.graphics();
          tg.fillStyle(on ? 0x16305e : 0x0a1530, 0.95);
          tg.fillRoundedRect(94, ty, W - 122, 38, 6);
          tg.lineStyle(1, on ? 0x7cc8ff : 0x34507a, 1);
          tg.strokeRoundedRect(94, ty, W - 122, 38, 6);
          inner.add(tg);
          inner.add(txt(this, 106, ty + 4, t.name + (on ? '  · takılı' : ''), { size: 14, bold: true, color: on ? '#e6f6ff' : '#bfd6f0' }));
          inner.add(fitText(txt(this, 106, ty + 21, `MP ${techniqueCost(tid, s)} · ${techniqueCooldown(tid, s)} sn · ${t.desc}`, { size: 11, color: '#8fa8c8' }), W - 122 - 150));
          const b = new Button(this, W - 90, ty + 19, on ? 'Çıkar' : 'Tak', () => {
            if (this.world?.inBattle || this.world?.player?.inCombat) {
              this.showNotice({ title: 'YETENEK SLOTU', lines: ['Yetenekler yalnızca savaş dışında değiştirilir.'] });
              return;
            }
            R.setSkillSlot(0, on ? null : tid);
            Sound.sfx('click');
            this.render();
          }, { w: 96, h: 30, size: 13, style: 'blue', disabled: inFight });
          b.setName('slot_' + tid);
          inner.add(b);
          ty += 44;
        }
        ry += hgt + 8;
      }
      if (p.sp > 0) {
        const b = new Button(this, 170, ry + 26, `Sistem Teklifi (SP: ${p.sp})`, () => this.systemOffer(), { w: 300, h: 48, style: 'blue', size: 16 });
        b.setName('offer_btn');
        inner.add(b);
      }
      y += ch + gap;
    }

    // ---------------------------------------------------------- TRAITS
    if (show('traits')) {
      for (const t of p.traits) {
        if (t === 'divine_paladin') {
          const ch = 44 + 34 + 30 + 76 + Math.max(1, dv.skills.length) * 24 + 40;
          const by = this.card(inner, 0, y, W, ch, 'TRAIT · Divine Paladin (X)', 'divine', `Level ${dv.level}`, 'traits');
          inner.add(txt(this, 14, by - 2, 'Sadece sen görebilirsin. Appraisal ve lonca taşı bu trait\'i göremez.', { size: 13, italic: true, color: '#d8c890' }));
          this.progress(inner, 14, by + 24, W - 28, 18, dv.exp / divineExpToNext(dv.level), 0xd9a530, `Divine EXP ${dv.exp} / ${divineExpToNext(dv.level)}`, '#fff6d0');
          const bw = (W - 28 - 4 * 10) / 5;
          DIVINE_STATS.forEach((ds, i) => {
            const x = 14 + i * (bw + 10), yy = by + 54;
            const g = this.add.graphics();
            g.fillStyle(0x3a2a08, 0.95);
            g.fillRoundedRect(x, yy, bw, 66, 8);
            g.lineStyle(1.5, 0xffd56a, 0.8);
            g.strokeRoundedRect(x, yy, bw, 66, 8);
            inner.add(g);
            inner.add(txt(this, x + bw / 2, yy + 8, DIVINE_STAT_NAMES[ds], { size: 14, bold: true, color: '#ffe9a0' }).setOrigin(0.5, 0));
            inner.add(txt(this, x + bw / 2, yy + 30, `${divineStat(ds, dv.level).toFixed(2)}x`, { size: 22, bold: true, font: FONT.title, color: '#ffffff' }).setOrigin(0.5, 0));
          });
          let ry = by + 132;
          if (!dv.skills.length) {
            inner.add(txt(this, 14, ry, 'Divine skill yok. Her 3 Divine Level\'da bir awakening ile seçilir.', { size: 14, color: '#d8c890' }));
            ry += 24;
          }
          for (const ds of dv.skills) {
            const dd = DIVINE_BY_ID[ds];
            inner.add(iconImage(this, 26, ry + 9, dd?.icon ?? 'stone', 20));
            inner.add(txt(this, 42, ry, `${dd?.name}${dd?.kind === 'active' ? ` (Aktif · Işık ${dd.light})` : ' (Pasif)'}`, { size: 15, bold: true, color: '#ffe9a0' }));
            ry += 24;
          }
          const left = 3 - Math.min(3, dv.trainingDay === G.state.time.day ? dv.trainingCount : 0);
          inner.add(txt(this, 14, ry + 6, `Antrenman: bugün ${left} seans kaldı · Seri: ${dv.streak}`, { size: 13, color: '#bfa86a' }));
          y += ch + gap;
        } else {
          const tn = TRAIT_NAMES[t];
          const by = this.card(inner, 0, y, W, 80, `TRAIT · ${tn?.name ?? t} (${tn?.rank ?? '?'})`, 'gold', undefined, 'traits');
          void by;
          y += 80 + gap;
        }
      }
    }

    // ---------------------------------------------------------- TITLES
    if (show('titles')) {
      const cardH = 64;
      const ch = 44 + Math.max(1, p.titles.length) * (cardH + 8) + 4;
      const by = this.card(inner, 0, y, W, ch, 'TITLES', 'gold', `${p.titles.length} title`, 'title');
      let ry = by;
      if (!p.titles.length) inner.add(txt(this, 14, ry + 6, 'Henüz bir title yok. Title\'lar zor başarılarla kazanılır.', { size: 14, color: COLORS.textDim }));
      for (const t of p.titles) {
        const td = TITLES[t];
        const g = this.add.graphics();
        g.fillStyle(0x2a2030, 0.9);
        g.fillRoundedRect(14, ry, W - 28, cardH, 8);
        g.lineStyle(1, COLORS.gold, 0.7);
        g.strokeRoundedRect(14, ry, W - 28, cardH, 8);
        inner.add(g);
        inner.add(txt(this, 26, ry + 8, `${td.name}`, { size: 17, bold: true, color: '#ffe9a0' }));
        const bonus: string[] = [];
        if (td.bonus.stats) for (const [k, v] of Object.entries(td.bonus.stats)) bonus.push(`${k} +${v}`);
        if (td.bonus.hpPct) bonus.push(`Max HP +%${Math.round(td.bonus.hpPct * 100)}`);
        if (td.bonus.damagePct) bonus.push(`Hasar +%${Math.round(td.bonus.damagePct * 100)}`);
        if (td.bonus.expPct) bonus.push(`EXP +%${Math.round(td.bonus.expPct * 100)}`);
        let cx = W - 24;
        for (const b of bonus.reverse()) {
          const tt = txt(this, 0, -999, b, { size: 13, bold: true }).setVisible(false);
          cx -= tt.width + 22;
          this.chip(inner, cx, ry + 8, b, 0x2a5a2a, '#d8ffc8');
        }
        this.chip(inner, 26 + txt(this, 0, -999, td.name, { size: 17, bold: true }).setVisible(false).width + 10, ry + 8, td.rank, 0x5a4410);
        inner.add(txt(this, 26, ry + 36, td.desc, { size: 13, color: COLORS.textDim, wrap: W - 60 }));
        ry += cardH + 8;
      }
      y += ch + gap;
    }

    // ---------------------------------------------------------- EQUIPMENT
    if (show('equipment')) {
      const ch = 44 + 420;
      const by = this.card(inner, 0, y, W, ch, 'EQUIPMENT', 'gold', `DEF ${d.def} · ${d.weaponName} [${d.weaponDmg[0]}-${d.weaponDmg[1]}] · Saygınlık ${prestigeLabel(R.josephPrestige())}`, 'equipment');
      this.paperDoll(inner, W / 2, by, (slot) => {
        this.tab = 'equipment';
        this.selSlot = slot;
        this.render();
      });
      y += ch + gap;
    }

    // ---------------------------------------------------------- INVENTORY
    if (show('inventory')) {
      const ids = this.inventoryIds(this.invCat);
      const cols = Math.max(1, Math.floor((W - 28) / 84));
      const rows = Math.max(1, Math.ceil(ids.length / cols));
      const ch = 44 + 50 + rows * 84 + 10;
      const by = this.card(inner, 0, y, W, ch, 'INVENTORY', 'gold', `${Object.keys(p.inventory).length} çeşit`, 'inventory');
      this.catTabs(inner, 14, by, (cat) => {
        this.invCat = cat;
        this.render();
      });
      this.itemGrid(inner, 14, by + 50, cols, ids, null, (id) => {
        this.tab = 'inventory';
        this.selItem = id;
        this.render();
      });
      y += ch + gap;
    }
    list.setContentHeight(y + 10);
  }

  /** Karakterin etrafına dizilmiş 11 ekipman kutucuğu (sol 4, sağ 4, alt 3). */
  paperDoll(parent: Phaser.GameObjects.Container, cx: number, y: number, onSelect: (s: EquipSlot) => void) {
    const box = 62, step = 82;
    const left: EquipSlot[] = ['helmet', 'necklace', 'chest', 'cape'];
    const right: EquipSlot[] = ['weapon', 'gloves', 'belt', 'pants'];
    const bottom: EquipSlot[] = ['ring1', 'boots', 'ring2'];
    const g = this.add.graphics();
    g.fillStyle(0x0a0810, 0.75);
    g.fillRoundedRect(cx - 90, y + 6, 180, 316, 14);
    g.lineStyle(1, COLORS.goldDark, 1);
    g.strokeRoundedRect(cx - 90, y + 6, 180, 316, 14);
    g.fillStyle(0xd9b45a, 0.06);
    g.fillCircle(cx, y + 170, 80);
    parent.add(g);
    this.josephSprite(parent, cx, y + 300, 3.8);
    const slotBox = (s: EquipSlot, x: number, yy: number) => {
      const id = G.p.equipment[s];
      const sel = this.selSlot === s && this.tab === 'equipment';
      const bg = this.add.graphics();
      bg.fillStyle(sel ? 0x3a2e1a : 0x1a1622, 0.95);
      bg.fillRoundedRect(x - box / 2, yy, box, box, 8);
      bg.lineStyle(sel ? 2.5 : 1.5, id ? COLORS.gold : COLORS.goldDark, 1);
      bg.strokeRoundedRect(x - box / 2, yy, box, box, 8);
      parent.add(bg);
      if (id) {
        parent.add(iconImage(this, x, yy + box / 2, ITEMS[id].icon, 42));
        if (ITEMS[id].rank) parent.add(itemRankBadge(this, x - box / 2 + 11, yy + 11, ITEMS[id].rank!, 18));
        // Saygınlık katkısı (0 olsa bile +0)
        const sv = itemPrestige(id);
        const pt = txt(this, x + box / 2 - 4, yy + box - 3, prestigeLabel(sv), { size: 12, bold: true, stroke: true, color: sv > 0 ? '#cfe6b8' : sv < 0 ? COLORS.textRed : '#d8ccb0' }).setOrigin(1, 1);
        parent.add(pt);
        parent.add(uiIcon(this, x + box / 2 - 11 - pt.width, yy + box - 10, 'prestige', 12));
      } else parent.add(txt(this, x, yy + box / 2, '—', { size: 18, color: '#4a4058' }).setOrigin(0.5));
      parent.add(txt(this, x, yy + box + 2, EQUIP_SLOT_NAMES[s], { size: 12, bold: true, color: id ? COLORS.text : COLORS.textDim }).setOrigin(0.5, 0));
      const z = this.add.zone(x - box / 2, yy, box, box + 14).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => {
        Sound.sfx('click', 0.5);
        onSelect(s);
      });
      parent.add(z);
    };
    left.forEach((s, i) => slotBox(s, cx - 140, y + 6 + i * step));
    right.forEach((s, i) => slotBox(s, cx + 140, y + 6 + i * step));
    bottom.forEach((s, i) => slotBox(s, cx + (i - 1) * 90, y + 336));
  }

  /** Envanter kategorileri. */
  inventoryIds(cat: InvCat): string[] {
    return sortItems(this.inventoryIdsRaw(cat), ITEMS, SORT_PREFS.inv);
  }

  private inventoryIdsRaw(cat: InvCat): string[] {
    return Object.keys(G.p.inventory).filter((id) => {
      const k = ITEMS[id]?.kind;
      if (!k) return false;
      switch (cat) {
        case 'all': return true;
        case 'equip': return k === 'weapon' || k === 'armor';
        case 'food': return k === 'food' || k === 'consumable';
        case 'material': return k === 'material';
        case 'other': return k === 'book' || k === 'quest' || k === 'junk';
        case 'cards': return false;
      }
      return true;
    });
  }

  catTabs(parent: Phaser.GameObjects.Container, x: number, y: number, onPick: (c: InvCat) => void) {
    let bx = x;
    for (const [cat, label, icon] of INV_CATS) {
      const n = cat === 'cards' ? G.state.cards.length : this.inventoryIds(cat).length;
      const text = `${label} ${n}`;
      const bw = text.length * 7.6 + 46;
      const b = new Button(this, bx + bw / 2, y + 20, '    ' + text, () => onPick(cat), { w: bw, h: 40, size: 13 });
      b.add(uiIcon(this, -bw / 2 + 18, 0, icon, 22));
      b.setAlpha(this.invCat === cat ? 1 : 0.55);
      parent.add(b);
      bx += bw + 5;
    }
  }

  itemGrid(parent: Phaser.GameObjects.Container, x: number, y: number, cols: number, ids: string[], list: ScrollList | null, onPick: (id: string) => void) {
    const S = 84;
    if (!ids.length) parent.add(txt(this, x + 6, y + 10, 'Bu kategoride eşya yok.', { size: 15, color: COLORS.textDim }));
    ids.forEach((id, i) => {
      const it = ITEMS[id];
      const cx = x + (i % cols) * S, cy = y + Math.floor(i / cols) * S;
      const cell = this.add.container(cx, cy);
      const g = this.add.graphics();
      const sel = !list && this.selItem === id;
      const quick = G.state.quickFood === id;
      g.fillStyle(sel ? 0x3a2e1a : 0x1a1622, 0.92);
      g.fillRoundedRect(2, 2, S - 8, S - 8, 8);
      g.lineStyle(sel ? 2.5 : 1, sel ? COLORS.gold : COLORS.goldDark, 1);
      g.strokeRoundedRect(2, 2, S - 8, S - 8, 8);
      cell.add(g);
      cell.add(iconImage(this, (S - 4) / 2, (S - 4) / 2 - 2, it.icon, 46));
      cell.add(txt(this, S - 10, S - 26, `${G.p.inventory[id]}`, { size: 14, bold: true, stroke: true }).setOrigin(1, 0));
      if (it.rank) cell.add(itemRankBadge(this, 15, 15, it.rank, 20));
      if (quick) cell.add(uiIcon(this, S - 18, 14, 'stamina', 18));
      const z = this.add.zone(2, 2, S - 8, S - 8).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => {
        if (list?.wasDrag()) return;
        Sound.sfx('click', 0.5);
        onPick(id);
      });
      cell.addAt(z, 0);
      parent.add(cell);
    });
  }

  /**
   * Sistem Teklifi (0.9.0, S3): 1 SP Basic / 2 SP Medium / 3 SP High chance. Kart sayısı = harcanan SP; her kart
   * nadirliğini ayrı çeker (core/skills rollOfferCards). Teklif açmak haftanın hakkını kullanır; boş kartın SP'si iade.
   */
  async systemOffer() {
    const p = G.p;
    const can = R.canLearnSkill();
    if (!can.ok) {
      this.showNotice({ title: 'SİSTEM TEKLİFİ', lines: [can.reason!] });
      Sound.sfx('error');
      return;
    }
    const pct = (x: number) => `%${Math.round(x * 100)}`;
    const COL: Record<OfferSp, number> = { 1: 0xa0a0aa, 2: 0x4aa8ff, 3: 0xffcf4a };
    const sps: OfferSp[] = [1, 2, 3];
    const i = await panelChoice(this, 'SİSTEM TEKLİFİ', sps.map((sp) => ({
      title: `${sp} SP · ${OFFER_NAMES[sp]}`,
      frame: COL[sp],
      tag: { text: `${sp} kart`, color: sp === 1 ? '#c8c8d0' : sp === 2 ? '#8fd0ff' : '#ffe08a' },
      desc: OFFER_RARITIES.map((r, k) => `${RARITY_NAMES[r]}: ${pct(OFFER_ODDS[sp][k])}`).join('\n') + '\n\nHer kart nadirliğini ayrı çeker.',
      footer: p.sp >= sp ? 'Teklif açmak bu haftanın skill hakkını kullanır.' : 'SP yetersiz.',
      disabled: p.sp < sp,
    })), true, true);
    if (i < 0) return;
    const sp = sps[i];
    if (p.sp < sp) {
      Sound.sfx('error');
      return;
    }
    p.sp -= sp;
    R.useWeeklyLearn();
    const res = rollOfferCards(sp, p.skills.map((s) => s.id));
    p.sp += res.refund;
    G.scheduleSave();
    if (res.cards.every((c) => !c)) {
      this.showNotice({ title: 'SİSTEM TEKLİFİ', lines: ['Sistem uygun skill bulamadı.', `${res.refund} SP iade edildi.`] });
      this.render();
      return;
    }
    const j = await panelChoice(this, `SİSTEM TEKLİFİ — ${sp} KART`, res.cards.map((s) => s ? {
      title: s.name,
      icon: s.icon,
      frame: RARITY_FRAME[s.rarity],
      tag: { text: RARITY_NAMES[s.rarity], color: '#' + RARITY_FRAME[s.rarity].toString(16).padStart(6, '0') },
      desc: s.desc + '\n\n' + s.tiers.slice(0, 3).map((t) => `${t.at}: ${t.note}`).join('\n'),
    } : {
      title: 'Boş',
      frame: 0x50586a,
      disabled: true,
      button: '—',
      desc: 'Sistem uygun skill bulamadı.\n\nBu kartın SP\'si iade edildi.',
    }), true, 'Hiçbirini seçme');
    if (j >= 0 && res.cards[j]) R.learnSkill(res.cards[j]!.id, 'Sistem Teklifi', { weekly: false });
    if (res.refund) this.showNotice({ title: 'SİSTEM TEKLİFİ', lines: [`${res.refund} boş kart: ${res.refund} SP iade edildi.`] });
    this.render();
  }

  /** Menünün üstünde sistem bildirimi (0.9.0: UI sahnesi menünün arkasında kaldığı için bildirimler burada). */
  notices: Phaser.GameObjects.Container[] = [];

  showNotice(m: { title: string; lines?: string[]; sound?: string }) {
    const W = Display.uiW;
    const w = Math.min(560, W - 60);
    const lines = (m.lines ?? []).map((l) => plainMoney(l));
    const h = 58 + lines.length * 22;
    const y0 = 30 + this.notices.reduce((a, n) => a + (n as any).h + 10, 0);
    const c = this.add.container(W / 2, y0).setDepth(300);
    (c as any).h = h;
    const g = this.add.graphics();
    drawBlue(g, -w / 2, 0, w, h, 0.95);
    c.add(g);
    c.add(txt(this, 0, 10, `【 ${m.title} 】`, { size: 16, bold: true, font: FONT.title, color: '#e6f6ff' }).setOrigin(0.5, 0));
    lines.forEach((l, i) => c.add(fitText(txt(this, 0, 38 + i * 22, l, { size: 15, color: COLORS.textBlue }).setOrigin(0.5, 0), w - 30)));
    const z = this.add.zone(-w / 2, 0, w, h).setOrigin(0, 0).setInteractive();
    c.add(z);
    const close = () => {
      if (!c.active) return;
      this.notices = this.notices.filter((n) => n !== c);
      this.tweens.add({ targets: c, alpha: 0, duration: 200, onComplete: () => c.destroy() });
    };
    z.on('pointerup', close);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 180 });
    this.time.delayedCall(3800, close);
    this.notices.push(c);
    Sound.sfx(m.sound ?? 'system', 0.7);
  }

  // ================================================================ ENVANTER
  renderInventory() {
    const c = this.content;
    const w = this.cw, h = this.ph - 48;
    c.add(uiIcon(this, 16, 16, 'inventory', 30));
    c.add(txt(this, 38, 0, 'Envanter', { size: 24, font: FONT.title, color: COLORS.textGold }));
    // Saygınlık (C1) ve para
    c.add(uiIcon(this, 196, 16, 'prestige', 24));
    c.add(txt(this, 212, 4, `Saygınlık ${prestigeLabel(R.josephPrestige())}`, { size: 16, bold: true, color: '#ffe9a0' }));
    const wr = coinRow(this, 0, 16, G.p.wallet, { size: 22, font: 18 });
    wr.x = w - wr.rowWidth;
    c.add(wr);
    c.add(uiIcon(this, wr.x - 18, 16, 'money', 22));
    const lw = Math.floor(w * 0.58);
    this.catTabs(c, 0, 40, (cat) => {
      this.invCat = cat;
      this.render();
    });
    const dx = lw + 20, dw = w - lw - 20;
    if (this.invCat === 'cards') {
      this.renderCards(c, 0, 92, w, h - 100);
      return;
    }
    // 0.9.0: Sırala (ortalama satış fiyatı, rütbe, tür, ad; artan/azalan) — oturum boyunca hatırlanır
    sortBar(this, c, 0, 92, SORT_PREFS.inv, () => this.render());
    const list = new ScrollList(this, 0, 136, lw, h - 144);
    c.add(list);
    list.updateMask();
    const ids = this.inventoryIds(this.invCat);
    const cols = Math.max(1, Math.floor((lw - 10) / 84));
    // Seçim çerçevesi ayrı: bir eşya seçmek yalnızca ayrıntı panelini yeniden çizer (A3)
    this.itemGrid(list.inner, 0, 0, cols, ids, list, (id) => {
      this.selItem = id;
      this.renderInvDetail(dx, dw, h);
      this.placeSelFrame(cols);
    });
    this.invIds = ids;
    this.selFrame = this.add.graphics();
    list.inner.add(this.selFrame);
    this.placeSelFrame(cols);
    list.setContentHeight(Math.ceil(ids.length / cols) * 84 + 10);
    this.renderInvDetail(dx, dw, h);
  }

  invIds: string[] = [];
  selFrame: Phaser.GameObjects.Graphics | null = null;
  invDetail: Phaser.GameObjects.Container | null = null;

  placeSelFrame(cols: number) {
    const g = this.selFrame;
    if (!g) return;
    g.clear();
    const i = this.selItem ? this.invIds.indexOf(this.selItem) : -1;
    if (i < 0) return;
    const S = 84;
    g.lineStyle(3, COLORS.goldLight, 1);
    g.strokeRoundedRect((i % cols) * S + 2, Math.floor(i / cols) * S + 2, S - 8, S - 8, 8);
  }

  /** Envanter ayrıntı kartı (yalnızca bu bölüm yeniden çizilir). */
  renderInvDetail(dx: number, dw: number, h: number) {
    this.invDetail?.destroy();
    const c = this.add.container(0, 0);
    this.invDetail = c;
    this.content.add(c);
    const id = this.selItem && G.p.inventory[this.selItem] ? this.selItem : null;
    const g = this.add.graphics();
    g.fillStyle(0x1a1622, 0.9);
    g.fillRoundedRect(dx, 92, dw, h - 100, 10);
    g.lineStyle(1, COLORS.goldDark, 1);
    g.strokeRoundedRect(dx, 92, dw, h - 100, 10);
    c.add(g);
    if (!id) {
      c.add(txt(this, dx + 16, 110, 'Bir eşya seç.\n\nYiyecekleri Hızlı Yemek yuvasına atayabilirsin.', { size: 15, color: COLORS.textDim, wrap: dw - 32 }));
      return;
    }
    const it = ITEMS[id];
    c.add(iconImage(this, dx + 50, 140, it.icon, 64));
    c.add(txt(this, dx + 94, 110, it.name, { size: 20, bold: true, color: COLORS.textGold, font: FONT.title, wrap: dw - 110 }));
    let ix = dx + 94;
    if (it.rank) {
      c.add(itemRankBadge(this, ix + 10, 150, it.rank, 20));
      const rt = txt(this, ix + 24, 141, `Rütbe ${it.rank}`, { size: 13, bold: true, color: COLORS.textGold });
      c.add(rt);
      ix += 32 + rt.width;
    }
    c.add(txt(this, ix, 141, `${it.rank ? '· ' : ''}${CAT_NAME[it.kind] ?? ''} · Elinde ${G.p.inventory[id]}`, { size: 13, color: COLORS.textDim, wrap: dx + dw - ix - 10 }));
    c.add(txt(this, dx + 16, 186, itemLabel(id), { size: 15, color: COLORS.textBlue, wrap: dw - 32 }));
    let ty = 214;
    if (it.slot) {
      // Saygınlık katkısı (C1/B6)
      const sv = itemPrestige(id);
      c.add(uiIcon(this, dx + 26, ty + 10, 'prestige', 20));
      c.add(txt(this, dx + 42, ty, `Saygınlık katkısı: ${prestigeLabel(sv)}`, { size: 15, bold: true, color: sv > 0 ? '#cfe6b8' : sv < 0 ? COLORS.textRed : COLORS.textDim }));
      ty += 28;
    }
    const eff = itemEffectsText(id);
    const desc = txt(this, dx + 16, ty, it.desc + (eff ? '\n' + eff : '') + (it.special ? '\nÖzel: ' + it.special : ''), { size: 15, wrap: dw - 32, lineSpacing: 3 });
    c.add(desc);
    let by = Math.max(340, ty + 10 + desc.height + 20);
    const act = (label: string, fn: () => void, icon?: string) => {
      const b = new Button(this, dx + dw / 2, by, (icon ? '   ' : '') + label, fn, { w: dw - 30, h: 52, size: 17 });
      if (icon) b.add(uiIcon(this, -(dw - 30) / 2 + 26, 0, icon, 24));
      c.add(b);
      by += 60;
    };
    if (it.slot) act('Kuşan', () => {
      const slot = it.slot === 'ring' ? (G.p.equipment.ring1 ? 'ring2' : 'ring1') : it.slot!;
      const r = equip(G.p as any, id, slot as EquipSlot);
      if (r.ok) {
        Sound.sfx('pickup');
        this.world.player.refreshLayers();
      } else R.toast(r.reason ?? 'Olmadı', 'warn');
      this.selItem = null;
      this.render();
    }, 'equipment');
    if (it.kind === 'food') {
      act('Ye', () => this.useItem(id), 'inv_food');
      if (G.state.quickFood !== id) act('Hızlı yemeğe ata', () => {
        G.state.quickFood = id;
        G.scheduleSave();
        Sound.sfx('click');
        R.toast(`Hızlı yemek: ${it.name}`, 'info', it.icon);
        this.render();
      }, 'stamina');
      else {
        c.add(uiIcon(this, dx + 40, by - 2, 'stamina', 20));
        c.add(txt(this, dx + 56, by - 12, 'Hızlı yemek yuvasında (F)', { size: 14, color: '#ffe080', bold: true }));
      }
    } else if (it.effects && it.kind === 'consumable') act('Kullan', () => this.useItem(id));
    if (it.kind === 'book') act('Oku', () => this.useItem(id));
    if (id === 'map_village' || id === 'map_forest_deep') act('Haritaya işle', () => this.useItem(id), 'map');
  }

  /** Giriş Kartları sekmesi (C8): her şehrin kartları, kalan süreleriyle. */
  renderCards(c: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number) {
    const cards = G.state.cards;
    const today = G.state.time.day;
    if (!cards.length) {
      c.add(uiIcon(this, x + 40, y + 40, 'card', 48));
      c.add(txt(this, x + 76, y + 20, 'Henüz bir giriş kartın yok.\nDuvarlı şehre girmek için kontrol noktasında Kaptan Roderick\'ten 3 aylık giriş kartı alınır (10 gümüş).', { size: 15, color: COLORS.textDim, wrap: w - 100 }));
      return;
    }
    let yy = y;
    for (const cd of [...cards].sort((a, b) => a.from - b.from)) {
      const left = daysLeft(cd, today);
      const g = this.add.graphics();
      const active = cd.from <= today && left > 0;
      g.fillStyle(active ? 0x2a2210 : 0x1a1622, 0.95);
      g.fillRoundedRect(x, yy, w, 76, 10);
      g.lineStyle(active ? 2 : 1, active ? COLORS.gold : COLORS.goldDark, 1);
      g.strokeRoundedRect(x, yy, w, 76, 10);
      c.add(g);
      c.add(uiIcon(this, x + 40, yy + 38, 'card', 44));
      c.add(txt(this, x + 76, yy + 10, `Giriş Kartı — ${CITY_NAMES[cd.city] ?? cd.city}`, { size: 18, bold: true, font: FONT.title, color: COLORS.textGold }));
      const status = left <= 0 ? 'Süresi doldu' : cd.from > today ? `${cd.from}. günde başlar · ${left} gün` : `Kalan: ${left} gün`;
      c.add(txt(this, x + 76, yy + 42, `${cd.from}. gün – ${cd.until}. gün  ·  ${status}`, { size: 15, color: left > 0 ? '#cfe6b8' : COLORS.textRed }));
      yy += 86;
      if (yy > y + h - 80) break;
    }
  }

  useItem(id: string) {
    const it = ITEMS[id];
    if (id === 'map_village' || id === 'map_forest_deep') {
      const r = transact(G.p as any, { label: 'Harita', take: [{ id, qty: 1 }] });
      if (!r.ok) return;
      if (id === 'map_village') this.world.revealArea('world', VILLAGE_X0 - 2, 24, BARRIER_X, WORLD_H - 4);
      else this.world.revealArea('world', 0, 0, 56, 24);
      R.sysmsg('HARİTA', [id === 'map_village' ? 'Brindlewood haritaya işlendi.' : 'Ormanın derinlikleri haritaya işlendi.']);
      this.render();
      return;
    }
    if (it.kind === 'book') {
      const sk = it.effects?.find((e) => e.type === 'learnSkill')?.skill;
      if (!sk) return;
      if (R.hasSkill(sk)) {
        R.toast('Bu skill\'e zaten sahipsin.', 'warn');
        return;
      }
      const can = R.canLearnSkill();
      if (!can.ok) {
        R.sysmsg('OKUNAMADI', [can.reason!]);
        return;
      }
      const r = transact(G.p as any, { label: 'Kitap okuma', take: [{ id, qty: 1 }] });
      if (r.ok) R.learnSkill(sk, `Kitap: ${it.name}`);
      this.render();
      return;
    }
    this.world.consume(id);
    this.render();
  }

  // ================================================================ EKİPMAN
  renderEquipment() {
    const c = this.content;
    const w = this.cw, h = this.ph - 48;
    c.add(txt(this, 0, 0, 'Ekipman', { size: 24, font: FONT.title, color: COLORS.textGold }));
    const lw = Math.min(440, Math.floor(w * 0.56));
    this.paperDoll(c, lw / 2, 36, (s) => {
      this.selSlot = s;
      this.render();
    });
    const d = G.d;
    c.add(txt(this, lw / 2, h - 24, `DEF ${d.def} · Silah: ${d.weaponName} [${d.weaponDmg[0]}-${d.weaponDmg[1]}]`, { size: 14, color: COLORS.textBlue, bold: true }).setOrigin(0.5, 0));
    const dx = lw + 16, dw = w - lw - 16;
    const g = this.add.graphics();
    g.fillStyle(0x1a1622, 0.9);
    g.fillRoundedRect(dx, 40, dw, h - 48, 10);
    g.lineStyle(1, COLORS.goldDark, 1);
    g.strokeRoundedRect(dx, 40, dw, h - 48, 10);
    c.add(g);
    if (!this.selSlot) {
      c.add(txt(this, dx + 16, 60, 'Bir kutucuk seç.\nKuşanılan eşya envanterden çıkar; çıkarınca geri döner.', { size: 15, color: COLORS.textDim, wrap: dw - 32 }));
      return;
    }
    const s = this.selSlot;
    const cur = G.p.equipment[s];
    let y = 56;
    c.add(txt(this, dx + 16, y, EQUIP_SLOT_NAMES[s], { size: 20, bold: true, color: COLORS.textGold, font: FONT.title }));
    y += 36;
    if (cur) {
      c.add(iconImage(this, dx + 36, y + 22, ITEMS[cur].icon, 40));
      if (ITEMS[cur].rank) c.add(itemRankBadge(this, dx + 20, y + 6, ITEMS[cur].rank!, 18));
      const lt = txt(this, dx + 64, y + 4, itemLabel(cur), { size: 14, color: COLORS.text, wrap: dw - 80 });
      c.add(lt);
      const sv = itemPrestige(cur);
      c.add(uiIcon(this, dx + 72, y + lt.height + 14, 'prestige', 14));
      c.add(txt(this, dx + 82, y + lt.height + 6, `Saygınlık ${prestigeLabel(sv)}`, { size: 13, bold: true, color: sv > 0 ? '#cfe6b8' : sv < 0 ? COLORS.textRed : COLORS.textDim }));
      y += Math.max(52, lt.height + 30);
      c.add(new Button(this, dx + dw / 2, y + 24, `Çıkar: ${ITEMS[cur].name}`, () => {
        unequip(G.p as any, s);
        this.world.player.refreshLayers();
        Sound.sfx('click');
        this.render();
      }, { w: dw - 30, h: 48, size: 15 }));
      y += 64;
    }
    const kind = s === 'ring1' || s === 'ring2' ? 'ring' : s;
    const cands = Object.keys(G.p.inventory).filter((id) => ITEMS[id]?.slot === kind);
    c.add(txt(this, dx + 16, y, cands.length ? 'Envanterden kuşan:' : 'Envanterde bu slota uygun eşya yok.', { size: 14, color: COLORS.textDim, wrap: dw - 32 }));
    y += 26;
    for (const id of cands) {
      if (y > h - 40) break;
      c.add(new Button(this, dx + dw / 2, y + 24, itemLabel(id), () => {
        const r = equip(G.p as any, id, s);
        if (r.ok) {
          Sound.sfx('pickup');
          this.world.player.refreshLayers();
        }
        this.render();
      }, { w: dw - 30, h: 48, size: 13, icon: ITEMS[id].icon }));
      y += 56;
    }
  }

  // ================================================================ GÖREVLER
  renderQuests() {
    renderQuestsTab(this, this.content, this.cw, this.ph - 48, this.selQuest, (id) => {
      this.selQuest = id;
      this.render();
    });
  }

  // ================================================================ HARİTA
  renderMap() {
    const c = this.content;
    const w = this.cw, h = this.ph - 48;
    const world = this.world;
    const m = world.mapData.indoor ? getMap(world, 'world') : world.mapData;
    c.add(txt(this, 0, 0, 'Harita — ' + (world.mapData.indoor ? `${world.mapData.name} (dışarısı)` : 'Elonth: Brindlewood çevresi'), { size: 20, font: FONT.title, color: COLORS.textGold }));
    const scale = Math.min((w - 10) / m.w, (h - 50) / m.h);
    const mw = Math.floor(m.w * scale), mh = Math.floor(m.h * scale);
    const key = 'bigmap';
    if (this.textures.exists(key)) this.textures.remove(key);
    const tex = this.textures.createCanvas(key, m.w * 3, m.h * 3)!;
    const ctx = tex.getContext();
    const fog = fogOf(m);
    ctx.fillStyle = '#0c0a10';
    ctx.fillRect(0, 0, m.w * 3, m.h * 3);
    for (let y = 0; y < m.h; y++)
      for (let x = 0; x < m.w; x++) {
        const i = y * m.w + x;
        if (!fog[i]) continue;
        ctx.fillStyle = tcol(m.terrain[i], m.solid[i]);
        ctx.fillRect(x * 3, y * 3, 3, 3);
      }
    // parşömen dokusu
    ctx.fillStyle = 'rgba(80,60,30,0.12)';
    for (let i = 0; i < 400; i++) ctx.fillRect(Math.random() * m.w * 3, Math.random() * m.h * 3, 2, 2);
    tex.refresh();
    const ox = (w - mw) / 2, oy = 40;
    const img = this.add.image(ox, oy, key).setOrigin(0, 0).setDisplaySize(mw, mh);
    const frame = this.add.graphics();
    frame.lineStyle(2, COLORS.gold, 1);
    frame.strokeRect(ox - 2, oy - 2, mw + 4, mh + 4);
    c.add([img, frame]);
    const bmeta = this.cache.json.get('buildingsMeta');
    const icons: [string, number, number, string][] = [];
    const B_ICON = BUILDING_ICON;
    for (const b of m.buildings) {
      const ic = B_ICON[b.id];
      if (!ic) continue;
      const bx = b.tx + bmeta[b.id].w / TILE / 2, by = b.tyBottom - 2;
      if (!fog[Math.floor(by) * m.w + Math.floor(bx)]) continue;
      icons.push([ic, bx, by, b.name]);
    }
    const P = m.points;
    const fogAt = (x: number, y: number) => fog[y * m.w + x];
    const pts: [string, string, string][] = [['training', 'm_training', 'Antrenman Alanı'], ['checkpoint', 'm_checkpoint', 'Kontrol Noktası'], ['goblin_camp', 'm_camp', 'Goblin Kampı'],
      ['wake', 'm_wake', 'Uyandığın Yer'], ['well', 'm_plaza', 'Meydan'], ['fountain', 'm_plaza', 'Çeşme Meydanı'], ['oak', 'm_oak', 'Yaşlı Meşe'], ['pasture', 'm_pasture', 'Mera'], ['pond', 'm_pond', 'Çamaşır Göleti']];
    for (const [k, ic, name] of pts) if (P[k] && fogAt(P[k].x, P[k].y)) icons.push([ic, P[k].x, P[k].y, name]);
    for (const [ic, x, y, name] of icons) {
      const tx = ox + x * scale, ty = oy + y * scale;
      c.add(uiIcon(this, tx, ty, ic, 22));
      c.add(txt(this, tx, ty + 12, name, { size: 11, stroke: true, color: COLORS.textDim }).setOrigin(0.5, 0));
    }
    // yan görev verenler (0.6.0): mavi parlayan nokta, genişleyip sönen halkalar; binadaysa bina parlar
    for (const s of world.sideMarkSpots?.() ?? []) {
      const sx = ox + s.x * scale, sy = oy + s.y * scale;
      const col = s.kind === 'turnin' ? 0x9fdcff : 0x4aa8ff;
      if (s.building) {
        const bw = (bmeta[s.building]?.w ?? 96) / TILE * scale;
        const glow = this.add.rectangle(sx, sy + 4, bw + 8, bw * 0.75 + 8, col, 0.28).setStrokeStyle(2, col, 0.9);
        c.add(glow);
        this.tweens.add({ targets: glow, alpha: 0.35, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.easeInOut' });
      }
      for (let k = 0; k < 2; k++) {
        const ring = this.add.circle(sx, sy, 6, col, 0).setStrokeStyle(2, col, 0.9);
        c.add(ring);
        this.tweens.add({ targets: ring, scale: 3.2, alpha: 0, repeat: -1, duration: 1600, delay: k * 800 });
      }
      c.add(this.add.circle(sx, sy, 7, col, 0.45));
      c.add(this.add.circle(sx, sy, 3.5, 0xe6f6ff, 1));
      c.add(uiIcon(this, sx, sy - 16, s.kind === 'turnin' ? 'side_turnin' : 'side_quest', 24));
    }
    // takip edilen görevin hedefi
    const qt = world.questTargetPx?.() as { x: number; y: number } | null;
    if (qt && !world.mapData.indoor) {
      const mk = uiIcon(this, ox + (qt.x / TILE) * scale, oy + (qt.y / TILE) * scale - 10, 'm_quest', 30);
      c.add(mk);
      this.tweens.add({ targets: mk, y: mk.y - 4, yoyo: true, repeat: -1, duration: 500 });
    }
    // oyuncu
    const pp = world.mapData.indoor ? (() => {
      const door = Object.entries(m.points).find(([k]) => k === 'door_' + (world.mapData.id === 'inn_attic' ? 'inn' : world.mapData.id));
      return door ? door[1] : { x: 0, y: 0 };
    })() : { x: world.player.actor.x / TILE, y: world.player.actor.y / TILE };
    const dot = this.add.circle(ox + pp.x * scale, oy + pp.y * scale, 5, 0xffffff).setStrokeStyle(2, 0xc8323c);
    c.add(dot);
    this.tweens.add({ targets: dot, scale: 1.5, yoyo: true, repeat: -1, duration: 600 });
    c.add(txt(this, 0, h - 4, 'Keşfettikçe harita açılır. Harita parçaları ve ipuçları da bölgeleri açabilir.', { size: 12, italic: true, color: COLORS.textDim }).setOrigin(0, 1));
  }

  // ================================================================ GEÇMİŞ
  /** Konuşmalar sekmesinde gösterilen son satır sayısı (0.9.0: 40'ar 40'ar; açılışta yalnızca son 40 çizilir). */
  histShown = HISTORY_PAGE;

  renderHistory(keepTopOf?: { scroll: number; height: number }) {
    const c = this.content;
    const w = this.cw, h = this.ph - 48;
    c.add(txt(this, 0, 0, 'Konuşma Geçmişi', { size: 24, font: FONT.title, color: COLORS.textGold }));
    const all = G.state.history;
    const n = Math.min(all.length, this.histShown);
    const start = all.length - n;
    c.add(txt(this, w, 8, `${n} / ${all.length} satır`, { size: 13, color: COLORS.textDim }).setOrigin(1, 0));
    const list = new ScrollList(this, 0, 48, w, h - 56);
    c.add(list);
    list.updateMask();
    let y = 0;
    // daha eskiler: üstte "Daha fazla göster" (bir sonraki 40 satır); eklenince görünen yer kaymaz
    if (start > 0) {
      const more = Math.min(HISTORY_PAGE, start);
      const b = new Button(this, w / 2 - 8, 24, `     Daha fazla göster (${more} eski satır)`, () => {
        if (list.wasDrag()) return;
        const keep = { scroll: list.scrollY, height: list.contentH };
        this.histShown += HISTORY_PAGE;
        this.content.removeAll(true);
        this.renderHistory(keep);
      }, { w: 340, h: 44, size: 15, style: 'blue' });
      b.add(uiIcon(this, -150, 0, 'more', 20));
      list.inner.add(b);
      y += 58;
    }
    // satır başına tek metin nesnesi (ad + metin aynı sarılı metinde değil: ad sütunu ayrı ama kısa ve sarılmaz)
    for (let i = start; i < all.length; i++) {
      const l = all[i];
      const color = l.kind === 'thought' ? '#a9c8ff' : l.kind === 'system' ? COLORS.textBlue : l.kind === 'choice' ? COLORS.textGold : COLORS.text;
      const name = txt(this, 0, y, l.speaker, { size: 14, bold: true, color: COLORS.textGold });
      const t = txt(this, 170, y, plainMoney(l.text), { size: 15, color, italic: l.kind === 'thought', wrap: w - 190 });
      list.inner.add([name, t]);
      y += Math.max(22, t.height) + 10;
    }
    if (!all.length) list.inner.add(txt(this, 0, 0, 'Henüz kimseyle konuşmadın.', { size: 15, color: COLORS.textDim }));
    list.setContentHeight(y);
    // en yeni konuşmada açılır; "Daha fazla" sonrası önceki görünüm yerinde kalır
    list.setScroll(keepTopOf ? keepTopOf.scroll + (y - keepTopOf.height) : y);
  }

  // ================================================================ KAYIT
  renderSave() {
    const c = this.content;
    const w = this.cw;
    c.add(txt(this, 0, 0, 'Kaydet / Yükle', { size: 24, font: FONT.title, color: COLORS.textGold }));
    c.add(txt(this, 0, 36, 'Oyun uyurken ve bölge değiştirirken otomatik kaydedilir.', { size: 14, italic: true, color: COLORS.textDim }));
    SLOT_KEYS.forEach((k: SlotKey, i) => {
      const y = 80 + i * 110;
      const info = slotInfo(localStorage, k);
      const g = this.add.graphics();
      g.fillStyle(0x1a1622, 0.9);
      g.fillRoundedRect(0, y, w, 96, 8);
      g.lineStyle(1, COLORS.goldDark, 1);
      g.strokeRoundedRect(0, y, w, 96, 8);
      c.add(g);
      c.add(txt(this, 20, y + 14, k === 'auto' ? 'Otomatik Kayıt' : `Yuva ${i}`, { size: 18, bold: true, color: COLORS.textGold }));
      c.add(txt(this, 20, y + 48, info ? `${info.summary} · ${new Date(info.savedAt).toLocaleString('tr-TR')}` : 'Boş', { size: 14, color: info ? COLORS.text : COLORS.textDim }));
      if (k !== 'auto') c.add(new Button(this, w - 260, y + 48, 'Kaydet', async () => {
        if (info && !(await confirmBox(this, 'Bu yuvanın üzerine yazılsın mı?'))) return;
        G.save(k);
        Sound.sfx('coin');
        R.toast('Kaydedildi.', 'info');
        this.render();
      }, { w: 150, h: 52 }));
      if (info) c.add(new Button(this, w - 90, y + 48, 'Yükle', async () => {
        if (!(await confirmBox(this, 'Bu kayıt yüklensin mi? Kaydedilmemiş ilerleme kaybolur.'))) return;
        if (G.load(k)) {
          clearFogCache();
          leaveGame(this.scene, this.ui, 'World');
        }
      }, { w: 150, h: 52 }));
    });
    c.add(new Button(this, w / 2, 80 + 4 * 110 + 40, 'Ana Menüye Dön', async () => {
      if (!(await confirmBox(this, 'Ana menüye dönülsün mü? Oyun otomatik kaydedilecek.'))) return;
      G.save('auto');
      leaveGame(this.scene, this.ui, 'Title');
    }, { w: 300, h: 56 }));
  }
}

function parseRank(s: string) {
  const L = 'GFEDCBASX'.indexOf(s[0]);
  const sub = s[1] === '-' ? 0 : s[1] === '+' ? 2 : 1;
  return L * 3 + sub;
}

function statHint(k: string) {
  switch (k) {
    case 'STR': return 'Fiziksel hasar +%8';
    case 'VIT': return '+8 HP, dayanıklılık';
    case 'AGI': return 'Hareket +%1,5 (en çok %60), kaçış, yenilenme';
    case 'DEX': return 'Saldırı hızı +%2 (en çok %70), kritik';
    case 'MNA': return '+3 MP, büyü gücü +%1, MP yenilenmesi';
    case 'INT': return 'Büyü gücü +%6, büyü alanı +%3';
    case 'LUK': return 'Drop şansı +%6, kritik +%0,6, şans eseri ıskalatma';
  }
  return '';
}

function tcol(t: number, solid: number) {
  switch (t) {
    case TERRAIN.forest: return solid ? '#1d3f22' : '#2c5a2f';
    case TERRAIN.water: return '#3a78b0';
    case TERRAIN.dirt: return '#b8955f';
    case TERRAIN.mud: return '#7a5530';
    case TERRAIN.sand: return '#e0c878';
    case TERRAIN.cobble: return '#9a9aa6';
    case TERRAIN.farm: return '#8a6538';
    default: return solid ? '#3a7a38' : '#5a9a46';
  }
}
