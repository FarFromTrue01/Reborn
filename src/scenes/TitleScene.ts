import Phaser from 'phaser';
import { G } from '../game/G';
import { Display } from '../game/display';
import { Sound } from '../audio/audio';
import { COLORS, FONT, txt, Button, drawFrame } from '../ui/kit';
import { ensureCG } from '../ui/portraits';
import { buildSettings } from '../ui/settingsPanel';
import { confirmBox } from '../ui/panels';
import { goFullscreen } from '../game/pwa';
import { clearFogCache } from './WorldScene';
import { slotInfo, SLOT_KEYS } from '../core/save';

declare const __APP_VERSION__: string;

export class TitleScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private panel: Phaser.GameObjects.Container | null = null;
  private stars: { img: Phaser.GameObjects.Image; tw: number }[] = [];

  constructor() {
    super('Title');
  }

  /**
   * scene.restart() (ör. tam ekrana girip çıkınca) alanları sıfırlamaz: kapanmış Ayarlar paneli
   * yok edilmiş bir container'a işaret etmeye devam eder ve Ayarlar bir daha açılmaz.
   */
  private resetState() {
    this.root = undefined!;
    this.panel = null;
    this.stars = [];
  }

  create() {
    this.resetState();
    Display.uiScaleSetting = G.settings.uiScale;
    Display.compute();
    this.cameras.main.setZoom(Display.uiZoom);
    this.cameras.main.setOrigin(0, 0);
    this.build();
    const off = Display.onResize(() => {
      this.cameras.main.setSize(Display.w, Display.h);
      this.cameras.main.setZoom(Display.uiZoom);
      this.scene.restart();
    });
    this.events.once('shutdown', off);
    Sound.play('title');
    this.input.on('pointerdown', () => {
      Sound.unlock();
      Sound.play('title');
    });
    this.input.keyboard?.on('keydown', () => {
      Sound.unlock();
      Sound.play('title');
    });
  }

  async build() {
    const W = Display.uiW, H = Display.uiH;
    this.root = this.add.container(0, 0);
    const cg = await ensureCG(this, 'title');
    if (cg) {
      const im = this.add.image(W / 2, H / 2, cg);
      im.setScale(Math.max(W / im.width, H / im.height));
      this.root.add(im);
      this.root.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.35).setOrigin(0, 0));
    } else this.drawBackdrop(W, H);
    // başlık
    const title = txt(this, W / 2, H * 0.24, 'REBORN IN ELONTH', { size: Math.min(68, W / 13), font: FONT.title, color: COLORS.textGold, bold: true, shadow: true }).setOrigin(0.5);
    const glow = this.add.image(W / 2, H * 0.24, 'light').setTint(0xd9b45a).setBlendMode(Phaser.BlendModes.ADD).setScale(5, 1.2).setAlpha(0.2);
    this.tweens.add({ targets: glow, alpha: 0.32, yoyo: true, repeat: -1, duration: 2400 });
    const sub = txt(this, W / 2, H * 0.24 + 52, '— Elonth\'ta Yeniden Doğuş —', { size: 18, font: FONT.body, italic: true, color: COLORS.textDim }).setOrigin(0.5);
    this.root.add([glow, title, sub]);
    title.setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, duration: 1800 });
    // menü
    const hasSave = G.hasSave();
    const items: [string, () => void, boolean][] = [
      ['Devam', () => this.continueGame(), hasSave],
      ['Yeni Oyun', () => this.newGame(hasSave), true],
      ['Ayarlar', () => this.openSettings(), true],
      ['Emeği Geçenler', () => this.scene.start('Credits'), true],
    ];
    let y = H * 0.5;
    for (const [label, fn, enabled] of items) {
      const b = new Button(this, W / 2, y, label, () => {
        Sound.unlock();
        fn();
      }, { w: 320, h: 60, size: 22, disabled: !enabled });
      this.root.add(b);
      b.setAlpha(0);
      this.tweens.add({ targets: b, alpha: 1, duration: 600, delay: 600 + y / 4 });
      y += 74;
    }
    if (hasSave) {
      const info = slotInfo(localStorage, SLOT_KEYS.find((k) => slotInfo(localStorage, k)) ?? 'auto');
      if (info) this.root.add(txt(this, W / 2, H * 0.5 - 44, `Son kayıt: ${info.summary}`, { size: 14, color: COLORS.textDim, italic: true }).setOrigin(0.5));
    }
    // C6: sürüm numarasına 7 kez dokununca geliştirici modu açılır
    const ver = txt(this, W - 16, H - 12, `v${__APP_VERSION__}`, { size: 14, color: COLORS.textDim }).setOrigin(1, 1);
    ver.setPadding(16, 12, 4, 4);
    ver.setInteractive();
    let taps = 0;
    let lastTap = 0;
    ver.on('pointerdown', () => {
      const now = this.time.now;
      taps = now - lastTap < 1200 ? taps + 1 : 1;
      lastTap = now;
      if (taps >= 7) {
        taps = 0;
        G.settings.devMode = !G.settings.devMode;
        G.saveSettings();
        Sound.sfx('skillup', 0.6);
        this.notice(G.settings.devMode ? 'Geliştirici modu açıldı (Menü → Geliştirici)' : 'Geliştirici modu kapandı');
      }
    });
    this.root.add(ver);
    const fs = new Button(this, 60, H - 40, '⛶', () => goFullscreen(), { w: 56, h: 56, style: 'round', size: 24 });
    this.root.add(fs);
    this.root.add(txt(this, 100, H - 50, 'Tam ekran', { size: 13, color: COLORS.textDim }));
  }

  notice(text: string) {
    const W = Display.uiW, H = Display.uiH;
    const t = txt(this, W / 2, H - 70, text, { size: 18, bold: true, color: COLORS.textGold, stroke: true }).setOrigin(0.5).setDepth(80);
    this.tweens.add({ targets: t, alpha: 0, delay: 1800, duration: 500, onComplete: () => t.destroy() });
  }

  drawBackdrop(W: number, H: number) {
    const g = this.add.graphics();
    // gökyüzü
    const steps = 40;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0x0a0818), Phaser.Display.Color.ValueToColor(0x3a2440), steps, i);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      g.fillRect(0, t * H * 0.75, W, H * 0.75 / steps + 1);
    }
    this.root.add(g);
    // yıldızlar
    for (let i = 0; i < 90; i++) {
      const s = this.add.image(Math.random() * W, Math.random() * H * 0.55, 'dot').setAlpha(Math.random() * 0.8).setScale(Math.random() < 0.85 ? 0.5 : 1);
      this.root.add(s);
      this.tweens.add({ targets: s, alpha: Math.random() * 0.3, yoyo: true, repeat: -1, duration: 1500 + Math.random() * 3000 });
    }
    // ay
    const moon = this.add.image(W * 0.88, H * 0.09, 'light').setTint(0xffe6b0).setScale(0.5).setAlpha(0.9);
    const moonCore = this.add.circle(W * 0.88, H * 0.09, 22, 0xfff3d6);
    this.root.add([moon, moonCore]);
    // uzak dağlar
    const mtn = this.add.graphics();
    const ridge = (base: number, amp: number, col: number, seed: number) => {
      mtn.fillStyle(col, 1);
      mtn.beginPath();
      mtn.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) {
        const y = base - Math.abs(Math.sin(x * 0.004 + seed)) * amp - Math.sin(x * 0.013 + seed * 2) * amp * 0.3;
        mtn.lineTo(x, y);
      }
      mtn.lineTo(W, H);
      mtn.closePath();
      mtn.fillPath();
    };
    ridge(H * 0.62, 110, 0x221832, 1);
    // şehir silueti (uzakta surlar ve kuleler)
    mtn.fillStyle(0x1a1226, 1);
    const cx = W * 0.62, cy = H * 0.6;
    mtn.fillRect(cx - 160, cy - 30, 320, 40);
    for (const [dx, h] of [[-150, 70], [-80, 95], [-10, 130], [60, 90], [140, 75]] as [number, number][]) {
      mtn.fillRect(cx + dx, cy - h, 22, h);
      mtn.fillTriangle(cx + dx - 4, cy - h, cx + dx + 26, cy - h, cx + dx + 11, cy - h - 30);
    }
    for (let i = 0; i < 14; i++) {
      const lx = cx - 150 + Math.random() * 300, ly = cy - 20 - Math.random() * 60;
      const l = this.add.rectangle(lx, ly, 2, 2, 0xffc070, 0.9);
      this.root.add(l);
      this.tweens.add({ targets: l, alpha: 0.3, yoyo: true, repeat: -1, duration: 800 + Math.random() * 2000 });
    }
    ridge(H * 0.74, 60, 0x140f1c, 3);
    // orman silueti
    mtn.fillStyle(0x0b0812, 1);
    for (let x = -20; x < W + 20; x += 18) {
      const h = 60 + Math.sin(x * 0.07) * 20 + Math.random() * 30;
      mtn.fillTriangle(x - 16, H * 0.86, x + 16, H * 0.86, x, H * 0.86 - h);
    }
    mtn.fillRect(0, H * 0.86, W, H * 0.14);
    this.root.add(mtn);
    // ateş böcekleri
    for (let i = 0; i < 18; i++) {
      const f = this.add.image(Math.random() * W, H * 0.75 + Math.random() * H * 0.2, 'soft').setTint(0xd8ff7a).setBlendMode(Phaser.BlendModes.ADD).setScale(0.12).setAlpha(0);
      this.root.add(f);
      this.tweens.add({ targets: f, alpha: 0.8, yoyo: true, repeat: -1, delay: Math.random() * 3000, duration: 1500 + Math.random() * 1500 });
      this.tweens.add({ targets: f, x: f.x + (Math.random() - 0.5) * 80, y: f.y - 20 - Math.random() * 40, yoyo: true, repeat: -1, duration: 4000 + Math.random() * 3000 });
    }
  }

  continueGame() {
    if (!G.load()) {
      Sound.sfx('error');
      return;
    }
    clearFogCache();
    goFullscreen();
    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('World', {}));
  }

  async newGame(hasSave: boolean) {
    if (hasSave) {
      const ok = await confirmBox(this, 'Yeni oyun başlatılsın mı? Otomatik kayıt üzerine yazılacak. (Elle kaydedilen yuvalar korunur.)', 'Başlat', 'Vazgeç');
      if (!ok) return;
    }
    G.newGame();
    clearFogCache();
    goFullscreen();
    this.cameras.main.fadeOut(900, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Prologue'));
  }

  openSettings() {
    if (this.panel) return;
    const W = Display.uiW, H = Display.uiH;
    const c = this.add.container(0, 0).setDepth(50);
    c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.6).setOrigin(0, 0).setInteractive());
    const pw = Math.min(820, W - 40), ph = Math.min(610, H - 30);
    const g = this.add.graphics();
    drawFrame(g, (W - pw) / 2, (H - ph) / 2, pw, ph);
    c.add(g);
    const inner = this.add.container((W - pw) / 2 + 40, (H - ph) / 2 + 30);
    buildSettings(this, inner, pw - 80);
    c.add(inner);
    c.add(new Button(this, W / 2, (H + ph) / 2 - 44, 'Kapat', () => {
      c.destroy();
      this.panel = null;
      this.scene.restart();
    }, { w: 200, h: 54 }));
    this.panel = c;
  }
}
