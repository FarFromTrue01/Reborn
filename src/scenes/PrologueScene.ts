import Phaser from 'phaser';
import { G } from '../game/G';
import { Display } from '../game/display';
import { Sound } from '../audio/audio';
import { COLORS, FONT, txt, drawBlue, Button } from '../ui/kit';
import { ensureCG } from '../ui/portraits';
import { divineExpToNext } from '../core/divine';

/** Prolog: ölüm, uzak savaş alanı, beyaz boşluk ve Status'un oluşması. */
export class PrologueScene extends Phaser.Scene {
  private skipping = false;
  private advance: (() => void) | null = null;

  constructor() {
    super('Prologue');
  }

  create() {
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
    // 1) Öldün.
    await this.wait(800);
    Sound.sfx('heartbeat');
    await this.wait(900);
    Sound.sfx('heartbeat', 0.6);
    await this.wait(1100);
    const died = txt(this, W / 2, H / 2, '', { size: 54, font: FONT.title, color: '#b02a30', align: 'center' }).setOrigin(0.5);
    await this.type(died, 'Öldün.', 'system', 6);
    this.tweens.add({ targets: died, alpha: 0, duration: 1200 });
    await this.wait(1400);
    if (this.skipping) return;
    // 2) Uzak savaş alanı
    Sound.play('battle');
    const flash = this.add.rectangle(0, 0, W, H, 0xffffff, 1).setOrigin(0, 0).setDepth(50);
    this.tweens.add({ targets: flash, alpha: 0, duration: 700 });
    const bf = this.add.container(0, 0);
    const cg = await ensureCG(this, 'battlefield');
    if (cg) {
      const im = this.add.image(W / 2, H / 2, cg);
      im.setScale(Math.max(W / im.width, H / im.height) * 1.05);
      bf.add(im);
      this.tweens.add({ targets: im, scale: im.scale * 1.08, duration: 7000 });
    } else this.drawBattlefield(bf, W, H);
    await this.wait(6500);
    if (this.skipping) return;
    const fade = this.add.rectangle(0, 0, W, H, 0x000000, 0).setOrigin(0, 0).setDepth(60);
    this.tweens.add({ targets: fade, fillAlpha: 1, duration: 1400 });
    Sound.play('none');
    await this.wait(1600);
    bf.destroy();
    // İç ses
    const th = txt(this, W / 2, H / 2, '', { size: 28, font: FONT.body, italic: true, color: '#a9c8ff', align: 'center', wrap: W - 200 }).setOrigin(0.5).setDepth(70);
    await this.type(th, 'Neydi o? Neresiydi?', 'joseph', 26);
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
      voidBg.add(this.add.rectangle(0, 0, W, H, 0xf6f4ee, 1).setOrigin(0, 0));
      for (let i = 0; i < 40; i++) {
        const p = this.add.image(Math.random() * W, Math.random() * H, 'soft').setTint(0xd9e6ff).setAlpha(0).setScale(0.3 + Math.random() * 0.8);
        voidBg.add(p);
        this.tweens.add({ targets: p, alpha: 0.35, y: p.y - 40, yoyo: true, repeat: -1, duration: 3000 + Math.random() * 3000, delay: Math.random() * 2000 });
      }
    }
    voidBg.setAlpha(0);
    this.tweens.add({ targets: voidBg, alpha: 1, duration: 2000 });
    this.tweens.add({ targets: fade, fillAlpha: 0, duration: 2000 });
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
    const pw = Math.min(700, W - 60), ph = Math.min(640, H - 40);
    const c = this.add.container((W - pw) / 2, (H - ph) / 2).setDepth(75);
    const g = this.add.graphics();
    drawBlue(g, 0, 0, pw, ph, 0.9);
    c.add(g);
    c.setScale(1, 0.02);
    c.setAlpha(0);
    Sound.sfx('system');
    this.tweens.add({ targets: c, alpha: 1, scaleY: 1, duration: 600, ease: 'Cubic.Out' });
    await this.wait(700);
    const dv = G.state.divine;
    const lines: [string, string?][] = [
      ['⚙️ STATUS'],
      ['İsim: Joseph · Level: 0 · EXP: 0/100'],
      ['HP: 5/5 · MP: 0/0 · Rütbe: Yok · Irk: İnsan'],
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
    void dv;
    let y = 22;
    for (const [l, col] of lines) {
      const head = /^[⚙📊⭐🔮🏆🛡🎒]/u.test(l);
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

  drawBattlefield(bf: Phaser.GameObjects.Container, W: number, H: number) {
    const g = this.add.graphics();
    for (let i = 0; i < 30; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0x1a0608), Phaser.Display.Color.ValueToColor(0x8a2a10), 30, i);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      g.fillRect(0, (i / 30) * H * 0.7, W, H * 0.7 / 30 + 1);
    }
    g.fillStyle(0x140808, 1);
    g.fillRect(0, H * 0.7, W, H * 0.3);
    // yanan tepeler
    g.fillStyle(0x200a08, 1);
    for (let x = 0; x < W; x += 40) g.fillTriangle(x - 60, H * 0.72, x + 60, H * 0.72, x, H * 0.62 - Math.random() * 40);
    bf.add(g);
    // ejderha silueti: sola bakan, kanatları kalkık, kanat çırpan
    const sc = (H / 720) * 0.72;
    const cx = W * 0.6, cy = H * 0.42;
    const SIL = 0x0a0404, RIM = 0x6a2010;
    const poly = (g: Phaser.GameObjects.Graphics, pts: number[][], color = SIL, rim = true) => {
      const v = pts.map(([x, y]) => new Phaser.Math.Vector2(x * sc, y * sc));
      g.fillStyle(color, 1);
      g.fillPoints(v, true);
      if (rim) {
        g.lineStyle(2 * sc, RIM, 0.7);
        g.strokePoints(v, true);
      }
    };
    const wing = (pts: number[][], sx: number, sy: number, color: number, delay: number) => {
      const wg = this.add.graphics({ x: cx + sx * sc, y: cy + sy * sc });
      poly(wg, pts, color);
      // kanat kemikleri
      wg.lineStyle(4 * sc, 0x050202, 1);
      const bones = pts.filter((_, i) => i % 2 === 1);
      for (const [x, y] of bones) wg.lineBetween(pts[1][0] * sc, pts[1][1] * sc, x * sc, y * sc);
      bf.add(wg);
      this.tweens.add({ targets: wg, scaleY: 0.45, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay });
      return wg;
    };
    // uzak kanat (arkada)
    const farWing = wing([[0, 0], [-30, -220], [-130, -270], [-95, -190], [-170, -160], [-110, -120], [-140, -60], [-60, -20]], -50, -25, 0x140707, 0);
    const d = this.add.graphics({ x: cx, y: cy });
    // kuyruk
    poly(d, [[80, -20], [190, 15], [290, 60], [350, 50], [395, 15], [420, 0], [400, 40], [375, 85], [300, 100], [185, 60], [70, 30]]);
    // arka ve ön bacaklar
    poly(d, [[50, 15], [95, 85], [80, 110], [45, 112], [62, 95], [30, 35]]);
    poly(d, [[-75, 15], [-95, 75], [-120, 92], [-88, 98], [-58, 60]]);
    // gövde
    d.fillStyle(SIL, 1);
    d.fillEllipse(0, 0, 230 * sc, 95 * sc);
    d.lineStyle(2 * sc, RIM, 0.7);
    d.strokeEllipse(0, 0, 230 * sc, 95 * sc);
    // boyun
    poly(d, [[-70, -38], [-130, -75], [-180, -108], [-212, -118], [-206, -84], [-160, -48], [-95, 18]]);
    // sırt dikenleri
    for (let i = 0; i < 6; i++) {
      const t = i / 5, x = -190 + t * 260, y = -112 + t * 70;
      poly(d, [[x - 8, y + 4], [x + 2, y - 18], [x + 10, y + 6]], SIL, false);
    }
    // baş, boynuzlar, açık çene
    poly(d, [[-200, -120], [-246, -126], [-292, -108], [-304, -96], [-276, -88], [-250, -82], [-212, -76]]);
    poly(d, [[-212, -118], [-180, -160], [-200, -112]]);
    poly(d, [[-226, -122], [-212, -170], [-232, -118]]);
    poly(d, [[-248, -84], [-296, -72], [-288, -64], [-238, -70]]);
    bf.add(d);
    // yakın kanat (önde)
    const nearWing = wing([[0, 0], [50, -230], [230, -300], [185, -215], [285, -190], [215, -140], [270, -80], [190, -62], [205, 15], [70, 0]], -10, -30, 0x0c0505, 80);
    const eye = this.add.circle(cx - 262 * sc, cy - 102 * sc, 4 * sc, 0xffd040);
    const eyeGlow = this.add.image(eye.x, eye.y, 'light').setTint(0xffa020).setBlendMode(Phaser.BlendModes.ADD).setScale(0.12);
    bf.add([eye, eyeGlow]);
    this.tweens.add({ targets: [d, eye, eyeGlow, farWing, nearWing], y: '-=12', yoyo: true, repeat: -1, duration: 1300, ease: 'Sine.easeInOut' });
    const mouthX = cx - 296 * sc, mouthY = cy - 74 * sc;
    // ateş nefesi
    this.time.addEvent({
      delay: 60, loop: true, callback: () => {
        if (this.time.now % 2800 > 1400) return;
        const f = this.add.image(mouthX, mouthY + d.y - cy, 'light').setTint(Math.random() < 0.5 ? 0xff7a20 : 0xffc040).setBlendMode(Phaser.BlendModes.ADD).setScale(0.15).setAlpha(0.9);
        bf.add(f);
        this.tweens.add({ targets: f, x: W * 0.22 + Math.random() * 60, y: H * 0.74 + Math.random() * 20, scale: 0.7, alpha: 0, duration: 700, onComplete: () => f.destroy() });
      },
    });
    // kahramanlar (LPC)
    const heroes = [['hero_knight', W * 0.22, 'slash', 12], ['hero_mage', W * 0.14, 'cast', 0], ['hero_archer', W * 0.3, 'shoot', 16]] as const;
    for (const [key, x, anim, row] of heroes) {
      const s = this.add.sprite(x, H * 0.8, key, (anim === 'cast' ? 3 : row + 3) * 13).setScale(2.2).setOrigin(0.5, 1);
      bf.add(s);
      let f = 0;
      const n = anim === 'slash' ? 6 : anim === 'shoot' ? 13 : 7;
      const baseRow = anim === 'cast' ? 3 : row + 3; // sağa bakan satır
      this.time.addEvent({ delay: 90, loop: true, callback: () => { f = (f + 1) % n; s.setFrame(baseRow * 13 + f); } });
      if (anim === 'cast') {
        this.time.addEvent({ delay: 700, loop: true, callback: () => {
          const orb = this.add.image(x + 30, H * 0.8 - 90, 'light').setTint(0x9fd6ff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.2);
          bf.add(orb);
          this.tweens.add({ targets: orb, x: cx - 60, y: cy, scale: 0.5, duration: 600, onComplete: () => { this.burst(bf, cx - 60 + Math.random() * 80, cy + Math.random() * 40, 0x9fd6ff); orb.destroy(); } });
        } });
      }
      if (anim === 'shoot') {
        this.time.addEvent({ delay: 500, loop: true, callback: () => {
          const ar = this.add.image(x + 20, H * 0.8 - 70, 'arrow').setScale(2).setRotation(-0.6);
          bf.add(ar);
          this.tweens.add({ targets: ar, x: cx + 40, y: cy + 20, duration: 400, onComplete: () => { this.burst(bf, cx + 40, cy + 20, 0xffe9a0); ar.destroy(); } });
        } });
      }
      if (anim === 'slash') {
        this.time.addEvent({ delay: 650, loop: true, callback: () => this.burst(bf, x + 80 + Math.random() * 40, H * 0.72, 0xffd27a) });
      }
    }
    this.time.addEvent({ delay: 1300, loop: true, callback: () => { this.cameras.main.shake(200, 0.004); Sound.sfx('thud', 0.5); } });
    const cap = txt(this, W / 2, H - 50, 'Çok uzakta bir savaş alanı. S rütbe kahramanlar ve bir ejderha.', { size: 17, italic: true, color: '#e8c8a8', stroke: true }).setOrigin(0.5);
    cap.setAlpha(0);
    bf.add(cap);
    this.tweens.add({ targets: cap, alpha: 0.9, duration: 1000, delay: 800 });
  }

  burst(c: Phaser.GameObjects.Container, x: number, y: number, color: number) {
    const b = this.add.image(x, y, 'light').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setScale(0.1);
    c.add(b);
    this.tweens.add({ targets: b, scale: 0.9, alpha: 0, duration: 450, onComplete: () => b.destroy() });
    Sound.sfx('hit', 0.3);
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
