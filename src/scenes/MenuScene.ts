import Phaser from 'phaser';
import { G } from '../game/G';
import { Display } from '../game/display';
import { Sound } from '../audio/audio';
import { COLORS, FONT, txt, drawFrame, drawBlue, Button, iconImage } from '../ui/kit';
import { ScrollList, panelChoice, confirmBox } from '../ui/panels';
import { buildSettings } from '../ui/settingsPanel';
import { itemLabel, itemEffectsText } from '../ui/format';
import { STAT_KEYS, expToNext } from '../core/formulas';
import { subRankToString, skillThreshold, SUBRANK_MAX } from '../core/ranks';
import { SKILLS, RARITY_NAMES, TECHNIQUES, OFFER_COST } from '../data/skills';
import { TITLES, TRAIT_NAMES } from '../data/titles';
import { ITEMS } from '../data/items';
import { EQUIP_SLOTS, EQUIP_SLOT_NAMES, type EquipSlot } from '../core/types';
import { equip, unequip, transact } from '../core/transactions';
import { formatWallet } from '../core/money';
import { divineExpToNext, divineStat, DIVINE_STATS, DIVINE_STAT_NAMES } from '../core/divine';
import { DIVINE_BY_ID } from '../data/divine';
import { nextTier, rollOffer, type OfferRarity } from '../core/skills';
import * as R from '../game/rules';
import { SLOT_KEYS, slotInfo, type SlotKey } from '../core/save';
import type { UIScene } from './UIScene';
import type { WorldScene } from './WorldScene';
import { getMap, fogOf, clearFogCache } from './WorldScene';
import { TERRAIN, TILE } from '../world/types';

