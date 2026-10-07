import Phaser from 'phaser';
import { Display } from '../game/display';
import { Sound } from '../audio/audio';
import { COLORS, FONT, txt, drawBlue, Button, fullScreenRect, uiIcon, RANK_BG } from '../ui/kit';
import { TRAIT_ODDS, pctLabel, wheelReel } from '../core/traitWheel';
import { TRAIT_NAMES } from '../data/titles';
import { divineInfoBlock } from '../ui/traitInfo';
import { ensureCG } from '../ui/portraits';
import { divineExpToNext, divineStat, DIVINE_STATS, DIVINE_STAT_NAMES } from '../core/divine';
import { buildAppraisalPanel } from '../ui/appraisalPanel';
import { G } from '../game/G';

/** Prolog: kaza, ölüm, beyaz boşluk ve Status'un oluşması. */
export class PrologueScene extends Phaser.Scene {
  private skipping = false;
  private advance: (() => void) | null = null;

  constructor() {
    super('Prologue');
  }

  /** Prolog ikinci kez oynanırsa (Yeni Oyun → Ana Menü → Yeni Oyun) eski "geç" bayrağı kalmasın. */
  private resetState() {
    this.skipping = false;
    this.advance = null;
  }

  create() {
    this.resetState();
    this.cameras.main.setZoom(Display.uiZoom);
    this.cameras.main.setOrigin(0, 0);
    this.cameras.main.setBackgroundColor('#000000');
    this.input.on('pointerdown', () => {
      Sound.unlock();
      this.advance?.();
    });
    this.input.keyboard?.on('keydown', () => this.advance?.());
    const skip = new Button(this, Display.uiW - 90, 40, 'Geç »', () => this.finish(), { w: 130, h: 48, style: 'ghost', size: 16, textColor: '#777' });
    skip.setDepth(100);
    this.run();
  }

  wait(ms: number) {
    return new Promise<void>((r) => this.time.delayedCall(ms, r));
  }

  /** Daktilo yazısı; dokununca hızlanır, sonra devam eder. */
  type(t: Phaser.GameObjects.Text, text: string, voice: string, speed = 30): Promise<void> {
    return new Promise((resolve) => {
      let i = 0;
      let done = false;
      const ev = this.time.addEvent({
        delay: 1000 / speed,
        loop: true,
        callback: () => {
          if (i >= text.length) {
            ev.remove();
            done = true;
            this.advance = () => {
              this.advance = null;
              resolve();
            };
            this.time.delayedCall(1800 + text.length * 25, () => this.advance?.());
            return;
          }
          i++;
          Sound.blip(voice, text[i - 1]);
          t.setText(text.slice(0, i));
        },
      });
      this.advance = () => {
        if (!done) {
          i = text.length;
          t.setText(text);
        }
      };
    });
  }

