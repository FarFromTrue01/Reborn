// Dükkân paneli: alım ve satım. Her işlem core/transactions üzerinden yapılır.
import Phaser from 'phaser';
import { G } from '../game/G';
import { Display } from '../game/display';
import { Sound } from '../audio/audio';
import { SHOPS } from '../data/shops';
import { ITEMS } from '../data/items';
import { sellOffer, shopBuys } from '../core/selling';
import { NPC_BY_ID } from '../data/npcs';
import { coinRow } from './coins';
import { COLORS, FONT, txt, drawFrame, Button, iconImage, itemRankBadge, uiIcon, fullScreenRect } from './kit';
import { itemPrestige, prestigeLabel } from '../core/prestige';
import { ScrollList } from './panels';
import { itemLabel, itemEffectsText } from './format';
import { sortItems, SORT_PREFS } from '../core/itemSort';
import { sortBar } from './sortBar';
import * as R from '../game/rules';
import type { UIScene } from '../scenes/UIScene';

export function openShop(ui: UIScene, shopId: string, tab: 'buy' | 'sell' = 'buy'): Promise<void> {
  return new Promise((resolve) => {
    const shop = SHOPS[shopId];
    const W = Display.uiW, H = Display.uiH;
    const world = ui.world;
    world.paused = true;
    world.physics.pause();
    ui.menuIsOpen = true;
    const c = ui.add.container(0, 0).setDepth(140);
    c.add(fullScreenRect(ui, 0x000000, 0.55).setInteractive());
    const pw = Math.min(1040, W - 40), ph = Math.min(620, H - 40);
    const px = (W - pw) / 2, py = (H - ph) / 2;
    const g = ui.add.graphics();
    drawFrame(g, px, py, pw, ph);
    c.add(g);
    c.add(txt(ui, px + 30, py + 20, shop.name, { size: 24, font: FONT.title, color: COLORS.textGold, bold: true }));
    let walletRow: ReturnType<typeof coinRow> | null = null;
    const drawWallet = () => {
      walletRow?.destroy();
      walletRow = coinRow(ui, 0, py + 38, G.p.wallet, { size: 22, font: 19, stroke: true });
      walletRow.x = px + pw - 30 - walletRow.rowWidth;
      c.add(walletRow);
      bag.x = walletRow.x - 30;
    };
    let mode = tab;
    let selected: string | null = null;
    let qty = 1;
    const listW = pw * 0.56;
    const list = new ScrollList(ui, px + 24, py + 120, listW, ph - 150);
    c.add(list);
    list.updateMask();
    const detail = ui.add.container(px + listW + 50, py + 120);
    c.add(detail);
    const tabs: Button[] = [];
    const mkTab = (label: string, m: 'buy' | 'sell', x: number) => {
      const b = new Button(ui, x, py + 82, label, () => {
        mode = m;
        selected = null;
        qty = 1;
        refresh();
      }, { w: 150, h: 48 });
      tabs.push(b);
      c.add(b);
    };
    mkTab('Satın Al', 'buy', px + 110);
    mkTab('Sat', 'sell', px + 270);
    // 0.9.0: Sırala (fiyat, rütbe, tür, ad; artan/azalan), al ve sat sekmesinde ayrı, oturum boyunca hatırlanır
    const sortRow = ui.add.container(0, 0);
    c.add(sortRow);
    const drawSort = () => {
      sortRow.removeAll(true);
      sortBar(ui, sortRow, px + 24 + listW - 248, py + 62, SORT_PREFS[mode], () => {
        drawSort();
        refresh();
      }, 40);
    };
    // çanta: satın alınan eşya buraya uçar
    const bag = uiIcon(ui, 0, py + 38, 'bag', 34);
    c.add(bag);
    const doClose = () => {
      if (ui.shopClose !== doClose) return;
      ui.shopClose = null;
      c.destroy();
      world.paused = false;
      world.physics.resume();
      ui.menuIsOpen = false;
      resolve();
    };
    ui.shopClose = doClose;
    const close = new Button(ui, px + pw - 80, py + ph - 40, 'Kapat', doClose, { w: 130, h: 50 });
    c.add(close);

    const buyPrice = (id: string) => {
      // Bertram'ın bedava yemeği yalnızca ilk çalışma günü
      if (shopId === 'inn' && id === 'hot_stew' && G.flag('free_meal_day') === G.state.time.day && G.flag('meal_day') !== G.state.time.day) return 0;
      return ITEMS[id].price;
    };
    // 0.8.0 (B16): satış teklifi = aralıktaki konum (uzmanlık + dükkân sahibiyle yakınlık)
    const offer = (id: string) => sellOffer(shop, id, ITEMS[id], G.state.affinity[shop.keeper] ?? 0);
    const sellP = (id: string) => offer(id).price;

    const refresh = () => {
      drawWallet();
      drawSort();
      tabs[0].setAlpha(mode === 'buy' ? 1 : 0.6);
      tabs[1].setAlpha(mode === 'sell' ? 1 : 0.6);
      const keepScroll = list.scrollY;
      list.clear();
      const raw = mode === 'buy'
        ? shop.stock
        : Object.keys(G.p.inventory).filter((id) => {
            const it = ITEMS[id];
            return it && !it.bound && it.kind !== 'quest' && shopBuys(shop, id, it) && sellP(id) > 0;
          });
      const ids = sortItems(raw, ITEMS, SORT_PREFS[mode], (id) => (mode === 'buy' ? buyPrice(id) : sellP(id)));
      let y = 0;
      if (!ids.length) list.inner.add(txt(ui, 10, 10, mode === 'buy' ? 'Stok yok.' : 'Satacak bir şeyin yok. (Bu dükkân her şeyi almaz.)', { size: 16, color: COLORS.textDim, wrap: listW - 20 }));
      for (const id of ids) {
        const it = ITEMS[id];
        const row = ui.add.container(0, y);
        const bg = ui.add.graphics();
        const sel = selected === id;
        bg.fillStyle(sel ? 0x3a2e1a : 0x1a1622, sel ? 0.95 : 0.7);
        bg.fillRoundedRect(0, 0, listW - 8, 58, 6);
        if (sel) {
          bg.lineStyle(1.5, COLORS.gold, 1);
          bg.strokeRoundedRect(0, 0, listW - 8, 58, 6);
        }
        row.add(bg);
        row.add(iconImage(ui, 30, 29, it.icon, 36));
        if (it.rank) row.add(itemRankBadge(ui, 14, 14, it.rank, 18));
        row.add(txt(ui, 58, 8, itemLabel(id), { size: 15, bold: true, wrap: listW - 200 }));
        const price = mode === 'buy' ? buyPrice(id) : sellP(id);
        if (price === 0 && mode === 'buy') row.add(txt(ui, listW - 20, 18, 'Bedava', { size: 15, color: COLORS.textGreen, bold: true }).setOrigin(1, 0));
        else {
          const pr = coinRow(ui, 0, 29, price, { size: 18, font: 16 });
          pr.x = listW - 22 - pr.rowWidth;
          row.add(pr);
        }
        if (mode === 'sell') row.add(txt(ui, 58, 34, `Elinde: ${G.p.inventory[id]}`, { size: 12, color: COLORS.textDim }));
        const z = ui.add.zone(0, 0, listW - 8, 58).setOrigin(0, 0).setInteractive();
        z.on('pointerup', () => {
          if (list.wasDrag()) return;
          Sound.sfx('click', 0.5);
          selected = id;
          qty = 1;
          refresh();
        });
        row.addAt(z, 0);
        list.inner.add(row);
        y += 64;
      }
      list.setContentHeight(y);
      list.setScroll(keepScroll);
      drawDetail();
    };

    /**
     * 0.9.0: "Satın alındı" — eşya ikonu ayrıntı panelinden çantaya yay çizerek uçar, çanta zıplar ve parlar,
     * cüzdandan paralar düşer. Yalnızca tween'ler: art arda alımları engellemez (her alım kendi kopyasını uçurur).
     */
    const buyFx = (id: string, qty: number) => {
      const it = ITEMS[id];
      const sx = px + listW + 50 + 36, sy = py + 120 + 36;
      const tx = bag.x, ty = bag.y;
      const n = Math.min(3, qty);
      for (let k = 0; k < n; k++) {
        const fly = iconImage(ui, sx, sy, it.icon, 48);
        c.add(fly);
        const base = fly.scale;
        const st = { t: 0 };
        ui.tweens.add({
          targets: st, t: 1, duration: 520, delay: k * 90, ease: 'Sine.In',
          onUpdate: () => {
            const t = st.t;
            fly.x = sx + (tx - sx) * t;
            fly.y = sy + (ty - sy) * t - Math.sin(t * Math.PI) * 120;
            fly.setScale(base * (1 - 0.55 * t));
            fly.setAngle(t * 200);
          },
          onComplete: () => {
            fly.destroy();
            if (!c.active) return;
            ui.tweens.add({ targets: bag, scale: { from: bag.scale * 1.35, to: 34 / 72 }, duration: 220, ease: 'Back.Out' });
            for (let i = 0; i < 6; i++) {
              const sp = uiIcon(ui, tx, ty, 'sparkle', 16);
              c.add(sp);
              const a = (i / 6) * Math.PI * 2;
              ui.tweens.add({ targets: sp, x: tx + Math.cos(a) * 34, y: ty + Math.sin(a) * 34, alpha: 0, scale: 0.05, duration: 420, onComplete: () => sp.destroy() });
            }
          },
        });
      }
      // düşen paralar (cüzdandan)
      const wx = walletRow ? walletRow.x + walletRow.rowWidth / 2 : tx + 60;
      for (let i = 0; i < 6; i++) {
        const coin = ui.add.image(wx + (Math.random() - 0.5) * 60, py + 40, 'cn_bronze').setDisplaySize(16, 16);
        c.add(coin);
        ui.tweens.add({ targets: coin, y: py + 40 + 70 + Math.random() * 40, x: coin.x + (Math.random() - 0.5) * 40, alpha: 0, angle: 360, duration: 650 + Math.random() * 250, delay: i * 40, ease: 'Quad.In', onComplete: () => coin.destroy() });
      }
    };

    const drawDetail = () => {
      detail.removeAll(true);
      if (!selected) {
        detail.add(txt(ui, 0, 0, mode === 'buy' ? 'Bir eşya seç.' : 'Satmak istediğin eşyayı seç.\nHer eşyanın bir satış aralığı var: dükkân kendi uzmanlığındaki eşyaya ve sahibiyle aranız iyiyse daha çok öder.', { size: 16, color: COLORS.textDim, wrap: pw * 0.36 }));
        return;
      }
      const id = selected;
      const it = ITEMS[id];
      const dw = pw * 0.38;
      detail.add(iconImage(ui, 36, 36, it.icon, 64));
      detail.add(txt(ui, 80, 6, it.name, { size: 20, bold: true, font: FONT.title, color: COLORS.textGold, wrap: dw - 80 }));
      let rx = 80;
      if (it.rank) {
        detail.add(itemRankBadge(ui, rx + 10, 48, it.rank, 20));
        const rt = txt(ui, rx + 24, 39, `Rütbe ${it.rank}`, { size: 14, bold: true, color: COLORS.textGold });
        detail.add(rt);
        rx += 36 + rt.width;
      }
      if (it.slot) {
        // Saygınlık katkısı (0 olsa bile +0)
        const sv = itemPrestige(id);
        detail.add(uiIcon(ui, rx + 8, 48, 'prestige', 16));
        detail.add(txt(ui, rx + 20, 39, `Saygınlık ${prestigeLabel(sv)}`, { size: 14, bold: true, color: sv > 0 ? '#cfe6b8' : sv < 0 ? COLORS.textRed : COLORS.textDim }));
      }
      detail.add(txt(ui, 0, 82, itemLabel(id), { size: 15, color: COLORS.textBlue, wrap: dw }));
      const eff = itemEffectsText(id);
      detail.add(txt(ui, 0, 112, it.desc + (eff ? `\n${eff}` : '') + (it.special ? `\nÖzel: ${it.special}` : ''), { size: 15, color: COLORS.text, wrap: dw, lineSpacing: 3 }));
      const qy = mode === 'sell' ? 310 : 290;
      if (mode === 'sell') {
        const o = offer(id);
        const keeper = NPC_BY_ID[shop.keeper]?.name ?? 'Dükkân sahibi';
        const why = `Aralık ${o.range[0]}–${o.range[1]} bronz · ${o.expert ? 'uzmanlık alanı' : 'uzmanlığı değil'} · ${keeper} ile yakınlık %${Math.round(o.near * 100)}`;
        detail.add(txt(ui, 0, qy - 66, `Teklif: ${o.price} bronz\n${why}`, { size: 13, color: '#cfe6b8', wrap: dw, lineSpacing: 2 }));
      }
      const unit = mode === 'buy' ? buyPrice(id) : sellP(id);
      const max = mode === 'buy' ? (it.stack ? 20 : 5) : G.p.inventory[id] ?? 0;
      detail.add(new Button(ui, 30, qy, '−', () => { qty = Math.max(1, qty - 1); drawDetail(); }, { w: 56, h: 52, size: 26 }));
      detail.add(txt(ui, 100, qy - 14, `${qty}`, { size: 24, bold: true }).setOrigin(0.5, 0));
      detail.add(new Button(ui, 170, qy, '+', () => { qty = Math.min(max, qty + 1); drawDetail(); }, { w: 56, h: 52, size: 26 }));
      detail.add(txt(ui, 0, qy + 40, 'Toplam:', { size: 17, color: '#f3dc95', bold: true }));
      if (unit * qty === 0) detail.add(txt(ui, 74, qy + 40, 'Bedava', { size: 17, color: COLORS.textGreen, bold: true }));
      else detail.add(coinRow(ui, 76, qy + 51, unit * qty, { size: 20, font: 17 }));
      const act = new Button(ui, dw / 2, qy + 110, mode === 'buy' ? 'Satın Al' : 'Sat', () => {
        if (mode === 'buy') {
          const r = R.buy(id, qty, unit, `${shop.name}: ${it.name}`);
          if (!r.ok) {
            Sound.sfx('error');
            R.toast(r.reason ?? 'Olmadı.', 'warn');
            return;
          }
          if (unit === 0 && id === 'hot_stew') G.setFlag('meal_day', G.state.time.day);
          Sound.sfx('coin');
          buyFx(id, qty);
          const ch = r.change ? (Object.entries(r.change) as [string, number][]).filter(([, v]) => v > 0).map(([k, v]) => `{w:${k}:${v}}`).join(' ') : '';
          R.toast(`+${qty} ${it.name}` + (ch ? ` · Para üstü: ${ch}` : ''), 'item', it.icon);
        } else {
          const r = R.sell(id, qty, unit, `${shop.name}: ${it.name} satışı`);
          if (!r.ok) {
            Sound.sfx('error');
            R.toast(r.reason ?? 'Olmadı.', 'warn');
            return;
          }
          Sound.sfx('coin');
          R.toast(`+{m:${unit * qty}}`, 'money');
          if (!G.p.inventory[id]) selected = null;
        }
        qty = 1;
        refresh();
      }, { w: dw - 20, h: 58, size: 20 });
      detail.add(act);
    };
    refresh();
  });
}