type Tab = 'status' | 'inventory' | 'equipment' | 'map' | 'history' | 'settings' | 'save';
const TABS: [Tab, string][] = [
  ['status', 'Status'],
  ['inventory', 'Envanter'],
  ['equipment', 'Ekipman'],
  ['map', 'Harita'],
  ['history', 'Konuşma Geçmişi'],
  ['settings', 'Ayarlar'],
  ['save', 'Kaydet / Yükle'],
];
const SECTIONS = ['all', 'status', 'stats', 'skills', 'traits', 'titles', 'equipment', 'inventory'] as const;
const SECTION_NAMES: Record<string, string> = { all: 'Tümü', status: 'Status', stats: 'Stats', skills: 'Skills', traits: 'Traits', titles: 'Titles', equipment: 'Equipment', inventory: 'Inventory' };

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
    if (data.tab) this.tab = data.tab;
  }

  create() {
    this.cameras.main.setZoom(Display.uiZoom);
    this.cameras.main.setOrigin(0, 0);
    const W = Display.uiW, H = Display.uiH;
    this.add.rectangle(0, 0, W, H, 0x05040a, 0.72).setOrigin(0, 0).setInteractive();
    this.pw = Math.min(1180, W - 24);
    this.ph = Math.min(690, H - 20);
    this.px = (W - this.pw) / 2;
    this.py = (H - this.ph) / 2;
    const g = this.add.graphics();
    drawFrame(g, this.px, this.py, this.pw, this.ph);
    // sekmeler
    const tw = 210;
    TABS.forEach(([t, label], i) => {
      const b = new Button(this, this.px + 22 + tw / 2, this.py + 60 + i * 66, label, () => {
        this.tab = t;
        this.selItem = null;
        this.selSlot = null;
        this.render();
      }, { w: tw, h: 56, size: 18 });
      b.setName('tab_' + t);
    });
    new Button(this, this.px + 22 + tw / 2, this.py + this.ph - 50, 'Oyuna Dön', () => this.close(), { w: tw, h: 56, size: 18, textColor: COLORS.textGold });
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
    if (Math.abs(Display.uiScaleSetting - G.settings.uiScale) > 0.001) this.ui.applySettings();
  }

  render() {
    for (const [t] of TABS) {
      const b = this.children.getByName('tab_' + t) as Button;
      if (b) b.setAlpha(t === this.tab ? 1 : 0.62);
    }
    this.content.removeAll(true);
    switch (this.tab) {
      case 'status': return this.renderStatus();
      case 'inventory': return this.renderInventory();
      case 'equipment': return this.renderEquipment();
      case 'map': return this.renderMap();
      case 'history': return this.renderHistory();
      case 'settings': return buildSettings(this, this.content, this.cw);
      case 'save': return this.renderSave();
    }
  }

  // ================================================================ STATUS
  renderStatus() {
    const c = this.content;
    const w = this.cw, h = this.ph - 48;
    const g = this.add.graphics();
    drawBlue(g, 0, 0, w, h, 0.84);
    c.add(g);
    // bölüm sekmeleri
    let bx = 14;
    for (const s of SECTIONS) {
      const label = SECTION_NAMES[s];
      const bw = label.length * 9 + 26;
      const b = new Button(this, bx + bw / 2, 30, label, () => {
        this.section = s;
        this.render();
      }, { w: bw, h: 40, size: 14, style: 'blue' });
      b.setAlpha(this.section === s ? 1 : 0.55);
      c.add(b);
      bx += bw + 6;
    }
    const list = new ScrollList(this, 14, 60, w - 28, h - 74);
    c.add(list);
    list.updateMask();
    const inner = list.inner;
    let y = 4;
    const p = G.p, d = G.d, dv = G.state.divine;
    const head = (icon: string, title: string) => {
      inner.add(txt(this, 0, y, `${icon} ${title}`, { size: 19, bold: true, color: '#e6f6ff', font: FONT.title }));
      const lg = this.add.graphics();
      lg.lineStyle(1, 0x7cc8ff, 0.5);
      lg.lineBetween(0, y + 28, w - 50, y + 28);
      inner.add(lg);
      y += 36;
    };
    const line = (s: string, color: string = COLORS.textBlue, size = 16, x = 18) => {
      const t = txt(this, x, y, s, { size, color, wrap: w - 80 });
      inner.add(t);
      y += t.height + 6;
      return t;
    };
    const show = (s: string) => this.section === 'all' || this.section === s;
    if (show('status')) {
      head('⚙️', 'STATUS');
      line(`İsim: Joseph   ·   Irk: İnsan   ·   Rütbe: ${p.guildRank !== null ? subRankToString(p.guildRank) : 'Yok'}`);
      line(`Level: ${p.level}   ·   EXP: ${p.exp}/${expToNext(p.level)}`);
      line(`HP: ${Math.ceil(p.hp)}/${d.maxHp}   ·   MP: ${Math.floor(p.mp)}/${d.maxMp}   ·   Dayanıklılık: ${Math.floor(p.stamina)}/${d.maxStamina}`);
      line(`Para: ${formatWallet(p.wallet)}`, '#f3dc95');
      y += 8;
    }
    if (show('stats')) {
      head('📊', 'STATS');
      line(`Dağıtılmamış stat puanı: ${p.unspent}   ·   SP: ${p.sp}`, p.unspent ? '#ffe9a0' : COLORS.textBlue);
      for (const k of STAT_KEYS) {
        const base = p.alloc[k];
        const tot = d.stats[k];
        const bonus = tot - base;
        inner.add(txt(this, 18, y + 6, k, { size: 17, bold: true, color: '#e6f6ff' }));
        inner.add(txt(this, 80, y + 6, `${tot}${bonus ? `  (${base} + ${bonus})` : ''}`, { size: 17, color: COLORS.textBlue }));
        inner.add(txt(this, 230, y + 8, statHint(k), { size: 13, color: '#6f9fcf', italic: true, wrap: w - 360 }));
        if (p.unspent > 0) {
          const b = new Button(this, w - 90, y + 18, '+', () => {
            R.allocateStat(k);
            Sound.sfx('click');
            this.render();
          }, { w: 52, h: 44, size: 22, style: 'blue' });
          inner.add(b);
        }
        y += 48;
      }
      line(`Fiziksel hasar ×${(1 + 0.05 * d.stats.STR).toFixed(2)} · Kritik %${(d.crit * 100).toFixed(1)} · Hareket ×${d.moveSpeed.toFixed(2)} · Saldırı hızı ×${d.attackSpeed.toFixed(2)} · DEF ${d.def}`, '#9fc8ff', 14);
      y += 6;
    }
    if (show('skills')) {
      head('⭐', 'SKILLS');
      for (const s of p.skills) {
        const def = SKILLS[s.id];
        const nt = nextTier(s);
        line(`${def.name} (${subRankToString(s.rank)}) ${s.rank >= SUBRANK_MAX ? '[MAX]' : `[${Math.floor(s.exp)}/${skillThreshold(s.rank)}]`}   ·   ${RARITY_NAMES[def.rarity]}`, '#ffffff', 17);
        const techs = def.tiers.filter((t) => t.technique && parseRank(t.at) <= s.rank).map((t) => TECHNIQUES[t.technique!]?.name);
        if (techs.length) line(`Teknikler: ${techs.join(', ')}`, '#9fd6ff', 14, 36);
        if (nt) line(`Sonraki (${nt.at}): ${nt.note}`, '#6f9fcf', 13, 36);
      }
      if (p.sp > 0) {
        const b = new Button(this, 160, y + 26, `Sistem Teklifi (SP: ${p.sp})`, () => this.systemOffer(), { w: 300, h: 50, style: 'blue', size: 16 });
        inner.add(b);
        y += 60;
      }
      y += 6;
    }
    if (show('traits')) {
      head('🔮', 'TRAITS');
      for (const t of p.traits) {
        const tn = TRAIT_NAMES[t];
        if (t === 'divine_paladin') {
          line(`• Divine Paladin (X) [Level: ${dv.level} | EXP: ${dv.exp}/${divineExpToNext(dv.level)}]`, '#ffe9a0', 17);
          const v = (s: any) => `${DIVINE_STAT_NAMES[s as keyof typeof DIVINE_STAT_NAMES]} ${divineStat(s, dv.level).toFixed(2)}x`;
          line(`  ${v('power')} · ${v('endurance')} · ${v('speed')}`, '#ffe9a0', 16);
          line(`  ${v('learning')} · ${v('adaptation')}`, '#ffe9a0', 16);
          for (const ds of dv.skills) line(`• Divine Paladin: ${DIVINE_BY_ID[ds]?.name}`, '#ffe9a0', 16);
          line(`Antrenman: bugün ${3 - Math.min(3, dv.trainingDay === G.state.time.day ? dv.trainingCount : 0)} seans kaldı · Seri: ${dv.streak}`, '#bfa86a', 13, 36);
        } else line(`• ${tn?.name ?? t} (${tn?.rank ?? '?'})`, '#ffe9a0');
      }
      y += 6;
    }
    if (show('titles')) {
      head('🏆', 'TITLES');
      if (!p.titles.length) line('Yok');
      for (const t of p.titles) {
        const td = TITLES[t];
        line(`${td.name} (${td.rank}) — ${td.desc}`, '#ffffff');
      }
      y += 6;
    }
    if (show('equipment')) {
      head('🛡️', 'EQUIPMENT');
      for (const s of EQUIP_SLOTS) line(`${EQUIP_SLOT_NAMES[s]}: ${p.equipment[s] ? itemLabel(p.equipment[s]!) : 'Yok'}`, p.equipment[s] ? '#ffffff' : '#6f8fb0', 15);
      y += 6;
    }
    if (show('inventory')) {
      head('🎒', 'INVENTORY');
      const inv = Object.entries(p.inventory);
      if (!inv.length) line('Boş');
      for (const [id, q] of inv) line(`${itemLabel(id)} ×${q}`, '#ffffff', 15);
      line(`Para: ${formatWallet(p.wallet)}`, '#f3dc95', 15);
    }
    list.setContentHeight(y + 20);
  }

  async systemOffer() {
    const p = G.p;
    const opts: { r: OfferRarity; label: string }[] = [
      { r: 'common', label: `Sıradan (${OFFER_COST.common} SP)` },
      { r: 'rare', label: `Nadir (${OFFER_COST.rare} SP)` },
      { r: 'legendary', label: `Efsanevi (${OFFER_COST.legendary} SP)` },
    ];
    const can = R.canLearnSkill();
    if (!can.ok) {
      R.sysmsg('SİSTEM TEKLİFİ', [can.reason!]);
      return;
    }
    const i = await panelChoice(this, 'SİSTEM TEKLİFİ — NADİRLİK', opts.map((o) => ({
      title: o.label,
      desc: o.r === 'common' ? 'Gelişimi sınırlı, işe yarar skill\'ler.' : o.r === 'rare' ? 'Üst rütbelerde güçlü teknikler açan skill\'ler.' : 'Üst rütbelerde awakening yaşayan efsanevi skill\'ler.',
      footer: p.sp >= OFFER_COST[o.r] ? 'Sistem 3 rastgele skill önerir, biri seçilir. İade yok.' : 'SP yetersiz.',
    })), true, true);
    if (i < 0) return;
    const r = opts[i].r;
    if (p.sp < OFFER_COST[r]) {
      Sound.sfx('error');
      return;
    }
    const offer = rollOffer(r, p.skills.map((s) => s.id));
    if (!offer.length) {
      R.sysmsg('SİSTEM TEKLİFİ', ['Bu nadirlikte önerilebilecek skill kalmadı.']);
      return;
    }
    p.sp -= OFFER_COST[r];
    G.scheduleSave();
    const j = await panelChoice(this, `SİSTEM TEKLİFİ — ${RARITY_NAMES[r].toUpperCase()}`, offer.map((s) => ({ title: s.name, desc: s.desc + '\n\n' + s.tiers.slice(0, 3).map((t) => `${t.at}: ${t.note}`).join('\n'), icon: s.icon })), true);
    R.learnSkill(offer[j].id, 'Sistem Teklifi');
    this.render();
  }

  // ================================================================ ENVANTER
  renderInventory() {
    const c = this.content;
    const w = this.cw, h = this.ph - 48;
    c.add(txt(this, 0, 0, 'Envanter', { size: 24, font: FONT.title, color: COLORS.textGold }));
    c.add(txt(this, w, 6, formatWallet(G.p.wallet), { size: 18, color: '#f3dc95', bold: true }).setOrigin(1, 0));
    const lw = w * 0.55;
    const list = new ScrollList(this, 0, 48, lw, h - 60);
    c.add(list);
    list.updateMask();
    const ids = Object.keys(G.p.inventory);
    const cols = Math.floor(lw / 92);
    ids.forEach((id, i) => {
      const it = ITEMS[id];
      const x = (i % cols) * 92, y = Math.floor(i / cols) * 92;
      const cell = this.add.container(x, y);
      const g = this.add.graphics();
      const sel = this.selItem === id;
      g.fillStyle(sel ? 0x3a2e1a : 0x1a1622, 0.9);
      g.fillRoundedRect(2, 2, 84, 84, 8);
      g.lineStyle(sel ? 2 : 1, sel ? COLORS.gold : COLORS.goldDark, 1);
      g.strokeRoundedRect(2, 2, 84, 84, 8);
      cell.add(g);
      cell.add(iconImage(this, 44, 40, it.icon, 50));
      cell.add(txt(this, 80, 62, `${G.p.inventory[id]}`, { size: 14, bold: true, stroke: true }).setOrigin(1, 0));
      if (it.rank) cell.add(txt(this, 8, 6, it.rank, { size: 12, bold: true, color: COLORS.textGold, stroke: true }));
      const z = this.add.zone(2, 2, 84, 84).setOrigin(0, 0).setInteractive();
      z.on('pointerup', () => {
        if (list.wasDrag()) return;
        Sound.sfx('click', 0.5);
        this.selItem = id;
        this.render();
      });
      cell.addAt(z, 0);
      list.inner.add(cell);
    });
    if (!ids.length) list.inner.add(txt(this, 10, 10, 'Envanterin boş.', { size: 16, color: COLORS.textDim }));
    list.setContentHeight(Math.ceil(ids.length / cols) * 92 + 10);
    // ayrıntı
    const dx = lw + 30, dw = w - lw - 30;
    const id = this.selItem && G.p.inventory[this.selItem] ? this.selItem : null;
    if (!id) {
      c.add(txt(this, dx, 60, 'Bir eşya seç.', { size: 16, color: COLORS.textDim }));
      return;
    }
    const it = ITEMS[id];
    c.add(iconImage(this, dx + 36, 90, it.icon, 64));
    c.add(txt(this, dx + 80, 64, it.name, { size: 20, bold: true, color: COLORS.textGold, font: FONT.title, wrap: dw - 80 }));
    c.add(txt(this, dx, 140, itemLabel(id), { size: 15, color: COLORS.textBlue, wrap: dw }));
    const eff = itemEffectsText(id);
    c.add(txt(this, dx, 172, it.desc + (eff ? '\n' + eff : '') + (it.special ? '\nÖzel: ' + it.special : ''), { size: 15, wrap: dw, lineSpacing: 3 }));
    let by = 330;
    const act = (label: string, fn: () => void) => {
      c.add(new Button(this, dx + dw / 2, by, label, fn, { w: dw - 10, h: 54, size: 18 }));
      by += 64;
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
    });
    if (it.effects && (it.kind === 'consumable' || it.kind === 'food')) act('Kullan', () => this.useItem(id));
    if (it.kind === 'book') act('Oku', () => this.useItem(id));
    if (id === 'map_village' || id === 'map_forest_deep') act('Haritaya işle', () => this.useItem(id));
  }

  useItem(id: string) {
    const it = ITEMS[id];
    if (id === 'map_village' || id === 'map_forest_deep') {
      const r = transact(G.p as any, { label: 'Harita', take: [{ id, qty: 1 }] });
      if (!r.ok) return;
      if (id === 'map_village') this.world.revealArea('world', 60, 18, 142, 104);
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
    const r = transact(G.p as any, { label: 'Kullan: ' + it.name, take: [{ id, qty: 1 }] });
    if (!r.ok) return;
    const p = G.p;
    for (const e of it.effects ?? []) {
      if (e.type === 'heal') p.hp = Math.min(G.d.maxHp, p.hp + Math.round(e.amount! * G.d.healMult));
      if (e.type === 'mana') p.mp = Math.min(G.d.maxMp, p.mp + e.amount!);
      if (e.type === 'stamina') p.stamina = Math.min(G.d.maxStamina, p.stamina + e.amount!);
      if (e.type === 'regen') {
        this.world.player.buffs.push({ id: 'regen', t: e.duration!, amount: (e.amount! * G.d.healMult) / e.duration! });
        G.count('bandagesUsed');
        R.gainSkillExp('first_aid', 1.5);
        R.checkDiscoveries();
      }
    }
    Sound.sfx('heal');
    R.toast(`${it.name} kullanıldı.`, 'info', it.icon);
    G.events.emit('stats');
    this.render();
  }

  // ================================================================ EKİPMAN
  renderEquipment() {
    const c = this.content;
    const w = this.cw;
    c.add(txt(this, 0, 0, 'Ekipman', { size: 24, font: FONT.title, color: COLORS.textGold }));
    const lw = w * 0.56;
    EQUIP_SLOTS.forEach((s, i) => {
      const y = 48 + i * 54;
      const id = G.p.equipment[s];
      const row = this.add.container(0, y);
      const g = this.add.graphics();
      const sel = this.selSlot === s;
      g.fillStyle(sel ? 0x3a2e1a : 0x1a1622, 0.9);
      g.fillRoundedRect(0, 0, lw, 48, 6);
      g.lineStyle(1, sel ? COLORS.gold : COLORS.goldDark, 1);
      g.strokeRoundedRect(0, 0, lw, 48, 6);
      row.add(g);
      row.add(txt(this, 12, 13, EQUIP_SLOT_NAMES[s], { size: 15, bold: true, color: COLORS.textGold }));
      if (id) row.add(iconImage(this, 148, 24, ITEMS[id].icon, 30));
      row.add(txt(this, 170, 13, id ? itemLabel(id) : 'Yok', { size: 14, color: id ? COLORS.text : COLORS.textDim, wrap: lw - 180 }));
      const z = this.add.zone(0, 0, lw, 48).setOrigin(0, 0).setInteractive();
      z.on('pointerup', () => {
        Sound.sfx('click', 0.5);
        this.selSlot = s;
        this.render();
      });
      row.addAt(z, 0);
      c.add(row);
    });
    const dx = lw + 26, dw = w - lw - 26;
    if (!this.selSlot) {
      c.add(txt(this, dx, 60, 'Bir slot seç.\nKuşanılan eşya envanterden çıkar; çıkarınca geri döner.', { size: 15, color: COLORS.textDim, wrap: dw }));
      return;
    }
    const s = this.selSlot;
    const cur = G.p.equipment[s];
    let y = 50;
    c.add(txt(this, dx, y, EQUIP_SLOT_NAMES[s], { size: 20, bold: true, color: COLORS.textGold, font: FONT.title }));
    y += 40;
    if (cur) {
      c.add(new Button(this, dx + dw / 2, y + 24, `Çıkar: ${ITEMS[cur].name}`, () => {
        unequip(G.p as any, s);
        this.world.player.refreshLayers();
        Sound.sfx('click');
        this.render();
      }, { w: dw, h: 50, size: 15 }));
      y += 64;
    }
    const kind = s === 'ring1' || s === 'ring2' ? 'ring' : s;
    const cands = Object.keys(G.p.inventory).filter((id) => ITEMS[id]?.slot === kind);
    if (!cands.length) c.add(txt(this, dx, y, 'Envanterde bu slota uygun eşya yok.', { size: 14, color: COLORS.textDim, wrap: dw }));
    for (const id of cands) {
      c.add(new Button(this, dx + dw / 2, y + 24, itemLabel(id), () => {
        const r = equip(G.p as any, id, s);
        if (r.ok) {
          Sound.sfx('pickup');
          this.world.player.refreshLayers();
        }
        this.render();
      }, { w: dw, h: 50, size: 13 }));
      y += 58;
    }
    const d = G.d;
    c.add(txt(this, dx, this.ph - 130, `DEF ${d.def} · Silah: ${d.weaponName} [${d.weaponDmg[0]}-${d.weaponDmg[1]}]`, { size: 14, color: COLORS.textBlue, wrap: dw }));
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
    for (const b of m.buildings) {
      if (!b.enter && b.id !== 'mill' && b.id !== 'guardhouse') continue;
      const bx = b.tx + bmeta[b.id].w / TILE / 2, by = b.tyBottom - 2;
      if (!fog[Math.floor(by) * m.w + Math.floor(bx)]) continue;
      const icon = { inn: '🍺', guild: '⚔', smithy: '⚒', shop: '🛍', healer: '✚', mill: '⚙', guardhouse: '🛡' }[b.id] ?? '⌂';
      icons.push([icon, bx, by, b.name]);
    }
    const P = m.points;
    const fogAt = (x: number, y: number) => fog[y * m.w + x];
    if (P.training && fogAt(P.training.x, P.training.y)) icons.push(['🏋', P.training.x, P.training.y, 'Antrenman Alanı']);
    if (P.checkpoint && fogAt(P.checkpoint.x, P.checkpoint.y)) icons.push(['⛩', P.checkpoint.x, P.checkpoint.y, 'Kontrol Noktası']);
    if (P.goblin_camp && fogAt(P.goblin_camp.x, P.goblin_camp.y)) icons.push(['☠', P.goblin_camp.x, P.goblin_camp.y, 'Goblin Kampı']);
    if (P.wake && fogAt(P.wake.x, P.wake.y)) icons.push(['✧', P.wake.x, P.wake.y, 'Uyandığın Yer']);
    if (P.well && fogAt(P.well.x, P.well.y)) icons.push(['◎', P.well.x, P.well.y, 'Meydan']);
    for (const [ic, x, y, name] of icons) {
      const tx = ox + x * scale, ty = oy + y * scale;
      c.add(txt(this, tx, ty, ic, { size: 16, stroke: true, color: '#fff2c0' }).setOrigin(0.5));
      c.add(txt(this, tx, ty + 12, name, { size: 10, stroke: true, color: COLORS.textDim }).setOrigin(0.5, 0));
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
  renderHistory() {
    const c = this.content;
    const w = this.cw, h = this.ph - 48;
    c.add(txt(this, 0, 0, 'Konuşma Geçmişi', { size: 24, font: FONT.title, color: COLORS.textGold }));
    const list = new ScrollList(this, 0, 48, w, h - 56);
    c.add(list);
    list.updateMask();
    let y = 0;
    for (const l of G.state.history) {
      const color = l.kind === 'thought' ? '#a9c8ff' : l.kind === 'system' ? COLORS.textBlue : l.kind === 'choice' ? COLORS.textGold : COLORS.text;
      const name = txt(this, 0, y, l.speaker, { size: 14, bold: true, color: COLORS.textGold });
      const t = txt(this, 170, y, l.text, { size: 15, color, italic: l.kind === 'thought', wrap: w - 190 });
      list.inner.add([name, t]);
      y += Math.max(22, t.height) + 10;
    }
    if (!G.state.history.length) list.inner.add(txt(this, 0, 0, 'Henüz kimseyle konuşmadın.', { size: 15, color: COLORS.textDim }));
    list.setContentHeight(y);
    list.setScroll(y);
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
          this.scene.stop();
          this.ui.menuIsOpen = false;
          this.scene.stop('UI');
          this.scene.stop('World');
          this.scene.start('World', {});
        }
      }, { w: 150, h: 52 }));
    });
    c.add(new Button(this, w / 2, 80 + 4 * 110 + 40, 'Ana Menüye Dön', async () => {
      if (!(await confirmBox(this, 'Ana menüye dönülsün mü? Oyun otomatik kaydedilecek.'))) return;
      G.save('auto');
      this.scene.stop();
      this.scene.stop('UI');
      this.scene.stop('World');
      this.scene.start('Title');
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
    case 'STR': return 'Fiziksel hasar +%5';
    case 'VIT': return '+5 HP, dayanıklılık';
    case 'AGI': return 'Hareket +%1, kaçış, yenilenme';
    case 'DEX': return 'Saldırı hızı +%1.5, kritik';
    case 'MNA': return '+2 MP, büyü gücü +%1, MP yenilenmesi';
    case 'INT': return 'Büyü gücü +%5, büyü alanı +%3';
    case 'LUK': return 'Drop şansı, kritik, şans eseri ıskalatma';
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