  async run() {
    const W = Display.uiW, H = Display.uiH;
    Sound.play('none');
    // 1) Karanlık. Fren sesi ve çarpma.
    await this.wait(700);
    if (this.skipping) return;
    await Sound.carCrash();
    await this.wait(1500);
    Sound.sfx('heartbeat', 0.7);
    await this.wait(1000);
    Sound.sfx('heartbeat', 0.4);
    await this.wait(1200);
    if (this.skipping) return;
    // 2) ÖLDÜN.
    const died = txt(this, W / 2, H / 2, '', { size: 58, font: FONT.title, color: '#b02a30', align: 'center' }).setOrigin(0.5);
    await this.type(died, 'ÖLDÜN.', 'system', 6);
    this.tweens.add({ targets: died, alpha: 0, duration: 1200 });
    await this.wait(1400);
    died.destroy();
    if (this.skipping) return;
    // İç ses
    const th = txt(this, W / 2, H / 2, '', { size: 28, font: FONT.body, italic: true, color: '#a9c8ff', align: 'center', wrap: W - 200 }).setOrigin(0.5).setDepth(70);
    await this.type(th, 'Lastik sesi... farlar... sonra hiçbir şey.', 'joseph', 26);
    th.destroy();
    if (this.skipping) return;
    // 3) Beyaz boşluk
    Sound.play('void');
    const voidBg = this.add.container(0, 0).setDepth(55);
    const vcg = await ensureCG(this, 'void');
    if (vcg) {
      const im = this.add.image(W / 2, H / 2, vcg);
      im.setScale(Math.max(W / im.width, H / im.height));
      voidBg.add(im);
    } else {
      voidBg.add(fullScreenRect(this, 0xf6f4ee, 1));
      for (let i = 0; i < 40; i++) {
        const p = this.add.image(Math.random() * W, Math.random() * H, 'soft').setTint(0xd9e6ff).setAlpha(0).setScale(0.3 + Math.random() * 0.8);
        voidBg.add(p);
        this.tweens.add({ targets: p, alpha: 0.35, y: p.y - 40, yoyo: true, repeat: -1, duration: 3000 + Math.random() * 3000, delay: Math.random() * 2000 });
      }
    }
    voidBg.setAlpha(0);
    this.tweens.add({ targets: voidBg, alpha: 1, duration: 2000 });
    await this.wait(2400);
    const sys = txt(this, W / 2, H * 0.42, '', { size: 30, font: FONT.body, color: '#3a5a8a', align: 'center', wrap: W - 220 }).setOrigin(0.5).setDepth(70);
    for (const line of ['Hoş geldin.', 'Elonth fantastik dünyasında yeni bir hayata başlamak için seçildin.', 'Status\'un oluşturuluyor...']) {
      if (this.skipping) return;
      sys.setAlpha(1);
      await this.type(sys, line, 'system', 24);
      this.tweens.add({ targets: sys, alpha: 0, duration: 500 });
      await this.wait(600);
    }
    sys.destroy();
    if (this.skipping) return;
    // B19: trait çarkı ("ne kadar şanslıymışım") — sonuç her zaman Divine Paladin
    await this.traitWheel();
    if (this.skipping) return;
    await this.statusReveal();
    if (this.skipping) return;
    const wake = txt(this, W / 2, H * 0.9, 'Uyan.', { size: 26, font: FONT.title, color: '#3a5a8a' }).setOrigin(0.5).setDepth(80);
    wake.setAlpha(0);
    this.tweens.add({ targets: wake, alpha: 1, duration: 900 });
    await this.wait(2200);
    this.finish();
  }

  /** Dokunuş bekle (ya da süre dolunca devam). */
  private tapOrWait(ms: number) {
    return new Promise<void>((resolve) => {
      this.advance = () => {
        this.advance = null;
        resolve();
      };
      this.time.delayedCall(ms, () => this.advance?.());
    });
  }

