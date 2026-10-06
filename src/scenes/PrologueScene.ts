import Phaser from 'phaser';
import { Display } from '../game/display';
import { Sound } from '../audio/audio';
import { COLORS, FONT, txt, drawBlue, Button, fullScreenRect } from '../ui/kit';
import { ensureCG } from '../ui/portraits';
import { divineExpToNext } from '../core/divine';
import { fmtHp } from '../ui/format';

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

  async statusReveal() {
    const W = Display.uiW, H = Display.uiH;
    const lines: [string, string?][] = [
      ['⚙️ STATUS'],
      ['İsim: Joseph · Level: 0 · EXP: 0/100'],
      [`HP: ${fmtHp(5)}/${fmtHp(5)} · MP: 0/0 · Rütbe: Yok · Irk: İnsan`],
      ['📊 STATS'],
      ['STR 0 · VIT 0 · AGI 0 · DEX 0 · MNA 0 · INT 0 · LUK 0'],
      ['⭐ SKILLS'],
      ['Appraisal (G-) [0/15]'],
      ['🔮 TRAITS'],
      [`Divine Paladin (X) [Level: 0 | EXP: 0/${divineExpToNext(0)}]`, '#ffe9a0'],
      ['Güç 0.50x · Dayanıklılık 0.50x · Hız 0.50x', '#ffe9a0'],
      ['Öğrenme 0.50x · Adaptasyon 0.50x', '#ffe9a0'],
      ['🏆 TITLES'],
      ['Yok'],
      ['🛡️ EQUIPMENT'],
      ['Pantolon: Yırtık Şort (G) [DEF: +0] · Diğer slotlar: Yok'],
      ['🎒 INVENTORY'],
      ['Boş · Para: 0'],
    ];
    const isHead = (l: string) => /^[⚙📊⭐🔮🏆🛡🎒]/u.test(l);
    // Panel yüksekliği içeriğe göre: başlıklar 30, satırlar 26 birim.
    const contentH = lines.reduce((a, [l]) => a + (isHead(l) ? 30 : 26), 0);
    const pw = Math.min(700, W - 60), ph = Math.min(contentH + 40, H - 40);
    const c = this.add.container((W - pw) / 2, (H - ph) / 2).setDepth(75);
    const g = this.add.graphics();
    drawBlue(g, 0, 0, pw, ph, 0.9);
    c.add(g);
    c.setScale(1, 0.02);
    c.setAlpha(0);
    Sound.sfx('system');
    this.tweens.add({ targets: c, alpha: 1, scaleY: 1, duration: 600, ease: 'Cubic.Out' });
    await this.wait(700);
    let y = 20;
    for (const [l, col] of lines) {
      const head = isHead(l);
      const t = txt(this, head ? 24 : 44, y, l, { size: head ? 17 : 16, bold: head, color: col ?? (head ? '#e6f6ff' : COLORS.textBlue), wrap: pw - 70 });
      t.setAlpha(0);
      c.add(t);
      this.tweens.add({ targets: t, alpha: 1, duration: 250 });
      Sound.sfx('click', 0.25);
      y += head ? 30 : 26;
      await this.wait(this.skipping ? 0 : 230);
    }
    await new Promise<void>((resolve) => {
      this.advance = () => {
        this.advance = null;
        resolve();
      };
      this.time.delayedCall(6500, () => this.advance?.());
    });
    this.tweens.add({ targets: c, alpha: 0, scaleY: 0.02, duration: 500 });
    await this.wait(600);
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
