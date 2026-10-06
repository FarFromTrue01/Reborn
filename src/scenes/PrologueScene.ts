import Phaser from 'phaser';
import { Display } from '../game/display';
import { Sound } from '../audio/audio';
import { COLORS, FONT, txt, drawBlue, Button, fullScreenRect } from '../ui/kit';
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
    await this.statusReveal();
    if (this.skipping) return;
    const wake = txt(this, W / 2, H * 0.9, 'Uyan.', { size: 26, font: FONT.title, color: '#3a5a8a' }).setOrigin(0.5).setDepth(80);
    wake.setAlpha(0);
    this.tweens.add({ targets: wake, alpha: 1, duration: 900 });
    await this.wait(2200);
    this.finish();
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