  /**
   * B19 (0.10.0): trait çarkı. Üstte "TRAIT BELİRLENİYOR" ve rütbe olasılık tablosu (rozet + yüzde), ortada parlayan
   * "TRAIT ÇEVİR". Basınca karartılmış trait kartlarıyla dolu bir makara akar, ~4 sn'de yavaşlar, S/A kartları
   * önünden geçer ("az kalsın") ve X kartında durur: altın parlama, ışın patlaması, büyüyen kart, olasılık ve gerçek
   * veriden açıklama. Oyuncu zaten Divine Paladin ile başlar (sonuç rastgele değil).
   */
  async traitWheel() {
    const W = Display.uiW, H = Display.uiH;
    const root = this.add.container(0, 0).setDepth(72);
    root.setAlpha(0);
    this.tweens.add({ targets: root, alpha: 1, duration: 500 });
    root.add(txt(this, W / 2, H * 0.07, 'TRAIT BELİRLENİYOR', { size: 30, font: FONT.title, bold: true, color: '#3a5a8a' }).setOrigin(0.5));
    // olasılık tablosu: sığarsa tek satır, yoksa iki satır
    const itemW = 118;
    const perRow = itemW * TRAIT_ODDS.length <= W - 40 ? TRAIT_ODDS.length : Math.ceil(TRAIT_ODDS.length / 2);
    TRAIT_ODDS.forEach(([r, pct], i) => {
      const row = Math.floor(i / perRow), col = i % perRow;
      const n = row === 0 ? Math.min(perRow, TRAIT_ODDS.length) : TRAIT_ODDS.length - perRow;
      const x = W / 2 + (col - (n - 1) / 2) * itemW, y = H * 0.15 + row * 46;
      root.add(uiIcon(this, x - 30, y, 'rank_' + r, 32));
      root.add(txt(this, x - 10, y, pctLabel(pct), { size: 17, bold: true, color: r === 'X' ? '#8a40d0' : '#2a3a5a' }).setOrigin(0, 0.5));
    });
    // çevir düğmesi
    const btnY = H * 0.56;
    const glow = this.add.image(W / 2, btnY, 'soft').setTint(0xffd56a).setScale(4.2, 2).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.9, scaleX: 4.8, yoyo: true, repeat: -1, duration: 700 });
    root.add(glow);
    await new Promise<void>((resolve) => {
      const b = new Button(this, W / 2, btnY, 'TRAIT ÇEVİR', () => {
        b.disableInteractive();
        Sound.sfx('skillup');
        this.tweens.add({ targets: [b, glow], alpha: 0, duration: 250, onComplete: () => { b.destroy(); glow.destroy(); } });
        resolve();
      }, { w: Math.min(360, W - 60), h: 76, size: 26, style: 'gold' });
      root.add(b);
      // "geç" ya da 12 sn bekleyince kendiliğinden döner
      this.time.delayedCall(12000, () => { if (b.active) { b.destroy(); glow.destroy(); resolve(); } });
    });
    if (this.skipping) { root.destroy(); return; }
    // makara
    const reel = wheelReel(34);
    const cw = 108, ch = 148, gap = 22, step = cw + gap;
    const ry = H * 0.5;
    const strip = this.add.container(W / 2, ry);
    root.add(strip);
    const frameG = this.add.graphics();
    frameG.lineStyle(3, 0xffd56a, 0.95);
    frameG.strokeRoundedRect(W / 2 - cw / 2 - 8, ry - ch / 2 - 8, cw + 16, ch + 16, 12);
    frameG.fillStyle(0xffd56a, 1);
    frameG.fillTriangle(W / 2 - 10, ry - ch / 2 - 22, W / 2 + 10, ry - ch / 2 - 22, W / 2, ry - ch / 2 - 8);
    root.add(frameG);
    const cards: Phaser.GameObjects.Container[] = [];
    reel.forEach((id, i) => {
      const tn = TRAIT_NAMES[id];
      const card = this.add.container(i * step, 0);
      const g = this.add.graphics();
      const col = RANK_BG[tn.rank] ?? 0x333333;
      g.fillStyle(0x0c0a12, 0.96);
      g.fillRoundedRect(-cw / 2, -ch / 2, cw, ch, 10);
      g.lineStyle(3, col, 1);
      g.strokeRoundedRect(-cw / 2, -ch / 2, cw, ch, 10);
      g.fillStyle(col, 0.35);
      g.fillRoundedRect(-cw / 2 + 6, -ch / 2 + 6, cw - 12, 44, 8);
      card.add(g);
      card.add(uiIcon(this, 0, -ch / 2 + 28, 'rank_' + tn.rank, 34));
      card.add(txt(this, 0, 20, '???', { size: 22, bold: true, font: FONT.title, color: '#3a3448' }).setOrigin(0.5));
      card.add(this.add.circle(0, 0, 24, 0x000000, 0.4));
      strip.add(card);
      cards.push(card);
    });
    // akış: hızlı başlar, ~4 sn'de yavaşlar; her kart ortadan geçerken tık (yavaşladıkça seyrekleşir)
    const total = (reel.length - 1) * step;
    const pos = { x: 0 };
    let lastIdx = 0;
    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: pos, x: total, duration: this.skipping ? 1 : 4600, ease: 'Cubic.Out',
        onUpdate: () => {
          strip.x = W / 2 - pos.x;
          const idx = Math.round(pos.x / step);
          if (idx !== lastIdx) {
            lastIdx = idx;
            Sound.sfx('click', 0.35);
            const tn = TRAIT_NAMES[reel[idx]];
            if (tn && (tn.rank === 'S' || tn.rank === 'A')) Sound.sfx('windup', 0.25);
          }
        },
        onComplete: () => resolve(),
      });
    });
    if (this.skipping) { root.destroy(); return; }
    // sonuç: X
    const win = cards[cards.length - 1];
    for (const c of cards) if (c !== win) this.tweens.add({ targets: c, alpha: 0.15, duration: 400 });
    Sound.sfx('awaken');
    Sound.sfx('title', 0.8);
    const flash = fullScreenRect(this, 0xffe9a0, 0).setDepth(73).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: flash, fillAlpha: 0.75, duration: 180, yoyo: true, hold: 120, onComplete: () => flash.destroy() });
    const rays = this.add.graphics().setDepth(71).setBlendMode(Phaser.BlendModes.ADD);
    rays.setPosition(W / 2, ry);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      rays.fillStyle(0xffd56a, 0.22);
      rays.fillTriangle(0, 0, Math.cos(a - 0.08) * 900, Math.sin(a - 0.08) * 900, Math.cos(a + 0.08) * 900, Math.sin(a + 0.08) * 900);
    }
    rays.setScale(0.2);
    this.tweens.add({ targets: rays, scale: 1, angle: 40, duration: 2400, ease: 'Cubic.Out' });
    this.tweens.add({ targets: rays, alpha: 0.35, duration: 2400 });
    root.add(rays);
    root.sendToBack(rays);
    // kart aydınlanır ve büyür
    const wg = this.add.graphics();
    wg.fillStyle(0x2a1a46, 1);
    wg.fillRoundedRect(-cw / 2, -ch / 2, cw, ch, 10);
    wg.lineStyle(4, 0xffd56a, 1);
    wg.strokeRoundedRect(-cw / 2, -ch / 2, cw, ch, 10);
    win.removeAll(true);
    win.add(wg);
    win.add(uiIcon(this, 0, -ch / 2 + 30, 'rank_X', 40));
    win.add(txt(this, 0, 18, 'DIVINE\nPALADIN', { size: 17, bold: true, font: FONT.title, color: '#ffe9a0', align: 'center' }).setOrigin(0.5));
    frameG.setVisible(false);
    // kart yukarı kayar ve büyür; altında başlık, olasılık, sistem satırı ve açıklama
    const cardY = Math.max(ch * 0.62 + 20, H * 0.22);
    this.tweens.add({ targets: strip, y: cardY, duration: 600, ease: 'Cubic.Out' });
    this.tweens.add({ targets: win, scale: 1.25, duration: 600, ease: 'Back.Out' });
    await this.wait(this.skipping ? 0 : 650);
    const infoY = cardY + ch * 0.62 + 12;
    const t1 = txt(this, W / 2, infoY, 'X — DIVINE PALADIN', { size: 28, bold: true, font: FONT.title, color: '#7a4ac0', stroke: true }).setOrigin(0.5, 0);
    const X = TRAIT_ODDS.find(([r]) => r === 'X')![1];
    const t2 = txt(this, W / 2, infoY + 38, `Olasılık: ${pctLabel(X)}`, { size: 17, bold: true, color: '#3a5a8a' }).setOrigin(0.5, 0);
    const t3 = txt(this, W / 2, infoY + 62, '[Sistem] Elonth\'ta bu trait\'e sahip başka biri kayıtlı değil.', { size: 15, italic: true, color: '#3a5a8a', align: 'center', wrap: W - 80 }).setOrigin(0.5, 0);
    const bw = Math.min(820, W - 60);
    const block = divineInfoBlock(this, bw, W < 900 ? 13 : 14);
    // açıklamanın rengi: açık zeminde koyu
    for (const o of block.list) (o as Phaser.GameObjects.Text).setColor?.('#2a3a5a');
    block.setPosition((W - bw) / 2, infoY + 92);
    const sc = Math.min(1, (H - 20 - (infoY + 92)) / Math.max(1, (block as any).blockH));
    block.setScale(sc);
    root.add([t1, t2, t3, block]);
    for (const o of [t1, t2, t3, block]) {
      o.setAlpha(0);
      this.tweens.add({ targets: o, alpha: 1, duration: 500 });
    }
    await this.tapOrWait(30000);
    this.tweens.add({ targets: root, alpha: 0, duration: 500 });
    await this.wait(550);
    root.destroy();
  }

  /**
   * 0.9.0: Status, Appraisal panelindeki kendi kartın düzeninde (aynı bölümler) ve mavi sistem temasında açılır.
   * Bütün değerler gerçek veriden (yeni oyunun Joseph'i, Divine statları); portre "???". Açılış: panel dikeyde
   * açılır, sonra bir tarama çizgisi yukarıdan aşağı içeriği ortaya çıkarır.
   */
  async statusReveal() {
    const W = Display.uiW, H = Display.uiH;
    const p = G.p, dv = G.state.divine;
    const panel = buildAppraisalPanel(this, p, null, {
      self: true, mineRank: 0, theme: 'system', hidePortrait: true,
      traits: p.traits.includes('divine_paladin') ? {
        name: 'Divine Paladin', rank: 'X', level: dv.level, exp: dv.exp, need: divineExpToNext(dv.level),
        stats: DIVINE_STATS.map((k) => [DIVINE_STAT_NAMES[k], `${divineStat(k, dv.level).toFixed(2).replace('.', ',')}x`] as [string, string]),
      } : null,
    });
    const pw = (panel as any).panelW, ph = (panel as any).panelH;
    const sc = Math.min(1, (H - 30) / ph, (W - 30) / pw);
    panel.setScale(sc);
    const x0 = (W - pw * sc) / 2, y0 = Math.max(12, (H - ph * sc) / 2);
    const holder = this.add.container(W / 2, y0 + (ph * sc) / 2).setDepth(75);
    panel.setPosition(-(pw * sc) / 2, -(ph * sc) / 2);
    holder.add(panel);
    // tarama maskesi: içerik yukarıdan aşağı belirir
    const maskG = this.make.graphics({});
    panel.setMask(maskG.createGeometryMask());
    const scan = this.add.rectangle(W / 2, y0, pw * sc, 3, 0x9fd6ff, 0.9).setDepth(76).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    const reveal = { f: 0 };
    const drawMask = () => {
      maskG.clear();
      maskG.fillStyle(0xffffff, 1);
      maskG.fillRect(x0 - 10, y0 - 10, pw * sc + 20, 10 + ph * sc * reveal.f + (reveal.f > 0 ? 10 : 0));
      scan.setY(y0 + ph * sc * reveal.f);
    };
    reveal.f = 0.08;
    drawMask();
    holder.setScale(1, 0.02);
    holder.setAlpha(0);
    Sound.sfx('system');
    this.tweens.add({ targets: holder, alpha: 1, scaleY: 1, duration: 500, ease: 'Cubic.Out' });
    await this.wait(this.skipping ? 0 : 520);
    scan.setAlpha(0.9);
    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: reveal, f: 1, duration: this.skipping ? 1 : 1600, ease: 'Sine.InOut',
        onUpdate: () => drawMask(),
        onComplete: () => resolve(),
      });
      // tarama sırasında tıkırtılar
      for (let i = 0; i < 6; i++) this.time.delayedCall(i * 260, () => Sound.sfx('click', 0.22));
    });
    this.tweens.add({ targets: scan, alpha: 0, duration: 300 });
    panel.clearMask(true);
    await new Promise<void>((resolve) => {
      this.advance = () => {
        this.advance = null;
        resolve();
      };
      this.time.delayedCall(8000, () => this.advance?.());
    });
    this.tweens.add({ targets: holder, alpha: 0, scaleY: 0.02, duration: 500 });
    await this.wait(600);
    holder.destroy();
    scan.destroy();
  }

  finish() {
    if (this.skipping) return;
    this.skipping = true;
    this.advance = null;
    this.cameras.main.fadeOut(900, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('World', { map: 'world', x: 0, y: 0, facing: 'down' });
    });
  }
}
